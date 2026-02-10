Run the agent-sync script to ensure all coding agent config files are properly symlinked.

AGENTS.md is the source of truth. CLAUDE.md and other agent-specific files should be symlinks.

Run this command:

```bash
bash "$HOME/.agents/skills/agent-sync/scripts/sync.sh"
```

If running from a project directory and you want to sync just that project:

```bash
bash "$HOME/.agents/skills/agent-sync/scripts/sync.sh" --project .
```
