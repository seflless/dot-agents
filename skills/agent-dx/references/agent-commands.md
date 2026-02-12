# Agent-Optimized Commands

Commands tuned for coding agents: JSON output, parseable errors, fast feedback. Use these in the "Agent Cheat Sheet" section of the report.

## JavaScript / TypeScript

### Unit Testing (Vitest)
```bash
# Run all tests, JSON output for parsing
npx vitest --reporter=json --run

# Run tests matching pattern
npx vitest --reporter=json --run "auth"

# Watch mode for iterative development
npx vitest --watch

# With coverage
npx vitest --coverage --reporter=json --run
```

### Unit Testing (Jest)
```bash
# Run all tests, JSON output
npx jest --json --outputFile=test-results.json

# Run tests matching pattern
npx jest --json "auth"

# Watch mode
npx jest --watch
```

### Linting (Biome)
```bash
# Check all files, JSON output
npx @biomejs/biome check --reporter=json .

# Auto-fix all fixable issues
npx @biomejs/biome check --write .

# Check specific file
npx @biomejs/biome check --reporter=json src/index.ts
```

### Linting (ESLint)
```bash
# Check all files, JSON output
npx eslint --format json .

# Auto-fix
npx eslint --fix .

# Check specific file
npx eslint --format json src/index.ts
```

### Type Checking (TypeScript)
```bash
# Type check only (no emit), parseable output
npx tsc --noEmit --pretty false

# Type check with error count
npx tsc --noEmit --pretty false 2>&1 | tail -1
```

### E2E Testing (Playwright)
```bash
# Run all E2E tests, JSON output
npx playwright test --reporter=json

# Run specific test file
npx playwright test tests/login.spec.ts --reporter=json

# Run with visible browser (debugging)
npx playwright test --headed

# Generate test from recording
npx playwright codegen http://localhost:3000
```

### E2E Testing (agent-browser)
```bash
# Open a page
agent-browser open http://localhost:3000

# Get interactive elements (snapshot)
agent-browser snapshot -i --json

# Click element by ref
agent-browser click @e1

# Fill input
agent-browser fill @e2 "test@example.com"

# Take screenshot
agent-browser screenshot output.png

# Connect to Electron via CDP
agent-browser connect 9222

# Close session
agent-browser close
```

### Structured Logging (Pino) — Reading Logs
```bash
# Filter errors from Pino JSON logs
cat app.log | jq 'select(.level >= 50)'

# Filter by message pattern
cat app.log | jq 'select(.msg | test("error|fail"; "i"))'

# Last N log entries
tail -n 100 app.log | jq '.'

# Pretty-print with pino-pretty
cat app.log | npx pino-pretty
```

### Security Scanning
```bash
# npm audit with JSON output
npm audit --json

# Only production dependencies
npm audit --json --omit=dev

# Fix automatically where possible
npm audit fix
```

### Test Coverage
```bash
# Vitest coverage
npx vitest --coverage --reporter=json --run

# c8 standalone
npx c8 --reporter=json npm test

# View coverage summary
npx c8 report --reporter=text
```

### Static Analysis (Semgrep)
```bash
# Run with auto config
semgrep --config auto --json .

# Run specific ruleset
semgrep --config p/javascript --json .

# Security-focused scan
semgrep --config p/security-audit --json .
```

---

## Python

### Unit Testing (pytest)
```bash
# Run all tests, short traceback
python -m pytest --tb=short -q

# JSON output (requires pytest-json-report)
python -m pytest --json-report --json-report-file=test-results.json

# Run tests matching pattern
python -m pytest -k "test_auth" --tb=short

# With coverage
python -m pytest --cov --cov-report=json

# Verbose single file
python -m pytest tests/test_auth.py -v
```

### Linting (Ruff)
```bash
# Check all files, JSON output
ruff check --output-format=json .

# Auto-fix
ruff check --fix .

# Format check
ruff format --check .

# Format fix
ruff format .
```

### Type Checking (Pyright)
```bash
# Full check, JSON output
pyright --outputjson

# Check specific file
pyright --outputjson src/main.py
```

### Type Checking (mypy)
```bash
# Check with parseable output
mypy --no-error-summary --show-column-numbers .

# Check specific file
mypy src/main.py
```

### Structured Logging (structlog) — Reading Logs
```bash
# Filter errors from structlog JSON logs
cat app.log | jq 'select(.level == "error")'

# Filter by event name
cat app.log | jq 'select(.event | test("fail"; "i"))'

# Last N entries
tail -n 100 app.log | jq '.'
```

### Security Scanning
```bash
# pip-audit with JSON output
pip-audit --format=json

# Check specific requirements file
pip-audit -r requirements.txt --format=json
```

### Test Coverage
```bash
# With pytest-cov
python -m pytest --cov --cov-report=json

# View summary
python -m pytest --cov --cov-report=term-missing
```

---

## GitHub CLI (All Stacks)

```bash
# Check if gh is installed
gh --version

# View CI status for current PR
gh pr checks

# Get checks as JSON
gh pr view --json statusCheckRollup

# View failed run logs
gh run view --log-failed

# List recent workflow runs (JSON)
gh run list --json status,conclusion,name --limit 5

# Trigger a workflow manually
gh workflow run <workflow-name>

# View PR status
gh pr status

# Create PR
gh pr create --title "feat: description" --body "Summary"
```

---

## Rust

```bash
# Test with JSON output (nightly)
cargo test -- --format json

# Clippy linting
cargo clippy --message-format=json -- -D warnings

# Format check
cargo fmt --check

# Security audit
cargo audit --json
```

## Go

```bash
# Test with JSON output
go test -json ./...

# Lint
golangci-lint run --out-format json

# Format check (list unformatted files)
gofmt -l .

# Security scan
govulncheck -json ./...
```

---

## Universal Patterns

### Agent Feedback Loop
After making changes, agents should run this sequence:
```bash
# 1. Type check (fastest signal)
[typecheck command]

# 2. Lint (fast signal)
[lint command]

# 3. Unit tests (medium signal)
[test command]

# 4. E2E tests (slow but thorough, if applicable)
[e2e command]
```

Run in this order because type check and lint are fast (< 5 seconds) and catch most issues before slower tests run.

### JSON Output Priority
Always prefer JSON output flags when available:
- Agents can parse structured output reliably
- Error locations (file:line) are extractable
- Exit codes indicate pass/fail

### Log Searching Pattern
When debugging failures, agents should:
```bash
# 1. Check for errors in logs
cat [logfile] | jq 'select(.level >= 50 or .level == "error")'

# 2. Search by correlation ID
cat [logfile] | jq 'select(.correlationId == "abc-123")'

# 3. Search by timestamp range
cat [logfile] | jq 'select(.time >= 1700000000000 and .time <= 1700000060000)'
```
