#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const AGENTS_DIR = path.join(process.env.HOME, '.agents');
const PID_FILE = path.join(AGENTS_DIR, '.dot-agents.pid');
const LOCK_FILE = path.join(AGENTS_DIR, '.skill-lock.json');

program
  .name('dot-agents')
  .description('Auto-sync ~/.agents to GitHub on file changes')
  .version('1.0.0');

program
  .command('start')
  .description('Start the background watcher')
  .action(() => {
    // Check if already running
    if (isRunning()) {
      console.log('dot-agents is already running');
      process.exit(0);
    }

    // Spawn detached watcher process
    const watcherPath = path.join(__dirname, '..', 'lib', 'watcher.js');
    const child = spawn('node', [watcherPath], {
      detached: true,
      stdio: 'ignore',
      cwd: AGENTS_DIR
    });

    child.unref();
    console.log(`dot-agents started (pid: ${child.pid})`);
  });

program
  .command('stop')
  .description('Stop the background watcher')
  .action(() => {
    if (!fs.existsSync(PID_FILE)) {
      console.log('dot-agents is not running');
      process.exit(0);
    }

    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(PID_FILE);
      console.log('dot-agents stopped');
    } catch (err) {
      if (err.code === 'ESRCH') {
        // Process not found, clean up stale PID file
        fs.unlinkSync(PID_FILE);
        console.log('dot-agents was not running (cleaned up stale pid file)');
      } else {
        console.error('Error stopping dot-agents:', err.message);
        process.exit(1);
      }
    }
  });

program
  .command('status')
  .description('Show watcher status and installed skills')
  .action(() => {
    const running = isRunning();
    console.log(`Status: ${running ? 'running' : 'not running'}`);

    if (running) {
      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
      console.log(`PID: ${pid}`);
    }

    console.log('');
    console.log('Installed skills:');

    if (fs.existsSync(LOCK_FILE)) {
      try {
        const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        const skills = Object.keys(lock.skills || {});
        if (skills.length === 0) {
          console.log('  (none)');
        } else {
          skills.forEach(skill => {
            const info = lock.skills[skill];
            console.log(`  - ${skill} (from ${info.source})`);
          });
        }
      } catch (err) {
        console.log('  (error reading skill-lock.json)');
      }
    } else {
      console.log('  (none)');
    }
  });

function isRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    // Check if process is running (signal 0 doesn't kill, just checks)
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // Process not running, clean up stale PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {
      // Ignore cleanup errors
    }
    return false;
  }
}

program.parse();
