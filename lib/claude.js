const { spawnSync } = require('child_process');

const FALLBACK_MESSAGE = 'Auto-sync changes';

/**
 * Generate a commit message using Claude CLI
 * @param {string} diffSummary - Summary of changes
 * @returns {Promise<string>} - Generated commit message
 */
async function generateCommitMessage(diffSummary) {
  try {
    const prompt = `Generate a short, concise git commit message (max 72 chars for first line) for these changes. Only output the commit message, nothing else:\n\n${diffSummary}`;

    const result = spawnSync('claude', [
      '--print',
      '--model', 'haiku',
      prompt
    ], {
      encoding: 'utf8',
      timeout: 30000
    });

    if (result.status === 0 && result.stdout) {
      const message = result.stdout.trim();
      if (message.length > 0) {
        return message;
      }
    }

    // Log error for debugging
    if (result.stderr) {
      console.error('Claude error:', result.stderr);
    }

    return FALLBACK_MESSAGE;
  } catch (err) {
    console.error('Failed to generate commit message:', err.message);
    return FALLBACK_MESSAGE;
  }
}

module.exports = { generateCommitMessage };
