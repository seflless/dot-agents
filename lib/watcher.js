#!/usr/bin/env node

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
const { generateCommitMessage } = require('./claude');

const AGENTS_DIR = path.join(process.env.HOME, '.agents');
const PID_FILE = path.join(AGENTS_DIR, '.dot-agents.pid');
const DEBOUNCE_MS = 5000;

let debounceTimer = null;

// Write PID file
fs.writeFileSync(PID_FILE, process.pid.toString());

// Clean up on exit
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

function cleanup() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (e) {
    // Ignore
  }
  process.exit(0);
}

// Initialize watcher
const watcher = chokidar.watch(AGENTS_DIR, {
  ignored: [
    /node_modules/,
    /\.git/,
    /\.dot-agents\.pid$/
  ],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

function hasChanges() {
  try {
    const status = execSync('git status --porcelain', {
      cwd: AGENTS_DIR,
      encoding: 'utf8'
    });
    return status.trim().length > 0;
  } catch (err) {
    return false;
  }
}

function getDiffSummary() {
  try {
    // Get list of changed files
    const status = execSync('git status --porcelain', {
      cwd: AGENTS_DIR,
      encoding: 'utf8'
    });

    const lines = status.trim().split('\n').filter(Boolean);
    const summary = lines.map(line => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      const action = status === 'A' ? 'added' :
                     status === 'D' ? 'deleted' :
                     status === 'M' ? 'modified' :
                     status === '??' ? 'new' : 'changed';
      return `${action}: ${file}`;
    }).join('\n');

    return summary;
  } catch (err) {
    return 'various changes';
  }
}

async function syncToGitHub() {
  if (!hasChanges()) {
    log('No changes to commit');
    return;
  }

  try {
    // Stage all changes
    execSync('git add -A', { cwd: AGENTS_DIR });

    // Generate commit message
    const diffSummary = getDiffSummary();
    log('Generating commit message...');
    const commitMessage = await generateCommitMessage(diffSummary);

    // Commit
    log(`Committing: ${commitMessage.split('\n')[0]}`);
    const commitResult = spawnSync('git', ['commit', '-m', commitMessage], {
      cwd: AGENTS_DIR,
      encoding: 'utf8'
    });

    if (commitResult.status !== 0) {
      log(`Commit failed: ${commitResult.stderr}`);
      return;
    }

    // Push
    log('Pushing to remote...');
    const pushResult = spawnSync('git', ['push'], {
      cwd: AGENTS_DIR,
      encoding: 'utf8'
    });

    if (pushResult.status !== 0) {
      log(`Push failed: ${pushResult.stderr}`);
      return;
    }

    log('Sync complete');
  } catch (err) {
    log(`Sync error: ${err.message}`);
  }
}

function scheduleSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    await syncToGitHub();
  }, DEBOUNCE_MS);
}

watcher
  .on('add', (filePath) => {
    log(`File added: ${path.relative(AGENTS_DIR, filePath)}`);
    scheduleSync();
  })
  .on('change', (filePath) => {
    log(`File changed: ${path.relative(AGENTS_DIR, filePath)}`);
    scheduleSync();
  })
  .on('unlink', (filePath) => {
    log(`File removed: ${path.relative(AGENTS_DIR, filePath)}`);
    scheduleSync();
  })
  .on('ready', async () => {
    log('Watcher ready, monitoring ~/.agents for changes...');
    // Sync any existing uncommitted changes on startup
    if (hasChanges()) {
      log('Found existing uncommitted changes, syncing...');
      await syncToGitHub();
    }
  })
  .on('error', (err) => {
    log(`Watcher error: ${err.message}`);
  });
