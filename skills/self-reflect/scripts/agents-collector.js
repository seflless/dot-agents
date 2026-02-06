#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(__dirname, '..', 'data', 'agents');

const CLAUDE_DIR = join(homedir(), '.claude');
const CURSOR_DIR = join(homedir(), '.cursor');

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// Check if text starts with a system instruction prefix
function isSystemPrefix(text) {
  if (!text) return false;
  const t = text.trimStart();
  return t.startsWith('<system_instruction>') || t.startsWith('<system-reminder>') || t.startsWith('<system-instruction>') || t.startsWith('<local-command-caveat>');
}

// Detect orchestrator from project path
function detectOrchestrator(projectPath) {
  if (!projectPath) return 'unknown';

  // Conductor workspaces
  if (projectPath.includes('/conductor/workspaces/')) {
    return 'conductor';
  }

  // Claude worktrees (often used by automated tools)
  if (projectPath.includes('/.claude-worktrees/')) {
    return 'claude-worktree';
  }

  // Okiro projects
  if (projectPath.includes('/okiro/')) {
    return 'okiro';
  }

  // Default: Claude Code CLI usage
  return 'claude-code';
}

// Peek at a .jsonl file to refine orchestrator detection
// Returns 'conductor-terminal' if session was started from a Conductor terminal
function peekOrchestratorFromContent(jsonlPath, currentOrchestrator) {
  // Only refine if currently detected as 'claude-code' or 'unknown'
  if (currentOrchestrator !== 'claude-code' && currentOrchestrator !== 'unknown') {
    return currentOrchestrator;
  }
  try {
    const content = readFileSync(jsonlPath, 'utf-8');
    // Only check first 4000 chars for performance
    const head = content.slice(0, 4000);
    if (head.includes('working inside Conductor') || head.includes('You are working inside Conductor')) {
      return 'conductor-terminal';
    }
  } catch {}
  return currentOrchestrator;
}

// Scan a .jsonl file to extract session metadata when no sessions-index.json exists
function extractSessionFromJsonl(jsonlPath, projectPath) {
  try {
    const stat = statSync(jsonlPath);
    const sessionId = basename(jsonlPath, '.jsonl');
    const content = readFileSync(jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    let firstPrompt = '';
    let created = null;
    let gitBranch = null;

    // Parse first lines to extract metadata (scan more to find prompt past system instructions)
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      try {
        const entry = JSON.parse(lines[i]);
        // Get timestamp from first entry
        if (!created && entry.timestamp) {
          created = entry.timestamp;
        }
        // Get first user text prompt (skip system instructions)
        if (!firstPrompt && entry.type === 'user') {
          const c = entry.message?.content;
          let candidate = '';
          if (typeof c === 'string' && c.trim()) {
            candidate = c.trim();
          } else if (Array.isArray(c)) {
            for (const block of c) {
              if (block.type === 'text' && block.text?.trim()) {
                candidate = block.text.trim();
                break;
              }
            }
          }
          // Skip system instructions and other injected messages
          if (candidate && !candidate.startsWith('<system_instruction>') && !candidate.startsWith('<system-reminder>') && !candidate.startsWith('<system-instruction>') && !candidate.startsWith('<local-command-caveat>')) {
            firstPrompt = candidate;
          }
        }
      } catch {}
    }

    if (!created) {
      created = stat.mtime.toISOString();
    }

    let orchestrator = detectOrchestrator(projectPath);
    orchestrator = peekOrchestratorFromContent(jsonlPath, orchestrator);

    return {
      id: sessionId,
      date: created,
      modified: stat.mtime.toISOString(),
      project: projectPath,
      app: extractAppName(projectPath),
      orchestrator,
      name: firstPrompt ? (firstPrompt.slice(0, 80) + (firstPrompt.length > 80 ? '...' : '')) : 'No prompt...',
      messages: lines.length,
      branch: gitBranch,
      source: 'claude-code'
    };
  } catch {
    return null;
  }
}

// Extract app name from project path
function extractAppName(projectPath) {
  if (!projectPath) return 'unknown';

  // Conductor workspace name
  const conductorMatch = projectPath.match(/\/conductor\/workspaces\/[^/]+\/([^/]+)/);
  if (conductorMatch) return conductorMatch[1];

  // Get last meaningful directory
  const parts = projectPath.split('/').filter(Boolean);
  if (parts.length === 0) return 'unknown';

  // Skip common non-app directories
  const skip = ['Users', 'home', 'dev', 'code', 'projects', 'repos'];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!skip.includes(parts[i]) && !parts[i].startsWith('.')) {
      return parts[i];
    }
  }

  return parts[parts.length - 1];
}

function collectClaudeCode() {
  const result = {
    source: 'claude-code',
    dailyActivity: [],
    sessions: []
  };

  // Read stats-cache.json for daily activity
  const statsPath = join(CLAUDE_DIR, 'stats-cache.json');
  if (existsSync(statsPath)) {
    const stats = readJSON(statsPath);
    if (stats?.dailyActivity) {
      result.dailyActivity = stats.dailyActivity.map(d => ({
        date: d.date,
        messages: d.messageCount,
        sessions: d.sessionCount,
        toolCalls: d.toolCallCount
      }));
    }
  }

  // Scan projects for session details
  const projectsDir = join(CLAUDE_DIR, 'projects');
  if (existsSync(projectsDir)) {
    const projects = readdirSync(projectsDir);
    for (const project of projects) {
      const projectDir = join(projectsDir, project);
      const indexPath = join(projectDir, 'sessions-index.json');

      if (existsSync(indexPath)) {
        // Has sessions-index.json - use it, but refine orchestrator from content
        const index = readJSON(indexPath);
        if (index?.entries) {
          const projectPath = index.originalPath || '';
          for (const entry of index.entries) {
            const fullProjectPath = projectPath || entry.projectPath;
            let orchestrator = detectOrchestrator(fullProjectPath);

            // Peek at content to refine orchestrator (e.g. conductor-terminal)
            const jsonlPath = join(projectDir, `${entry.sessionId}.jsonl`);
            if (existsSync(jsonlPath)) {
              orchestrator = peekOrchestratorFromContent(jsonlPath, orchestrator);
            }

            // Get name, skipping system instructions
            let name = entry.summary || '';
            if (!name || isSystemPrefix(name)) {
              const fp = entry.firstPrompt || '';
              name = isSystemPrefix(fp) ? '' : fp;
            }
            // If name is still a system instruction, try to extract from .jsonl
            if (!name || isSystemPrefix(name)) {
              if (existsSync(jsonlPath)) {
                const extracted = extractSessionFromJsonl(jsonlPath, fullProjectPath);
                if (extracted && extracted.name && extracted.name !== 'No prompt...') {
                  name = extracted.name;
                }
              }
            }
            if (!name) name = 'No prompt...';
            else name = name.slice(0, 80) + (name.length > 80 ? '...' : '');

            // Skip Conductor warmup sessions (small sessions named "Warmup")
            if (name === 'Warmup' && (entry.messageCount || 0) <= 10) continue;

            result.sessions.push({
              id: entry.sessionId,
              date: entry.created,
              modified: entry.modified,
              project: fullProjectPath,
              app: extractAppName(fullProjectPath),
              orchestrator,
              name,
              messages: entry.messageCount,
              branch: entry.gitBranch || null,
              source: 'claude-code'
            });
          }
        }
      } else {
        // No sessions-index.json - scan .jsonl files directly
        try {
          const files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
          // Reconstruct project path from directory name (best-effort, inherently lossy)
          // Double dash (--) means /. (dot-prefixed directory), single dash means /
          const projectPath = '/' + project.replace(/--/g, '/.').replace(/-/g, '/');
          for (const file of files) {
            // Skip Conductor warmup sessions (agent-* with tiny files)
            const sessionId = basename(file, '.jsonl');
            if (sessionId.startsWith('agent-')) {
              try {
                const stat = statSync(join(projectDir, file));
                // Skip files under 2KB (warmup sessions are tiny)
                if (stat.size < 2048) continue;
              } catch { continue; }
            }
            const jsonlPath = join(projectDir, file);
            const session = extractSessionFromJsonl(jsonlPath, projectPath);
            if (session) {
              // Skip warmup sessions
              if (session.name === 'Warmup' && (session.messages || 0) <= 20) continue;
              result.sessions.push(session);
            }
          }
        } catch {}
      }
    }
  }

  result.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return result;
}

function collectCursor() {
  const result = {
    source: 'cursor',
    dailyActivity: [],
    sessions: []
  };

  const projectsDir = join(CURSOR_DIR, 'projects');
  if (existsSync(projectsDir)) {
    const projects = readdirSync(projectsDir);

    for (const project of projects) {
      const transcriptsDir = join(projectsDir, project, 'agent-transcripts');
      if (existsSync(transcriptsDir)) {
        try {
          const files = readdirSync(transcriptsDir).filter(f => f.endsWith('.txt'));
          const projectPath = '/' + project.replace(/-/g, '/');
          for (const file of files) {
            const filePath = join(transcriptsDir, file);
            const stat = statSync(filePath);
            result.sessions.push({
              id: file.replace('.txt', ''),
              date: stat.mtime.toISOString(),
              project: projectPath,
              app: extractAppName(projectPath),
              orchestrator: 'cursor',
              name: `Cursor session`,
              source: 'cursor'
            });
          }
        } catch {
          // Skip if can't read
        }
      }
    }
  }

  result.sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return result;
}

// Merge new sessions with existing (additive - never delete)
function mergeData(existing, newData) {
  const newById = new Map(newData.sessions.map(s => [s.id, s]));
  const now = new Date().toISOString();

  // Update existing sessions with new metadata (if missing)
  const updatedExisting = (existing.sessions || []).map(s => {
    const fresh = newById.get(s.id);
    if (fresh) {
      // Update metadata but keep firstSeen
      return {
        ...s,
        app: fresh.app || s.app,
        orchestrator: fresh.orchestrator || s.orchestrator,
        name: (fresh.name && fresh.name !== 'No prompt...') ? fresh.name : (s.name || fresh.name), // Prefer fresh name but not "No prompt..."
        messages: fresh.messages || s.messages
      };
    }
    // Session no longer on disk - keep it but mark as archived
    return { ...s, archived: true };
  });

  // Find truly new sessions
  const existingIds = new Set(existing.sessions?.map(s => s.id) || []);
  const newSessions = newData.sessions.filter(s => !existingIds.has(s.id));
  for (const session of newSessions) {
    session.firstSeen = now;
  }

  // Keep all sessions (backup - never delete)
  const allSessions = [
    ...updatedExisting,
    ...newSessions
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Merge daily activity (keep max values for each day)
  const dailyMap = new Map();
  for (const d of (existing.dailyActivity || [])) {
    dailyMap.set(d.date, d);
  }
  for (const d of newData.dailyActivity) {
    const existing = dailyMap.get(d.date);
    if (!existing || d.messages > existing.messages) {
      dailyMap.set(d.date, d);
    }
  }
  const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    collectedAt: now,
    sources: ['claude-code', 'cursor'],
    dailyActivity,
    sessions: allSessions,
    stats: computeStats(allSessions)
  };
}

// Compute summary stats
function computeStats(sessions) {
  const byApp = {};
  const byOrchestrator = {};
  const bySource = {};

  for (const s of sessions) {
    byApp[s.app] = (byApp[s.app] || 0) + 1;
    byOrchestrator[s.orchestrator] = (byOrchestrator[s.orchestrator] || 0) + 1;
    bySource[s.source] = (bySource[s.source] || 0) + 1;
  }

  // Sort by count
  const sortObj = obj => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return {
    byApp: sortObj(byApp),
    byOrchestrator: sortObj(byOrchestrator),
    bySource: sortObj(bySource)
  };
}

export async function collectAgentData(options = {}) {
  const outputDir = options.outputDir || DEFAULT_DATA_DIR;
  console.log('Collecting agent data...');
  ensureDir(outputDir);

  // Load existing data (for additive merge)
  const outputPath = join(outputDir, 'sessions.json');
  const existing = existsSync(outputPath) ? readJSON(outputPath) : { sessions: [], dailyActivity: [] };

  // Collect fresh data
  const claude = collectClaudeCode();
  const cursor = collectCursor();

  const newData = {
    dailyActivity: claude.dailyActivity,
    sessions: [...claude.sessions, ...cursor.sessions]
  };

  // Merge (additive)
  const result = mergeData(existing, newData);

  // Save
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Data saved to ${outputPath}`);

  // Summary
  const newCount = result.sessions.filter(s => s.firstSeen === result.collectedAt).length;
  console.log('\n--- Summary ---');
  console.log(`Total sessions: ${result.sessions.length} (${newCount} new)`);
  console.log(`Daily activity days: ${result.dailyActivity.length}`);

  if (result.stats.byOrchestrator.length > 0) {
    console.log('\nBy orchestrator:');
    for (const { name, count } of result.stats.byOrchestrator.slice(0, 5)) {
      console.log(`  ${name}: ${count}`);
    }
  }

  if (result.stats.byApp.length > 0) {
    console.log('\nTop apps:');
    for (const { name, count } of result.stats.byApp.slice(0, 10)) {
      console.log(`  ${name}: ${count}`);
    }
  }

  if (result.dailyActivity.length > 0) {
    const totalMessages = result.dailyActivity.reduce((sum, d) => sum + d.messages, 0);
    const totalSessions = result.dailyActivity.reduce((sum, d) => sum + d.sessions, 0);
    const totalToolCalls = result.dailyActivity.reduce((sum, d) => sum + d.toolCalls, 0);
    console.log(`\nTotals (from daily stats):`);
    console.log(`  Messages: ${totalMessages.toLocaleString()}`);
    console.log(`  Sessions: ${totalSessions.toLocaleString()}`);
    console.log(`  Tool calls: ${totalToolCalls.toLocaleString()}`);
  }

  return result;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      options.outputDir = args[++i];
    }
  }

  collectAgentData(options).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
