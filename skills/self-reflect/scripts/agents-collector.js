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

  // Default: direct CLI usage
  return 'cli';
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
      const indexPath = join(projectsDir, project, 'sessions-index.json');
      if (existsSync(indexPath)) {
        const index = readJSON(indexPath);
        if (index?.entries) {
          const projectPath = index.originalPath || '';
          for (const entry of index.entries) {
            result.sessions.push({
              id: entry.sessionId,
              date: entry.created,
              modified: entry.modified,
              project: projectPath || entry.projectPath,
              app: extractAppName(projectPath || entry.projectPath),
              orchestrator: detectOrchestrator(projectPath || entry.projectPath),
              name: entry.summary || (entry.firstPrompt?.slice(0, 80) + '...'),
              messages: entry.messageCount,
              branch: entry.gitBranch || null,
              source: 'claude-code'
            });
          }
        }
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
        app: s.app || fresh.app,
        orchestrator: s.orchestrator || fresh.orchestrator,
        name: fresh.name || s.name, // Prefer fresh name
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
