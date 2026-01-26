import { evalite } from "evalite";
import { Latency, RepoRelevance } from "./scorers/index.js";
import { runBaseline } from "./runners/baseline.js";
import { runWithSkill } from "./runners/with-skill.js";
import testCases from "./test-cases.json" with { type: "json" };

interface DiscoveryTestCase {
  id: string;
  category: string;
  input: string;
  expectedRepos: string[];
  notes: string;
}

// Filter to just discovery test cases
const discoveryTests = testCases.discovery as DiscoveryTestCase[];

/**
 * Baseline eval - Claude without skill
 *
 * Establishes baseline metrics for:
 * - Latency: How long does vanilla Claude take?
 * - Quality: How relevant are the results?
 */
evalite("Ask Repo Discovery - Baseline", {
  data: async () =>
    discoveryTests.map((tc) => ({
      input: tc.input,
      expected: { expectedRepos: tc.expectedRepos, text: "", durationMs: 0 },
    })),

  task: async (input: string) => {
    const result = await runBaseline(input);
    return {
      text: result.output,
      durationMs: result.durationMs,
      expectedRepos: [] as string[],
    };
  },

  scorers: [Latency, RepoRelevance] as any,
});

/**
 * Skill eval - Ask Repo with discovery tactics
 *
 * Measures improvement over baseline:
 * - Latency: Should be faster (hardcoded tactics vs LLM reasoning)
 * - Quality: Should be at least as good (real-time GitHub data)
 */
evalite("Ask Repo Discovery - With Skill", {
  data: async () =>
    discoveryTests.map((tc) => ({
      input: tc.input,
      expected: { expectedRepos: tc.expectedRepos, text: "", durationMs: 0 },
    })),

  task: async (input: string) => {
    const result = await runWithSkill(input);
    return {
      text: result.output,
      durationMs: result.durationMs,
      expectedRepos: [] as string[],
    };
  },

  scorers: [Latency, RepoRelevance] as any,
});

/**
 * Side-by-side comparison eval
 * Runs both baseline and skill, returns combined output for comparison
 */
evalite("Ask Repo Discovery - Comparison", {
  data: async () =>
    discoveryTests.slice(0, 3).map((tc) => ({
      input: tc.input,
      expected: { expectedRepos: tc.expectedRepos, text: "", durationMs: 0 },
    })),

  task: async (input: string) => {
    const [baseline, skill] = await Promise.all([
      runBaseline(input),
      runWithSkill(input),
    ]);

    const speedup = (baseline.durationMs / skill.durationMs).toFixed(2);

    return {
      text: `=== SKILL (${skill.durationMs}ms) ===\n${skill.output}\n\n=== BASELINE (${baseline.durationMs}ms) ===\n${baseline.output}\n\n=== SPEEDUP: ${speedup}x ===`,
      durationMs: skill.durationMs,
      expectedRepos: [] as string[],
    };
  },

  scorers: [Latency, RepoRelevance] as any,
});
