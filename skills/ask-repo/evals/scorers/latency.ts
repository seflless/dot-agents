import type { Evalite } from "@evalite/core";

export interface DiscoveryOutput {
  text: string;
  durationMs: number;
}

/**
 * Latency scorer - measures time to complete discovery/analysis
 *
 * Scoring curve:
 * - < 5s:  1.0 (excellent)
 * - 5-15s: 0.5-1.0 (good)
 * - 15-30s: 0.25-0.5 (acceptable)
 * - > 30s: 0-0.25 (poor)
 */
export const Latency: Evalite.Scorer<string, DiscoveryOutput> = async ({
  output,
}) => {
  const ms = output.durationMs;

  let score: number;
  let tier: string;

  if (ms < 5000) {
    score = 1.0;
    tier = "excellent";
  } else if (ms < 15000) {
    score = 0.5 + 0.5 * (1 - (ms - 5000) / 10000);
    tier = "good";
  } else if (ms < 30000) {
    score = 0.25 + 0.25 * (1 - (ms - 15000) / 15000);
    tier = "acceptable";
  } else {
    score = Math.max(0, 0.25 - (ms - 30000) / 60000);
    tier = "poor";
  }

  return {
    name: "Latency",
    score,
    metadata: { durationMs: ms, tier },
  };
};
