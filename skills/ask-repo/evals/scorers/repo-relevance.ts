import Anthropic from "@anthropic-ai/sdk";
import type { Evalite } from "@evalite/core";
import type { DiscoveryOutput } from "./latency.js";

const client = new Anthropic();

/**
 * RepoRelevance scorer - uses LLM to judge if discovered repos are relevant
 *
 * Evaluates:
 * 1. Are the repos actually relevant to the query?
 * 2. Are popular/canonical options included?
 * 3. Is the description accurate?
 */
export const RepoRelevance: Evalite.Scorer<string, DiscoveryOutput> = async ({
  input,
  output,
  expected,
}) => {
  const expectedRepos = (expected as { expectedRepos?: string[] })?.expectedRepos ?? [];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are evaluating a repo discovery tool.

USER QUERY: "${input}"

TOOL OUTPUT:
${output.text}

EXPECTED REPOS (at least some should appear): ${expectedRepos.join(", ") || "none specified"}

Score the output 0-1 based on:
1. Relevance: Are the suggested repos actually relevant to the query?
2. Coverage: Are well-known/canonical options included?
3. Accuracy: Are descriptions and star counts plausible?
4. Usefulness: Would this help a developer find what they need?

Respond with ONLY a JSON object:
{"score": 0.X, "reason": "brief explanation"}`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    return {
      name: "RepoRelevance",
      score: parsed.score,
      metadata: { reason: parsed.reason, expectedRepos },
    };
  } catch {
    return {
      name: "RepoRelevance",
      score: 0.5,
      metadata: { reason: "Failed to parse judge response" },
    };
  }
};
