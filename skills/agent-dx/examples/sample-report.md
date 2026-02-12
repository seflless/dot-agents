# agent-dx Report

## Agent Summary
```yaml
missing_critical: [linting, type-checking]
missing_important: [e2e-testing, structured-logging]
existing_tools: {runtime: bun, unit-testing: vitest, security: npm-audit}
readiness_score: 7/12
```

## Project Context
- **Language:** TypeScript
- **Framework:** Next.js 14
- **Runtime:** Bun 1.1.x
- **Monorepo:** No
- **Package Manager:** Bun

## Agent Context Files
| File | Status | Notes |
|------|--------|-------|
| Project CLAUDE.md | Exists (thin) | Missing: code conventions, directory structure, gotchas |
| Global ~/.claude/CLAUDE.md | Exists | Has preferences and current projects |

## Existing Tools
| Category | Tool | Status |
|----------|------|--------|
| Runtime / Package Manager | Bun | Installed |
| Unit Testing | Vitest | Installed |
| Linting | None | Missing |
| Type Checking | None (has tsconfig but no check script) | Missing |
| E2E Testing | None | Missing |
| Structured Logging | None | Missing |
| GitHub CLI | gh | Installed |
| Security Scanning | npm audit | Installed |
| Static Analysis | None | N/A (small codebase) |
| Test Coverage | @vitest/coverage-v8 | Installed |
| Visual Regression | None | N/A (no Storybook) |

## Agent Readiness Score
7/12 categories covered

## Recommendations

### Critical (agents can't self-verify without these)

**1. Linting -- Biome**
Install:
```bash
bun add -D @biomejs/biome
```
Add to scripts:
```json
"lint": "biome check .",
"lint:fix": "biome check --write ."
```
Agent verification command:
```bash
bunx biome check . 2>&1
```

**2. Type Checking -- add tsc script**
Add to scripts:
```json
"typecheck": "tsc --noEmit"
```
Agent verification command:
```bash
bunx tsc --noEmit 2>&1
```

### Important (significantly improves agent effectiveness)

**3. E2E Testing -- Playwright**
Install:
```bash
bun add -D @playwright/test && bunx playwright install chromium
```
Add to scripts:
```json
"e2e": "playwright test"
```
Agent verification command:
```bash
bunx playwright test --reporter=json 2>&1
```

**4. Structured Logging -- Pino**
Install:
```bash
bun add pino
```
Agent verification command:
```bash
# Logs are JSON by default, agents can parse stdout directly
```

**5. Project CLAUDE.md -- expand thin sections**
Add these missing topics:
- Code conventions / patterns
- Directory structure overview
- Common gotchas / things to avoid

### Nice-to-Have (for thorough verification)

No additional recommendations at this tier.

## Agent Cheat Sheet
Quick reference of all verification commands for this project:
```bash
bun test                    # unit tests (vitest)
bunx biome check .          # lint (after install)
bunx tsc --noEmit           # type check (after adding script)
bunx playwright test        # e2e (after install)
bun run dev                 # dev server
bun run build               # production build
```
