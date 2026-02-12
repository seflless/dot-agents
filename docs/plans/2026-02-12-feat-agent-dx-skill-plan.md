---
title: "feat: Add agent-dx skill for repo verification tooling audit"
type: feat
date: 2026-02-12
---

# Add agent-dx Skill

Skill that analyzes a repo and recommends the verification tools coding agents need to self-check their work — testing, linting, type checking, logging, security scanning, E2E, and CI integration. Focus on web tech stacks. Report-only (no auto-install).

## Overview

Agents are terrible at knowing whether their code actually works. They write code, say "done", and the human discovers it's broken. The fix: give agents a skill that audits a repo and tells them exactly what tools to set up so they can verify their own work before claiming "done."

**Name:** `agent-dx` (Agent Developer Experience)

**Trigger phrases:** "audit my repo for agent tools", "what testing tools do I need", "set up verification for agents", "agent developer experience", "agent-dx", "how can agents test this"

## Problem Statement

Coding agents lack self-verification capability because:
1. Most repos don't have the right tools installed for agents to check their work
2. Agents don't know which tools to recommend per tech stack
3. Even when tools exist, agents don't know how to run them or parse output
4. No standard "agent readiness" checklist exists

## Proposed Solution

A read-only audit skill that:
1. Detects project language/framework/runtime
2. Scans for existing verification tools
3. Generates a prioritized Markdown report with:
   - What's missing (critical → nice-to-have)
   - Exact install commands (copy-paste ready)
   - Agent-friendly run commands (JSON output flags, etc.)
   - Config snippets with sensible defaults

**Not in scope for v1:** Auto-installing tools, generating full config files, CI/CD workflow generation.

## Technical Approach

### Architecture

```
skills/agent-dx/
  SKILL.md              # Main skill (detection logic + report template)
  references/
    tool-matrix.md      # Tool recommendations per stack
    agent-commands.md   # Agent-optimized commands per tool
```

### Detection Logic (in SKILL.md instructions)

Agent reads repo files to detect context:

**Language detection:**
- `package.json` → JS/TS (check `dependencies` for framework: React, Vue, Svelte, Next, Electron)
- `pyproject.toml` / `requirements.txt` / `setup.py` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- File extension scan as fallback

**Existing tool detection:**
- Parse `devDependencies` in `package.json` for: jest, vitest, mocha, playwright, cypress, eslint, biome, prettier, typescript
- Check config files: `.eslintrc*`, `vitest.config.*`, `playwright.config.*`, `tsconfig.json`, `biome.json`, `.prettierrc*`
- Check scripts in `package.json`: `test`, `lint`, `typecheck`, `e2e`
- Python: check for pytest, mypy, pyright, ruff, black in deps
- Check `.github/workflows/` for CI steps
- Check for logging: grep imports of pino, winston, structlog, logging

**Framework-specific detection:**
- Electron: `electron` in dependencies or `main` field pointing to `.js`
- React: `react` in dependencies
- Next.js: `next` in dependencies
- Vue: `vue` in dependencies

### Report Categories (Priority Order)

#### 1. CRITICAL — Testing
| Stack | No tests | Has Jest | Has Vitest |
|-------|----------|----------|------------|
| JS/TS | Recommend Vitest | Keep Jest (note: Vitest 10-20x faster) | Already good |
| Python | Recommend pytest | N/A | N/A |

**Why Vitest over Jest for new setups:** 10-20x faster, native ESM/TS, 97% Jest-compatible API, better watch mode.

**Agent-friendly commands:**
```bash
# JS/TS
npx vitest --reporter=json --run    # Single run, JSON output
npx vitest --watch                  # Watch mode for iteration

# Python
python -m pytest --tb=short -q      # Short traceback, quiet
python -m pytest --json-report      # With pytest-json-report plugin
```

#### 2. CRITICAL — Linting
| Stack | No linter | Has ESLint | Has Biome |
|-------|-----------|------------|-----------|
| JS/TS | Recommend Biome | Keep ESLint (note: Biome 25-56x faster) | Already good |
| Python | Recommend Ruff | N/A | N/A |

**Why Biome for new setups:** Single binary, 25-56x faster than ESLint, linting + formatting in one tool, 1 config file vs 4+.

**Agent-friendly commands:**
```bash
# JS/TS
npx @biomejs/biome check --reporter=json .    # Lint + format check
npx @biomejs/biome check --write .             # Auto-fix

# Python
ruff check --output-format=json .              # Lint
ruff format --check .                          # Format check
```

#### 3. CRITICAL — Type Checking
| Stack | No types | Has TS but no check script | Has tsc |
|-------|----------|---------------------------|---------|
| JS/TS | Recommend adding TS | Add `typecheck` script | Already good |
| Python | Recommend Pyright | N/A | N/A |

**Agent-friendly commands:**
```bash
# TypeScript
npx tsc --noEmit --pretty false    # Type check only, parseable output

# Python
pyright --outputjson               # JSON output
```

**Recommended tsconfig flags for agent signal:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### 4. IMPORTANT — E2E / Browser Testing

Only recommend if frontend framework or Electron detected.

| Context | Recommendation |
|---------|---------------|
| Web app (React/Vue/Svelte) | Playwright |
| Electron app | agent-browser (via CDP) or Playwright Electron API |
| API only | Skip |

**agent-browser** (preferred for agent workflows):
```bash
# Snapshot-driven, stable refs
agent-browser snapshot -i --json    # Get interactive elements
agent-browser click @e1             # Click by ref
agent-browser screenshot            # Visual check
```

**Playwright** (preferred for CI regression suites):
```bash
npx playwright test --reporter=json
```

**Electron-specific:**
```bash
# agent-browser via CDP
agent-browser --cdp 9222

# Playwright Electron API
# Note: Electron 27+ can be flaky — use electron-playwright-helpers
```

#### 5. IMPORTANT — Structured Logging

Only recommend if no logging library detected.

| Stack | Recommendation | Why |
|-------|---------------|-----|
| JS/TS | Pino | 5x faster than Winston, JSON by default, agent-parseable |
| Python | structlog | Structured JSON output, composable processors |

**Agent pattern:** Agents should grep JSON logs by correlation ID or error level to self-diagnose:
```bash
# Agent searches for errors in structured logs
cat app.log | jq 'select(.level >= 50)'       # Pino errors
cat app.log | jq 'select(.event == "error")'   # structlog errors
```

#### 6. IMPORTANT — GitHub CLI for CI Checks
```bash
# Check if gh is available
gh --version

# Agent self-verification after pushing
gh pr checks                           # Check CI status
gh run view --log-failed               # Read failure logs
gh run list --json status,conclusion   # JSON for parsing
```

#### 7. NICE-TO-HAVE — Security Scanning
| Existing | Recommendation |
|----------|---------------|
| Nothing | `npm audit --json` (free, built-in) |
| npm audit | Keep (suggest Snyk for upgrade) |
| Dependabot enabled | Skip (already covered) |
| Snyk | Already good |

#### 8. NICE-TO-HAVE — Static Analysis
- **Semgrep** — 50-100x faster than SonarQube, custom YAML rules, autofix
- Only recommend for larger codebases or security-sensitive projects

#### 9. NICE-TO-HAVE — Test Coverage
```bash
# Vitest built-in
npx vitest --coverage --reporter=json

# Standalone
npx c8 --reporter=json npm test
```

#### 10. NICE-TO-HAVE — Visual Regression
Only if Storybook or component library detected:
- **Chromatic** (Storybook integration)
- **Percy** (CI/CD flows)

### Report Output Format

Markdown with priority sections. Example:

```markdown
# agent-dx Report

## Project: my-app
- **Language:** TypeScript
- **Framework:** React + Next.js
- **Runtime:** Node 20.x
- **Monorepo:** No

## Existing Tools
| Category | Tool | Status |
|----------|------|--------|
| Testing | None | Missing |
| Linting | ESLint 8.x | Installed |
| Type Checking | TypeScript 5.x | Installed (no check script) |
| E2E | None | Missing |
| Logging | None | Missing |
| Security | None | Missing |

## Recommendations

### Critical

**1. Add unit testing (Vitest)**
```bash
npm install -D vitest @vitest/ui
```
Add to package.json scripts:
```json
"test": "vitest --run",
"test:watch": "vitest"
```
Agent command: `npx vitest --reporter=json --run`

**2. Add typecheck script**
Add to package.json scripts:
```json
"typecheck": "tsc --noEmit"
```
Agent command: `npx tsc --noEmit --pretty false`

### Important

**3. Add E2E testing (Playwright)**
```bash
npm install -D @playwright/test
npx playwright install chromium
```
Agent command: `npx playwright test --reporter=json`

**4. Add structured logging (Pino)**
```bash
npm install pino
```

### Nice-to-Have

**5. Add security scanning**
Agent command: `npm audit --json`

**6. Verify GitHub CLI**
Agent command: `gh pr checks`
```

### Tool Conflict Strategy

When existing tools overlap with recommendations:
- **Never suggest replacing** — respect existing choices
- **Note faster alternatives** as FYI (e.g., "Vitest is 10-20x faster than Jest" as a footnote)
- **Fill gaps only** — if ESLint exists but no type checker, recommend tsc, don't push Biome
- **Complement, don't compete** — recommend tools that fill different categories

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `package.json` or manifest | Detect language from file extensions, give generic recommendations |
| Python project | Switch to Python tool matrix (pytest, Ruff, Pyright, structlog) |
| Monorepo | Detect workspaces, analyze root + each workspace, note shared vs per-workspace config |
| Electron app | Flag dual-runtime (Node + Chromium), recommend agent-browser via CDP + Playwright Electron |
| Empty repo | Minimal report: "Add a package manager first" |
| Private/corporate env | Don't assume registry access; give commands, agent handles failures |
| Read-only filesystem | Report-only by design, no writes |

## Implementation Phases

### Phase 1: Core Skill (MVP)

**Deliverables:**
- `skills/agent-dx/SKILL.md` — Main skill with detection logic and report template
- `skills/agent-dx/references/tool-matrix.md` — Tool recommendations per language/framework

**Scope:**
- JS/TS detection (package.json parsing)
- Python detection (pyproject.toml/requirements.txt)
- Existing tool scanning (devDeps + config files)
- Markdown report with Critical + Important categories
- Tool conflict handling (complement, don't replace)

**Success criteria:**
- Run on a bare React project → recommends Vitest, Playwright, tsc script, Pino
- Run on a mature project with Jest+ESLint → identifies gaps only (E2E, logging, security)
- Run on a Python project → recommends pytest, Ruff, Pyright

### Phase 2: Extended Coverage

**Deliverables:**
- `skills/agent-dx/references/agent-commands.md` — Agent-optimized commands with JSON flags
- Electron/desktop app detection and recommendations
- CI/CD analysis (scan `.github/workflows/` for existing checks)
- Monorepo support (per-workspace analysis)
- Nice-to-have categories (security, static analysis, coverage, visual regression)

**Success criteria:**
- Run on Electron app → recommends agent-browser via CDP
- Run on monorepo → per-workspace report
- Detects existing GitHub Actions CI steps and doesn't duplicate

### Phase 3: Polish

**Deliverables:**
- Heuristics for visual regression (only if UI components detected)
- Version compatibility warnings (e.g., "Vitest requires Node 18+")
- Quick-start config snippets (vitest.config.ts, biome.json with sensible defaults)
- Score/grade system (A-F agent readiness score)

## References

### Internal
- `skills/seo-audit/SKILL.md` — Audit skill pattern (priority-ordered findings, framework)
- `skills/web-design-guidelines/SKILL.md` — Minimal audit pattern (fetch guidelines, check files, terse output)
- `skills/agent-browser/SKILL.md` — agent-browser snapshot-driven workflow
- `commands/test-browser.md` — E2E testing command pattern (file→route mapping)
- `skills/agent-native-architecture/references/agent-native-testing.md` — Agent testing philosophy
- `skills/create-agent-skills/references/iteration-and-testing.md` — Eval-driven skill development

### External (2026 Research)
- [Vitest vs Jest](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) — 10-20x speed advantage
- [Biome vs ESLint](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/) — 25-56x faster, single binary
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron) — Experimental but functional
- [agent-browser (Vercel)](https://github.com/vercel-labs/agent-browser) — CLI for AI agents, CDP support
- [Pino vs Winston](https://betterstack.com/community/comparisons/pino-vs-winston/) — 5x faster, JSON-native
- [Semgrep vs SonarQube](https://semgrep.dev/docs/faq/comparisons/sonarqube) — 50-100x faster static analysis
- [Pyright vs mypy](https://pyseek.com/2025/05/pyright-vs-mypy-static-type-checking-in-python/) — 3-5x faster
- [TypeScript 6.0 strict default](https://github.com/microsoft/TypeScript/issues/62333)

## Unresolved Questions

1. **Should Phase 3 include an "action mode"** where agent-dx can auto-install tools with user permission? (Current plan is report-only.)
2. **Should we add a `--quick` flag** that only reports Critical items? Or keep one mode?
3. **Rust/Go support** — worth adding in Phase 1 or defer? (Current plan: JS/TS + Python only for MVP.)
