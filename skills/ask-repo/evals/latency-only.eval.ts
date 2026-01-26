import { evalite } from "evalite";
import { Latency } from "./scorers/index.js";
import { runWithSkill } from "./runners/with-skill.js";
import testCases from "./test-cases.json" with { type: "json" };

interface DiscoveryTestCase {
  id: string;
  category: string;
  input: string;
  expectedRepos: string[];
  notes: string;
}

const discoveryTests = testCases.discovery as DiscoveryTestCase[];

/**
 * Latency-only eval - no API calls needed
 * Tests how fast the skill can discover repos using gh CLI
 */
evalite("Skill Latency Test", {
  data: async () =>
    discoveryTests.map((tc) => ({
      input: tc.input,
      expected: { text: "", durationMs: 0, expectedRepos: tc.expectedRepos },
    })),

  task: async (input: string) => {
    const result = await runWithSkill(input);
    console.log(`[${result.durationMs}ms] ${input.slice(0, 50)}...`);
    console.log(`  -> Found: ${result.output.split("\n")[0]}`);
    return {
      text: result.output,
      durationMs: result.durationMs,
      expectedRepos: [] as string[],
    };
  },

  scorers: [Latency] as any,
});
