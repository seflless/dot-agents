---
name: agent-dx
description: Audit a repo's tooling for coding agent self-verification. Use when asked to "audit my repo for agent tools", "what testing tools do I need", "set up verification for agents", "agent developer experience", "agent-dx", "how can agents test this", or when onboarding to a new codebase and want to know what verification tools are missing.
---

# agent-dx — Agent Developer Experience Audit

Analyze a repo and generate a prioritized report of verification tools coding agents need to self-check their work. Report-only — recommends tools and commands, does not auto-install.

## How It Works

1. Detect project language, framework, and runtime
2. Scan for existing verification tools
3. Generate a Markdown report with prioritized recommendations
4. Include copy-paste install commands and agent-friendly run commands

## Step 1: Detect Project Context

Read these files to understand the project:

```
package.json                    # JS/TS: deps, devDeps, scripts, workspaces
tsconfig.json                   # TypeScript config
pyproject.toml                  # Python: deps, tools
requirements.txt                # Python: deps
setup.py / setup.cfg            # Python: legacy
Cargo.toml                      # Rust
go.mod                          # Go
.github/workflows/*.yml         # CI configuration
```

**Determine language:**
- `package.json` exists → JS/TS
- `pyproject.toml` or `requirements.txt` or `setup.py` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- No manifest → scan file extensions as fallback

**Determine framework** (from dependencies):
- `electron` → Electron (dual runtime: Node + Chromium)
- `react` → React
- `next` → Next.js
- `vue` → Vue
- `svelte` → Svelte
- `express` / `fastify` / `koa` → Node API server
- `django` / `flask` / `fastapi` → Python web framework

**Determine monorepo:**
- `workspaces` field in `package.json`
- `pnpm-workspace.yaml` exists
- `lerna.json` exists
- `nx.json` exists
- `turbo.json` exists

If monorepo detected, analyze root config + each workspace independently.

## Step 2: Scan Existing Tools

Check `devDependencies` in `package.json` and config files for each category:

| Category | Look for in devDeps | Look for config files |
|----------|--------------------|-----------------------|
| Testing | jest, vitest, mocha, ava, tap | jest.config.*, vitest.config.*, .mocharc.* |
| Linting | eslint, @biomejs/biome, prettier | .eslintrc*, eslint.config.*, biome.json, .prettierrc* |
| Type Checking | typescript | tsconfig.json |
| E2E | @playwright/test, cypress, puppeteer | playwright.config.*, cypress.config.* |
| Logging | pino, winston, bunyan | (check imports in src/) |
| Security | (check CI for audit steps) | .github/dependabot.yml, .snyk |
| Static Analysis | (check CI) | .semgreprc, semgrep.yml |
| Coverage | c8, nyc, istanbul | .nycrc, .c8rc |

For Python, check `pyproject.toml` `[project.optional-dependencies]` or `[tool.*]` sections:

| Category | Look for | Config sections |
|----------|---------|-----------------|
| Testing | pytest | [tool.pytest] |
| Linting | ruff, flake8, black | [tool.ruff], [tool.black] |
| Type Checking | mypy, pyright | [tool.mypy], pyrightconfig.json |
| Logging | structlog | (check imports) |

Also check `package.json` scripts for: `test`, `lint`, `typecheck`, `e2e`, `format`, `check`.

Also scan `.github/workflows/` YAML files for CI steps that run linting, testing, or security scans.

## Step 3: Generate Report

Use the tool-matrix reference (`references/tool-matrix.md`) for recommendations per stack.
Use the agent-commands reference (`references/agent-commands.md`) for agent-optimized commands.

### Report Template

```markdown
# agent-dx Report

## Project Context
- **Language:** [detected language]
- **Framework:** [detected framework(s)]
- **Runtime:** [Node version / Python version if detectable]
- **Monorepo:** [Yes (tool) / No]
- **Package Manager:** [npm / yarn / pnpm / pip / poetry]

## Existing Tools
| Category | Tool | Status |
|----------|------|--------|
| Unit Testing | [tool or None] | [Installed / Missing] |
| Linting | [tool or None] | [Installed / Missing] |
| Type Checking | [tool or None] | [Installed / Missing] |
| E2E Testing | [tool or None] | [Installed / Missing / N/A] |
| Structured Logging | [tool or None] | [Installed / Missing] |
| GitHub CLI | [available?] | [Installed / Missing] |
| Security Scanning | [tool or None] | [Installed / Missing] |
| Static Analysis | [tool or None] | [Installed / Missing / N/A] |
| Test Coverage | [tool or None] | [Installed / Missing] |
| Visual Regression | [tool or None] | [Installed / Missing / N/A] |

## Agent Readiness Score
[X/10 categories covered]

## Recommendations

### Critical (agents can't self-verify without these)

[Only list categories marked Missing from the table above]

**[N]. [Category] — [Recommended tool]**
Install:
```[lang]
[install command]
```
Add to scripts:
```json
[script entries if applicable]
```
Agent verification command:
```bash
[command with JSON output flag]
```

### Important (significantly improves agent effectiveness)

[Same format, for Important-tier missing tools]

### Nice-to-Have (for thorough verification)

[Same format, for Nice-to-Have-tier missing tools]

## Agent Cheat Sheet
Quick reference of all verification commands for this project:
```bash
[list all run commands, both existing and newly recommended]
```
```

### Priority Tiers

**Critical** (agents can't self-verify without these):
1. Unit/integration testing
2. Linting
3. Type checking

**Important** (significantly improves agent effectiveness):
4. E2E / browser testing (only if frontend/Electron detected)
5. Structured logging
6. GitHub CLI for CI checks

**Nice-to-Have** (for thorough verification):
7. Security scanning
8. Static analysis (only for larger/security-sensitive codebases)
9. Test coverage
10. Visual regression (only if UI components/Storybook detected)

## Tool Conflict Strategy

When an existing tool overlaps with what you'd recommend:
- **Never suggest replacing** an existing tool — respect the team's choices
- **Note faster alternatives** as an FYI footnote only (e.g., "FYI: Vitest is 10-20x faster than Jest for future consideration")
- **Fill gaps only** — if ESLint exists but no type checker, recommend tsc, don't push Biome
- **Complement, don't compete** — recommend tools from different categories, not same-category alternatives

## Edge Cases

| Scenario | What to do |
|----------|-----------|
| No manifest file (no package.json, no pyproject.toml) | Scan file extensions, give generic recs, note "add a package manager first" |
| Empty repo | Report: "No source code detected. Set up your project first." |
| Monorepo | Report per workspace + root-level summary. Note monorepo orchestrator if missing (Turborepo/Nx). |
| Electron app | Flag dual-runtime. Recommend agent-browser via CDP for Electron window + standard testing for Node. |
| Python project | Switch entirely to Python tool matrix (pytest, Ruff, Pyright, structlog). |
| Rust/Go project | Give basic recs (cargo test/clippy or go test/golangci-lint). Note: full support is JS/TS + Python focused. |
| All tools already installed | Congratulatory report. Check for missing agent-friendly flags (JSON output). Suggest agent cheat sheet. |
| CI already runs checks | Note which checks CI covers. Only recommend tools not in CI. |

## Output

Print the full Markdown report directly to the user. Do not write it to a file unless asked.
