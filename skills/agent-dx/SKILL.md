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
bun.lockb / bun.lock            # Bun runtime
pnpm-lock.yaml                  # pnpm
yarn.lock                       # Yarn
package-lock.json               # npm
pyproject.toml                  # Python: deps, tools
requirements.txt                # Python: deps
setup.py / setup.cfg            # Python: legacy
Cargo.toml                      # Rust
go.mod                          # Go
.github/workflows/*.yml         # CI configuration
CLAUDE.md                       # Project-level agent context
~/.claude/CLAUDE.md             # Global agent context
```

**Determine language:**
- `package.json` exists → JS/TS
- `pyproject.toml` or `requirements.txt` or `setup.py` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- No manifest → scan file extensions as fallback

**Determine package manager / runtime** (JS/TS only):
- `bun.lockb` or `bun.lock` exists → already using Bun
- `pnpm-lock.yaml` exists → already using pnpm
- `yarn.lock` exists → already using Yarn
- `package-lock.json` exists → already using npm
- None of the above → recommend **Bun** (fastest runtime, built-in test runner, native TS)

**Bun recommendation rationale:** Bun is the default recommendation for new JS/TS projects. It's faster than Node for installs, has a built-in test runner (`bun test`), native TypeScript execution (no build step), and a built-in bundler. If the user already uses pnpm/yarn/npm, respect that — don't push migration. Just note Bun as an FYI.

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

## Step 2b: Audit CLAUDE.md Files

Check for agent context files at two levels:

**Project-level:** `CLAUDE.md` in the repo root (or `.claude/CLAUDE.md`)
**Global-level:** `~/.claude/CLAUDE.md`

### Project CLAUDE.md

Check if it exists. If it does, scan for these sections (doesn't need to match exactly — just check if the topics are covered):

| Topic | Why it matters for agents |
|-------|--------------------------|
| Project description / purpose | Agent understands what it's building |
| Tech stack / key dependencies | Agent picks the right tools and patterns |
| How to run the project (dev server, build) | Agent can test its changes |
| How to run tests | Agent knows the test command |
| How to lint / type check | Agent knows the verification commands |
| Code conventions / patterns | Agent follows the team's style |
| Directory structure overview | Agent finds files faster |
| Common gotchas / things to avoid | Agent avoids known pitfalls |

If project CLAUDE.md is missing, recommend creating one. If it exists but is thin, note which topics above are missing.

**Recommendation template for project CLAUDE.md:**
```markdown
# [Project Name]

[One-line description of what this project does]

## Tech Stack
- Runtime: [Bun / Node / Python / etc.]
- Framework: [React / Next / Django / etc.]
- Database: [Postgres / SQLite / etc.]

## Development
- `bun install` — install dependencies
- `bun dev` — start dev server
- `bun test` — run tests
- `bun run lint` — lint code
- `bun run typecheck` — type check

## Code Conventions
- [Key patterns, naming conventions, directory layout rules]

## Things to Avoid
- [Known pitfalls, deprecated patterns, etc.]
```

### Global CLAUDE.md

Check if `~/.claude/CLAUDE.md` exists. This gives agents personal context about the developer that applies across all projects.

If missing, recommend creating one with:

```markdown
# About Me
- Name: [your name]
- Role: [what you do — e.g., "Full-stack engineer", "Founder at X"]

## Preferences
- Preferred runtime: [Bun / Node / etc.]
- Preferred package manager: [bun / pnpm / npm / etc.]
- Code style: [terse vs verbose, functional vs OOP, etc.]
- Communication style: [brief vs detailed responses]

## Current Projects
- [Project 1]: [one-line context]
- [Project 2]: [one-line context]

## General Instructions
- [Anything agents should always do or never do across all your projects]
```

The global file is especially useful for things like: "I use Bun everywhere", "I prefer terse code", "Always use TypeScript strict mode" — context that agents otherwise have to ask about every session.

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

## Agent Context Files
| File | Status | Notes |
|------|--------|-------|
| Project CLAUDE.md | [Exists (good/thin) / Missing] | [what topics are covered or missing] |
| Global ~/.claude/CLAUDE.md | [Exists / Missing] | [recommendations if missing] |

## Existing Tools
| Category | Tool | Status |
|----------|------|--------|
| Runtime / Package Manager | [Bun / Node+npm / Node+pnpm / etc.] | [Installed] |
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
[X/12 categories covered — includes CLAUDE.md files and runtime]

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

**Critical** (agents can't operate effectively without these):
1. Project CLAUDE.md — agent needs to know how to run/test/lint the project
2. Unit/integration testing
3. Linting
4. Type checking

**Important** (significantly improves agent effectiveness):
5. Runtime / package manager (recommend Bun for new JS/TS projects)
6. E2E / browser testing (only if frontend/Electron detected)
7. Structured logging
8. GitHub CLI for CI checks
9. Global ~/.claude/CLAUDE.md — agent context about the developer

**Nice-to-Have** (for thorough verification):
10. Security scanning
11. Static analysis (only for larger/security-sensitive codebases)
12. Test coverage
13. Visual regression (only if UI components/Storybook detected)

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
