# Tool Recommendation Matrix

> Last Updated: 2026-02-12

Recommendations per language/framework. For each tool: what to install, why, and what it replaces.

## Runtime / Package Manager (JS/TS)

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No lockfile detected | **Bun** | `curl -fsSL https://bun.sh/install \| bash` | Fastest runtime, built-in TS, built-in test runner, built-in bundler |
| Has `bun.lockb` / `bun.lock` | Already using Bun | — | Already good |
| Has `pnpm-lock.yaml` | Keep pnpm | — | Respect existing choice. Pnpm is solid. |
| Has `yarn.lock` | Keep Yarn | — | Note: Bun is faster for future consideration |
| Has `package-lock.json` | Keep npm | — | Note: Bun is faster for future consideration |

**Why Bun as default:** Bun is the fastest JS/TS runtime. `bun install` is 10-100x faster than npm. Native TypeScript execution (no build step needed). Built-in test runner (`bun test`) means one less devDependency. Built-in bundler. If the team already uses pnpm/yarn/npm, don't push migration — just note it.

**Bun equivalents:**
```bash
bun install          # instead of npm install
bun test             # instead of npx vitest (built-in, Jest-compatible)
bun run dev          # instead of npm run dev
bunx biome check .   # instead of npx biome check .
```

---

## JavaScript / TypeScript

### Unit Testing

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No test framework | **Vitest** | `bun add -D vitest` (or `npm install -D vitest`) | 10-20x faster than Jest, native ESM/TS, 97% Jest-compatible |
| Has Jest | Keep Jest | — | Note: Vitest is faster for future consideration |
| Has Vitest | Already good | — | — |
| Has Mocha | Keep Mocha | — | Suggest Vitest if migrating |

Scripts to add:
```json
"test": "vitest --run",
"test:watch": "vitest"
```

### Linting

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No linter | **Biome** | `npm install -D @biomejs/biome` | 25-56x faster than ESLint, linting + formatting in one binary |
| Has ESLint | Keep ESLint | — | Note: Biome is faster for future consideration |
| Has Biome | Already good | — | — |
| Has ESLint + Prettier | Keep both | — | Biome can replace both, but don't push migration |

Scripts to add:
```json
"lint": "biome check .",
"lint:fix": "biome check --write ."
```

If ESLint exists, suggest adding `--format json` flag for agent parsing.

### Type Checking

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No TypeScript | **Add TypeScript** | `npm install -D typescript` | Catches errors before runtime, essential for agent signal |
| Has TS, no check script | Add script | — | Agent needs a command to run |
| Has TS + check script | Already good | — | — |

Scripts to add:
```json
"typecheck": "tsc --noEmit"
```

Recommended tsconfig additions for strong signal:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### E2E / Browser Testing

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Web app, no E2E | **Playwright** | `npm install -D @playwright/test && npx playwright install chromium` | Fastest E2E framework, auto-waiting, multi-browser |
| Electron app, no E2E | **agent-browser** (via CDP) | See agent-browser skill | Purpose-built for agents, snapshot-driven, stable refs |
| Has Playwright | Already good | — | — |
| Has Cypress | Keep Cypress | — | Note: Playwright is 2x faster for future consideration |
| API only (no frontend) | **Skip** | — | E2E not applicable |

### Structured Logging

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No logging library | **Pino** | `npm install pino` | 5x faster than Winston, JSON by default, agent-parseable |
| Has Winston | Keep Winston | — | Already structured if configured for JSON |
| Has Pino | Already good | — | — |
| Has console.log only | **Pino** | `npm install pino` | console.log is unstructured, agents can't parse it reliably |

### Security Scanning

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Nothing | **npm audit** | Built-in | Free, zero setup |
| Has Dependabot | Already covered | — | Skip |
| Has Snyk | Already good | — | — |
| Has npm audit only | Keep | — | Suggest Snyk for upgrade path |

### Static Analysis

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Large/security-sensitive codebase | **Semgrep** | `pip install semgrep` or `brew install semgrep` | 50-100x faster than SonarQube, custom rules |
| Small codebase | **Skip** | — | Linter is sufficient |
| Has SonarQube | Keep | — | — |
| Has Semgrep | Already good | — | — |

### Test Coverage

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Uses Vitest | Built-in | `npm install -D @vitest/coverage-v8` | `vitest --coverage` just works |
| Uses Jest | Built-in | — | `jest --coverage` just works |
| Other test runner | **c8** | `npm install -D c8` | V8 native coverage, no instrumentation overhead |

### Visual Regression

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Has Storybook | **Chromatic** | `npm install -D chromatic` | Deep Storybook integration, auto-converts stories to visual tests |
| Has UI components, no Storybook | **Percy** or screenshots | — | CI visual diff |
| No UI / API only | **Skip** | — | Not applicable |

---

## Python

### Unit Testing

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No test framework | **pytest** | `pip install pytest` | Industry standard, clear output, fixture system |
| Has pytest | Already good | — | — |
| Has unittest only | **pytest** | `pip install pytest` | pytest runs unittest tests too, better output |

### Linting

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No linter | **Ruff** | `pip install ruff` | 10-100x faster than Flake8, linting + formatting |
| Has Flake8 | Keep or migrate to Ruff | — | Ruff is drop-in replacement for Flake8 |
| Has Ruff | Already good | — | — |
| Has Black (formatter only) | Add **Ruff** for linting | `pip install ruff` | Ruff can replace both Black and Flake8 |

### Type Checking

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No type checker | **Pyright** | `pip install pyright` | 3-5x faster than mypy, better inference |
| Has mypy | Keep mypy | — | Note: Pyright is faster for future consideration |
| Has Pyright | Already good | — | — |

### E2E / Browser Testing

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Web app (Django/Flask/FastAPI) | **Playwright** | `pip install playwright && playwright install chromium` | Python bindings, same speed as JS version |
| API only | **Skip** | — | Use pytest for API testing directly |

### Structured Logging

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No structured logging | **structlog** | `pip install structlog` | JSON output, composable processors, agent-parseable |
| Has logging module only | **structlog** | `pip install structlog` | stdlib logging is unstructured by default |
| Has structlog | Already good | — | — |

### Security Scanning

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| Nothing | **pip-audit** | `pip install pip-audit` | Free, scans for known vulnerabilities |
| Has safety | Keep | — | — |
| Has pip-audit | Already good | — | — |

### Test Coverage

| Scenario | Recommendation | Install | Why |
|----------|---------------|---------|-----|
| No coverage | **pytest-cov** | `pip install pytest-cov` | `pytest --cov` just works |
| Has coverage.py | Already good | — | — |

---

## Rust (Basic Support)

| Category | Recommendation | Command |
|----------|---------------|---------|
| Testing | Built-in | `cargo test` |
| Linting | **Clippy** | `cargo clippy -- -D warnings` |
| Formatting | **rustfmt** | `cargo fmt --check` |
| Security | **cargo-audit** | `cargo install cargo-audit && cargo audit` |

## Go (Basic Support)

| Category | Recommendation | Command |
|----------|---------------|---------|
| Testing | Built-in | `go test ./...` |
| Linting | **golangci-lint** | `golangci-lint run` |
| Formatting | Built-in | `gofmt -l .` |
| Security | **govulncheck** | `go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...` |
