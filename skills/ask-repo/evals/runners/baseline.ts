import { execSync } from "child_process";

export interface RunResult {
  output: string;
  durationMs: number;
  numTurns: number;
  costUsd: number;
  skillUsed: boolean;
}

interface ClaudeJsonOutput {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  num_turns: number;
  result: string;
  total_cost_usd: number;
}

/**
 * Baseline runner - Claude Code WITHOUT any skills
 *
 * Uses `claude -p --disable-slash-commands --output-format json`
 */
export async function runBaseline(query: string): Promise<RunResult> {
  const start = Date.now();

  try {
    const rawOutput = execSync(
      `claude -p --disable-slash-commands --output-format json "${query.replace(/"/g, '\\"')}"`,
      {
        encoding: "utf-8",
        timeout: 180000, // 3 minute timeout
        cwd: process.cwd(),
        env: { ...process.env },
      }
    );

    const json = JSON.parse(rawOutput) as ClaudeJsonOutput;

    return {
      output: json.result || "",
      durationMs: json.duration_ms,
      numTurns: json.num_turns,
      costUsd: json.total_cost_usd,
      skillUsed: false, // Skills are disabled
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    return {
      output: `Error running baseline: ${error.message}`,
      durationMs,
      numTurns: 0,
      costUsd: 0,
      skillUsed: false,
    };
  }
}

/**
 * Detect if a skill was used based on output characteristics
 */
export function detectSkillUsage(output: string, numTurns: number): boolean {
  // Multiple turns usually means tools were used
  if (numTurns > 2) return true;

  // Check for file:line references (indicates code analysis)
  const hasFileRefs = /\w+\.(ts|js|py|rs|go|rb|java):\d+/.test(output);
  if (hasFileRefs) return true;

  // Check for "cloned" or repo path mentions
  if (output.includes("~/.ask-repo/") || output.includes("Cloned")) return true;

  return false;
}
