---
name: agent-dx
version: 1.0.0
description: Audit a repo's tooling for coding agent self-verification. Use when the user wants to audit agent tooling, mentions "agent-dx", "agent developer experience", "what testing tools do I need", "set up verification for agents", "how can agents test this", or when onboarding to a new codebase and want to know what verification tools are missing.
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
- None of the above → recommend **Bun** (see `references/tool-matrix.md` for rationale)

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

Use `references/tool-matrix.md` for the full lookup table of tools per language.

For each category in the tool matrix:
1. Check `devDependencies` in `package.json` (JS/TS) or `pyproject.toml` `[tool.*]` sections (Python)
2. Check for config files (e.g., `vitest.config.*`, `tsconfig.json`, `biome.json`)
3. Check `package.json` scripts for: `test`, `lint`, `typecheck`, `e2e`, `format`, `check`
4. **Scan `.github/workflows/*.yml` for CI steps** — if a tool already runs in CI, mark it as "CI-covered" not "Missing". Only recommend tools not already covered by CI.

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

If project CLAUDE.md is missing, recommend creating one. If it exists but is **thin** (missing 3+ of the 8 topics above, or any topic covered in fewer than 50 words), note which topics are missing.

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

## Step 2c: Verify Detection

Spot-check findings before reporting. For each tool marked "Installed", confirm it actually runs:
- JS/TS: `bunx vitest --version`, `bunx biome --version`, `tsc --version`
- Python: `pytest --version`, `ruff --version`, `pyright --version`
- Rust: `cargo clippy --version`
- Go: `golangci-lint --version`

If a command fails, downgrade that tool's status from "Installed" to "Not found (listed in deps but not runnable)".

## Step 3: Generate Report

Use the tool-matrix reference (`references/tool-matrix.md`) for recommendations per stack.
Use the agent-commands reference (`references/agent-commands.md`) for agent-optimized commands.

### Report Template

```markdown
# agent-dx Report

## Agent Summary
```yaml
missing_critical: [list of missing critical-tier tools]
missing_important: [list of missing important-tier tools]
existing_tools: {category: tool, ...}
readiness_score: X/12
```

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

## Output

Print the full Markdown report directly to the user. Do not write it to a file unless asked.
