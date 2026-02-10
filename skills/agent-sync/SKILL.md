---
name: agent-sync
description: Syncs coding agent config files so AGENTS.md is source of truth and CLAUDE.md/instructions.md are symlinks. Ensures skills and commands are shared across Claude, Codex, Cursor, and opencode. Use when adding skills, commands, or modifying agent config.
---

# Agent Sync

Ensures all coding agent configuration files are properly symlinked with `~/.agents/` as the single source of truth. Supports Claude Code, Codex, Cursor, and opencode.

## What it does

**Global level** (`~/.agents/` → tool-specific dirs):
- `~/.claude/CLAUDE.md` → `~/.agents/AGENTS.md`
- `~/.claude/skills/` → `~/.agents/skills/`
- `~/.claude/commands/` → `~/.agents/commands/`
- `~/.codex/instructions.md` → `~/.agents/AGENTS.md`
- `~/.codex/skills/` — symlinks for each skill in `~/.agents/skills/`
- `~/.opencode/` — same pattern

**Project level** (current repo):
- `CLAUDE.md` becomes a symlink to `AGENTS.md` (AGENTS.md is source of truth)
- Scans all nested directories for non-symlinked CLAUDE.md files and fixes them
- Syncs skills across `.agents/`, `.claude/`, `.codex/`, `.opencode/` dirs in the project

## CLI Usage

```bash
# Run the script from the skill directory
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")" # or use absolute path

# Fix everything (global + current project) — default behavior
bash /path/to/skills/agent-sync/scripts/sync.sh

# Fix only global agent dirs
bash /path/to/skills/agent-sync/scripts/sync.sh --global

# Fix only a specific project
bash /path/to/skills/agent-sync/scripts/sync.sh --project /path/to/project

# Preview changes without applying
bash /path/to/skills/agent-sync/scripts/sync.sh --dry-run

# Combine flags
bash /path/to/skills/agent-sync/scripts/sync.sh --global --dry-run
```

## When to use

Run this after:
- Adding or removing a skill
- Adding or removing a command
- Modifying AGENTS.md or CLAUDE.md
- Setting up a new project
- Installing a new coding agent tool

## Auto-trigger

You can wire this to git hooks for automatic syncing:
```bash
# .git/hooks/pre-commit
bash ~/.agents/skills/agent-sync/scripts/sync.sh --global
```
