#!/usr/bin/env node

import { createServer } from "http";
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { collectGitHubData } from "./github-collector.js";
import { collectAgentData } from "./agents-collector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, "..", "web");
const DATA_DIR = join(__dirname, "..", "data");
const CLAUDE_DIR = join(homedir(), ".claude");
const CURSOR_DIR = join(homedir(), ".cursor");
// Default data repo location (can be overridden with --data-repo)
const DEFAULT_DATA_REPO_DIR = join(homedir(), "dev", "self-reflect-data");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Read session conversation
function getSessionConversation(sessionId, source) {
  if (source === "claude-code") {
    // Claude Code conversations are in ~/.claude/projects/*/{sessionId}.jsonl
    const projectsDir = join(CLAUDE_DIR, "projects");
    if (!existsSync(projectsDir)) return null;

    // Search all projects for the session
    for (const project of readdirSync(projectsDir)) {
      const convPath = join(projectsDir, project, `${sessionId}.jsonl`);
      if (existsSync(convPath)) {
        const lines = readFileSync(convPath, "utf-8").trim().split("\n");
        const messages = [];
        const toolResults = new Map(); // tool_use_id -> result

        // First pass: collect tool results
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === "user") {
              const content = entry.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "tool_result") {
                    toolResults.set(block.tool_use_id, {
                      content: block.content,
                      is_error: block.is_error,
                    });
                  }
                }
              }
            }
          } catch {}
        }

        // Second pass: build messages with tool calls
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === "user") {
              const content = entry.message?.content;
              // User text message
              if (typeof content === "string" && content.trim()) {
                messages.push({ role: "user", content });
              }
            } else if (entry.type === "assistant") {
              const content = entry.message?.content;
              if (Array.isArray(content)) {
                // Process each content block
                for (const block of content) {
                  if (block.type === "text" && block.text?.trim()) {
                    messages.push({ role: "assistant", content: block.text });
                  } else if (block.type === "tool_use") {
                    const result = toolResults.get(block.id);
                    messages.push({
                      role: "tool",
                      tool: block.name,
                      toolId: block.id,
                      input: block.input,
                      result: result?.content,
                      isError: result?.is_error,
                    });
                  }
                }
              } else if (content) {
                messages.push({
                  role: "assistant",
                  content:
                    typeof content === "string"
                      ? content
                      : JSON.stringify(content),
                });
              }
            }
          } catch {}
        }

        // Dedupe consecutive identical messages
        const deduped = [];
        for (const msg of messages) {
          const last = deduped[deduped.length - 1];
          if (
            last &&
            last.role === msg.role &&
            last.content === msg.content &&
            last.toolId === msg.toolId
          )
            continue;
          deduped.push(msg);
        }
        return { sessionId, source, messages: deduped };
      }
    }
  } else if (source === "cursor") {
    // Cursor transcripts are in ~/.cursor/projects/*/agent-transcripts/*.txt
    const projectsDir = join(CURSOR_DIR, "projects");
    if (!existsSync(projectsDir)) return null;

    for (const project of readdirSync(projectsDir)) {
      const transcriptPath = join(
        projectsDir,
        project,
        "agent-transcripts",
        `${sessionId}.txt`,
      );
      if (existsSync(transcriptPath)) {
        const content = readFileSync(transcriptPath, "utf-8");
        // Parse cursor transcript format (typically has User: and Assistant: prefixes)
        const messages = [];
        const parts = content.split(/\n(?=(?:User|Human|Assistant|Claude):)/i);
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          if (/^(User|Human):/i.test(trimmed)) {
            messages.push({
              role: "user",
              content: trimmed.replace(/^(User|Human):\s*/i, ""),
            });
          } else if (/^(Assistant|Claude):/i.test(trimmed)) {
            messages.push({
              role: "assistant",
              content: trimmed.replace(/^(Assistant|Claude):\s*/i, ""),
            });
          } else {
            // Unknown format - just add as system
            messages.push({ role: "system", content: trimmed });
          }
        }
        return { sessionId, source, messages };
      }
    }
  }
  return null;
}

function parseArgs(args) {
  const result = { command: args[0], subcommand: args[1], options: {} };
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value =
        args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
      result.options[key] = value;
    }
  }
  return result;
}

function serve(startPort = 3000, dataRepoDir = null) {
  // Try data repo first, then fall back to local data/
  function getDataFile(subpath) {
    if (dataRepoDir) {
      const repoFile = join(dataRepoDir, subpath);
      if (existsSync(repoFile)) return repoFile;
    }
    return join(DATA_DIR, subpath);
  }

  function createHandler() {
    return (req, res) => {
      let url = req.url === "/" ? "/index.html" : req.url;

      // API endpoints
      if (url.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");

        if (url === "/api/github") {
          const dataFile = getDataFile("github/contributions.json");
          if (existsSync(dataFile)) {
            res.end(readFileSync(dataFile));
          } else {
            res.statusCode = 404;
            res.end(
              JSON.stringify({
                error: "No data. Run: node scripts/cli.js sync",
              }),
            );
          }
          return;
        }

        if (url === "/api/agents") {
          const dataFile = getDataFile("agents/sessions.json");
          if (existsSync(dataFile)) {
            res.end(readFileSync(dataFile));
          } else {
            res.statusCode = 404;
            res.end(
              JSON.stringify({
                error: "No data. Run: node scripts/cli.js sync",
              }),
            );
          }
          return;
        }

        // Session conversation endpoint: /api/session/:id?source=claude-code|cursor
        if (url.startsWith("/api/session/")) {
          const urlObj = new URL(url, "http://localhost");
          const sessionId = decodeURIComponent(
            urlObj.pathname.replace("/api/session/", ""),
          );
          const source = urlObj.searchParams.get("source") || "claude-code";
          const conversation = getSessionConversation(sessionId, source);
          if (conversation) {
            res.end(JSON.stringify(conversation));
          } else {
            res.statusCode = 404;
            res.end(
              JSON.stringify({ error: "Session not found", sessionId, source }),
            );
          }
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      // Static files
      const filePath = join(WEB_DIR, url);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        res.setHeader("Content-Type", MIME_TYPES[ext] || "text/plain");
        res.end(readFileSync(filePath));
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    };
  }

  function tryPort(port) {
    if (port >= startPort + 100) {
      console.error(
        `No available ports found (tried ${startPort}-${port - 1})`,
      );
      process.exit(1);
    }

    const server = createServer(createHandler());

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        tryPort(port + 1);
      } else {
        throw err;
      }
    });

    server.listen(port, () => {
      console.log(`Dashboard running at http://localhost:${port}`);
      if (dataRepoDir && existsSync(dataRepoDir)) {
        console.log(`Reading data from: ${dataRepoDir}`);
      } else {
        console.log(`Reading data from: ${DATA_DIR}`);
      }
      console.log("Press Ctrl+C to stop");
    });
  }

  tryPort(startPort);
}

// Sync collected data and Claude project files to the data repo
function syncToDataRepo(dataRepoDir) {
  // Ensure data repo directories exist
  const dataRepoAgents = join(dataRepoDir, "agents");
  const dataRepoGithub = join(dataRepoDir, "github");
  const dataRepoProjects = join(dataRepoDir, "claude-projects");

  mkdirSync(dataRepoAgents, { recursive: true });
  mkdirSync(dataRepoGithub, { recursive: true });
  mkdirSync(dataRepoProjects, { recursive: true });

  // Copy collected data
  const localAgents = join(DATA_DIR, "agents", "sessions.json");
  const localGithub = join(DATA_DIR, "github", "contributions.json");

  if (existsSync(localAgents)) {
    copyFileSync(localAgents, join(dataRepoAgents, "sessions.json"));
    console.log("  Copied agents/sessions.json");
  }

  if (existsSync(localGithub)) {
    copyFileSync(localGithub, join(dataRepoGithub, "contributions.json"));
    console.log("  Copied github/contributions.json");
  }

  // Backup Claude project files (CLAUDE.md and settings)
  const projectsDir = join(CLAUDE_DIR, "projects");
  if (existsSync(projectsDir)) {
    const projects = readdirSync(projectsDir);
    let backupCount = 0;

    for (const project of projects) {
      const projectPath = join(projectsDir, project);
      const projectBackupDir = join(dataRepoProjects, project);

      // Copy CLAUDE.md if exists
      const claudeMd = join(projectPath, "CLAUDE.md");
      if (existsSync(claudeMd)) {
        mkdirSync(projectBackupDir, { recursive: true });
        copyFileSync(claudeMd, join(projectBackupDir, "CLAUDE.md"));
        backupCount++;
      }

      // Copy settings.json if exists
      const settings = join(projectPath, "settings.json");
      if (existsSync(settings)) {
        mkdirSync(projectBackupDir, { recursive: true });
        copyFileSync(settings, join(projectBackupDir, "settings.json"));
      }

      // Copy sessions-index.json if exists (metadata only, not full conversations)
      const sessionsIndex = join(projectPath, "sessions-index.json");
      if (existsSync(sessionsIndex)) {
        mkdirSync(projectBackupDir, { recursive: true });
        copyFileSync(sessionsIndex, join(projectBackupDir, "sessions-index.json"));
      }
    }

    console.log(`  Backed up ${backupCount} CLAUDE.md files from ${projects.length} projects`);
  }

  // Also backup global CLAUDE.md
  const globalClaudeMd = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(globalClaudeMd)) {
    copyFileSync(globalClaudeMd, join(dataRepoDir, "CLAUDE.md"));
    console.log("  Backed up global ~/.claude/CLAUDE.md");
  }

  console.log("  Data repo location:", dataRepoDir);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case "collect":
      if (args.subcommand === "github") {
        await collectGitHubData(args.options);
      } else if (args.subcommand === "agents") {
        await collectAgentData({ outputDir: args.options.output });
      } else {
        console.log("Usage: node scripts/cli.js collect <github|agents>");
      }
      break;

    case "serve": {
      const dataRepoDir = args.options['data-repo'] || DEFAULT_DATA_REPO_DIR;
      serve(parseInt(args.options.port) || 3000, dataRepoDir);
      break;
    }

    case "sync": {
      const dataRepoDir = args.options['data-repo'] || DEFAULT_DATA_REPO_DIR;
      console.log("Syncing all data...\n");

      // Collect data to local data/ dir
      await collectGitHubData(args.options);
      console.log("");
      await collectAgentData({ outputDir: args.options.output });

      // Sync to data repo if it exists
      if (existsSync(dataRepoDir)) {
        console.log("\nSyncing to data repo...");
        syncToDataRepo(dataRepoDir);
      } else {
        console.log("\nData repo not found at:", dataRepoDir);
        console.log("Create it with: gh repo clone seflless/self-reflect-data ~/dev/self-reflect-data");
      }

      console.log("\nSync complete!");
      break;
    }

    default:
      console.log(`
Self Reflect CLI

Commands:
  sync              Collect all data (GitHub + agents) and backup to data repo
    --data-repo     Data repo path (default: ~/dev/self-reflect-data)

  collect github    Fetch GitHub contribution data
    --from          Start date (YYYY-MM-DD)
    --to            End date (YYYY-MM-DD)

  collect agents    Collect Claude Code + Cursor session data
    --output        Output directory (for backup to another location)

  serve             Start dashboard server
    --port          Port number (default: 3000)
    --data-repo     Read data from this repo (default: ~/dev/self-reflect-data)

Examples:
  node scripts/cli.js sync
  node scripts/cli.js sync --data-repo ~/my-data
  node scripts/cli.js serve
`);
  }
}

main().catch(console.error);
