# Agent Skills

Backup of my `~/.agents` folder — a unified location for agent configurations and customizations.

## Install a skill

```bash
npx skills add seflless/dot-agents
```

## Purpose

The `.agents` directory is emerging as a standard for storing agent-related configurations that work across multiple AI tools. This repo keeps it version-controlled and portable.

## Current Contents

- **Skills** — Custom skills (e.g., via Vercel's skills package) installed here and referenced by various agents

## How It Works

1. Install skills to `~/.agents/`
2. Configure agents to point to this shared location
3. All agents get access to the same customizations

## Future

May expand to include other cross-agent configurations as the ecosystem evolves.
