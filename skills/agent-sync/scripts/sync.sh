#!/usr/bin/env bash
set -euo pipefail

# Agent Sync — ensures ~/.agents/ is source of truth for all coding agent configs.
# AGENTS.md is the real file; CLAUDE.md, instructions.md, etc. are symlinks.
# Skills and commands are shared via symlinks across Claude, Codex, and opencode.

AGENTS_HOME="$HOME/.agents"
CLAUDE_HOME="$HOME/.claude"
CODEX_HOME="$HOME/.codex"
OPENCODE_HOME="$HOME/.opencode"

DRY_RUN=false
MODE="all" # all, global, project
PROJECT_PATH=""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

fixed=0
already_ok=0
errors=0

log_ok() {
  echo -e "  ${GREEN}✓${RESET} $1"
  already_ok=$((already_ok + 1))
}

log_fix() {
  echo -e "  ${YELLOW}🔧${RESET} $1"
  fixed=$((fixed + 1))
}

log_err() {
  echo -e "  ${RED}✗${RESET} $1"
  errors=$((errors + 1))
}

log_dry() {
  echo -e "  ${YELLOW}[dry-run]${RESET} would: $1"
  fixed=$((fixed + 1))
}

# --- Helpers ---

ensure_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    if $DRY_RUN; then
      log_dry "mkdir -p $dir"
    else
      mkdir -p "$dir"
      log_fix "created $dir"
    fi
  fi
}

# Make $link a symlink pointing to $target.
# If $link is a regular file, back it up first.
ensure_symlink() {
  local target="$1"
  local link="$2"
  local label="${3:-$link}"

  if [[ -L "$link" ]]; then
    local current
    current="$(readlink "$link")"
    if [[ "$current" == "$target" ]]; then
      log_ok "$label → $target"
      return
    else
      # Symlink exists but points elsewhere
      if $DRY_RUN; then
        log_dry "relink $label → $target (was → $current)"
      else
        rm "$link"
        ln -s "$target" "$link"
        log_fix "relinked $label → $target (was → $current)"
      fi
    fi
  elif [[ -f "$link" ]]; then
    # Regular file — back it up, replace with symlink
    if $DRY_RUN; then
      log_dry "backup $link → ${link}.bak, symlink $label → $target"
    else
      mv "$link" "${link}.bak"
      ln -s "$target" "$link"
      log_fix "backed up $label → ${link}.bak, symlinked → $target"
    fi
  elif [[ -d "$link" && ! -L "$link" ]]; then
    # It's a real directory, not a symlink — back it up
    if $DRY_RUN; then
      log_dry "backup dir $link → ${link}.bak, symlink $label → $target"
    else
      mv "$link" "${link}.bak"
      ln -s "$target" "$link"
      log_fix "backed up dir $label → ${link}.bak, symlinked → $target"
    fi
  else
    # Doesn't exist — create symlink
    if [[ ! -e "$target" && ! -d "$target" ]]; then
      log_err "$label: target $target does not exist"
      return
    fi
    if $DRY_RUN; then
      log_dry "symlink $label → $target"
    else
      ln -s "$target" "$link"
      log_fix "created symlink $label → $target"
    fi
  fi
}

# Ensure each skill in source_dir has a symlink in dest_dir
sync_skills_dir() {
  local source_dir="$1"
  local dest_dir="$2"

  if [[ ! -d "$source_dir" ]]; then
    return
  fi

  ensure_dir "$dest_dir"

  for skill_dir in "$source_dir"/*/; do
    [[ -d "$skill_dir" ]] || continue
    local skill_name
    skill_name="$(basename "$skill_dir")"
    # Skip hidden dirs
    [[ "$skill_name" == .* ]] && continue
    ensure_symlink "$skill_dir" "$dest_dir/$skill_name" "$dest_dir/$skill_name"
  done
}

# Ensure CLAUDE.md is a symlink to AGENTS.md in a given directory.
# If only CLAUDE.md exists, rename it to AGENTS.md first.
fix_agents_md() {
  local dir="$1"
  local agents="$dir/AGENTS.md"
  local claude="$dir/CLAUDE.md"

  if [[ -f "$agents" && ! -L "$agents" ]]; then
    # AGENTS.md exists as real file — make CLAUDE.md a symlink to it
    ensure_symlink "AGENTS.md" "$claude" "$claude"
  elif [[ -f "$claude" && ! -L "$claude" && ! -f "$agents" ]]; then
    # Only CLAUDE.md exists — rename to AGENTS.md, symlink CLAUDE.md
    if $DRY_RUN; then
      log_dry "rename $claude → $agents, then symlink $claude → AGENTS.md"
    else
      mv "$claude" "$agents"
      ln -s "AGENTS.md" "$claude"
      log_fix "renamed $claude → AGENTS.md, symlinked CLAUDE.md → AGENTS.md"
    fi
  elif [[ -L "$claude" ]]; then
    # CLAUDE.md is already a symlink — verify it points to AGENTS.md
    local target
    target="$(readlink "$claude")"
    if [[ "$target" == "AGENTS.md" || "$target" == "$agents" ]]; then
      log_ok "$claude → AGENTS.md"
    else
      if $DRY_RUN; then
        log_dry "relink $claude → AGENTS.md (was → $target)"
      else
        rm "$claude"
        ln -s "AGENTS.md" "$claude"
        log_fix "relinked $claude → AGENTS.md (was → $target)"
      fi
    fi
  fi
}

# --- Global Sync ---

sync_global() {
  echo ""
  echo "=== Global Sync ==="

  if [[ ! -d "$AGENTS_HOME" ]]; then
    log_err "~/.agents/ does not exist. Create it first."
    return
  fi

  echo ""
  echo "--- Claude Code (~/.claude/) ---"
  ensure_dir "$CLAUDE_HOME"
  ensure_symlink "$AGENTS_HOME/AGENTS.md" "$CLAUDE_HOME/CLAUDE.md" "~/.claude/CLAUDE.md"
  ensure_symlink "$AGENTS_HOME/skills" "$CLAUDE_HOME/skills" "~/.claude/skills/"
  ensure_symlink "$AGENTS_HOME/commands" "$CLAUDE_HOME/commands" "~/.claude/commands/"

  echo ""
  echo "--- Codex (~/.codex/) ---"
  ensure_dir "$CODEX_HOME"
  ensure_symlink "$AGENTS_HOME/AGENTS.md" "$CODEX_HOME/instructions.md" "~/.codex/instructions.md"
  sync_skills_dir "$AGENTS_HOME/skills" "$CODEX_HOME/skills"

  echo ""
  echo "--- opencode (~/.opencode/) ---"
  ensure_dir "$OPENCODE_HOME"
  ensure_symlink "$AGENTS_HOME/AGENTS.md" "$OPENCODE_HOME/AGENTS.md" "~/.opencode/AGENTS.md"
  sync_skills_dir "$AGENTS_HOME/skills" "$OPENCODE_HOME/skills"
}

# --- Project Sync ---

sync_project() {
  local project_dir="$1"
  echo ""
  echo "=== Project Sync: $project_dir ==="

  # Fix root-level AGENTS.md / CLAUDE.md
  echo ""
  echo "--- Root agent config ---"
  fix_agents_md "$project_dir"

  # Sync skills across agent subdirectories if they exist
  local project_skills="$project_dir/skills"
  if [[ -d "$project_skills" ]]; then
    echo ""
    echo "--- Project skills sync ---"
    for agent_dir in .agents .claude .codex .opencode; do
      local dest="$project_dir/$agent_dir/skills"
      if [[ -d "$project_dir/$agent_dir" ]]; then
        sync_skills_dir "$project_skills" "$dest"
      fi
    done
  fi

  # Sync commands across agent subdirectories if they exist
  local project_commands="$project_dir/commands"
  if [[ -d "$project_commands" ]]; then
    echo ""
    echo "--- Project commands sync ---"
    for agent_dir in .agents .claude .codex .opencode; do
      local dest="$project_dir/$agent_dir/commands"
      if [[ -d "$project_dir/$agent_dir" ]]; then
        ensure_dir "$dest"
        for cmd_file in "$project_commands"/*; do
          [[ -f "$cmd_file" ]] || continue
          local cmd_name
          cmd_name="$(basename "$cmd_file")"
          ensure_symlink "$cmd_file" "$dest/$cmd_name" "$dest/$cmd_name"
        done
      fi
    done
  fi

  # Deep scan: find all nested CLAUDE.md files that aren't symlinks
  echo ""
  echo "--- Deep scan for non-symlinked CLAUDE.md files ---"
  local found_any=false
  while IFS= read -r -d '' claude_file; do
    found_any=true
    local dir_of
    dir_of="$(dirname "$claude_file")"
    fix_agents_md "$dir_of"
  done < <(find "$project_dir" \
    -maxdepth 6 \
    -name "CLAUDE.md" \
    ! -type l \
    \( \
      -path "*/node_modules/*" -o \
      -path "*/.git/*" -o \
      -path "*/vendor/*" -o \
      -path "*/*.bak/*" -o \
      -path "*/.bun/*" -o \
      -path "*/go/pkg/*" -o \
      -path "*/.local/*" -o \
      -path "*/.cache/*" -o \
      -path "*/.npm/*" -o \
      -path "*/.pnpm/*" -o \
      -path "*/.yarn/*" -o \
      -path "*/.claude/plugins/*" -o \
      -path "*/.claude/projects/*" -o \
      -path "*/.claude/plans/*" -o \
      -path "*/.okiro/*" -o \
      -path "*/.cargo/*" -o \
      -path "*/.rustup/*" -o \
      -path "*/.Trash/*" -o \
      -path "*/Library/*" -o \
      -path "*/.docker/*" -o \
      -path "*/.vscode/*" -o \
      -path "*/.nvm/*" \
    \) -prune -o \
    -name "CLAUDE.md" ! -type l -print0 2>/dev/null)

  if ! $found_any; then
    log_ok "no non-symlinked CLAUDE.md files found"
  fi
}

# --- Parse Args ---

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --global)
      MODE="global"
      shift
      ;;
    --project)
      MODE="project"
      if [[ -n "${2:-}" && "${2:0:1}" != "-" ]]; then
        PROJECT_PATH="$2"
        shift
      fi
      shift
      ;;
    -h|--help)
      echo "Usage: sync.sh [--global] [--project <path>] [--dry-run]"
      echo ""
      echo "  --global       Sync only global agent dirs (~/.claude, ~/.codex, etc.)"
      echo "  --project PATH Sync only the specified project (default: cwd)"
      echo "  --dry-run      Preview changes without applying"
      echo "  No args        Sync both global and current project"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

# --- Main ---

echo "Agent Sync"
if $DRY_RUN; then
  echo "(dry-run mode — no changes will be made)"
fi

if [[ "$MODE" == "all" || "$MODE" == "global" ]]; then
  sync_global
fi

if [[ "$MODE" == "all" || "$MODE" == "project" ]]; then
  local_project="${PROJECT_PATH:-$(pwd)}"
  sync_project "$local_project"
fi

echo ""
echo "=== Summary ==="
echo -e "  ${GREEN}✓ $already_ok already correct${RESET}"
if $DRY_RUN; then
  echo -e "  ${YELLOW}🔧 $fixed would be fixed${RESET}"
else
  echo -e "  ${YELLOW}🔧 $fixed fixed${RESET}"
fi
if [[ $errors -gt 0 ]]; then
  echo -e "  ${RED}✗ $errors errors${RESET}"
fi
