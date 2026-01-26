import { execSync } from "child_process";
import { detectSkillUsage } from "./baseline.js";

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
 * With-skill runner - explicitly invokes /ask-repo
 *
 * Prepends "/ask-repo" to the query to ensure the skill is triggered.
 * Uses `claude -p --output-format json` to get structured output.
 */
export async function runWithSkill(query: string): Promise<RunResult> {
  const start = Date.now();

  // Prepend /ask-repo to explicitly invoke the skill
  const skillQuery = `/ask-repo ${query}`;

  try {
    const rawOutput = execSync(
      `claude -p --output-format json "${skillQuery.replace(/"/g, '\\"')}"`,
      {
        encoding: "utf-8",
        timeout: 180000, // 3 minute timeout
        cwd: process.cwd(),
        env: { ...process.env },
      }
    );

    const json = JSON.parse(rawOutput) as ClaudeJsonOutput;
    const skillUsed = detectSkillUsage(json.result || "", json.num_turns);

    return {
      output: json.result || "",
      durationMs: json.duration_ms,
      numTurns: json.num_turns,
      costUsd: json.total_cost_usd,
      skillUsed,
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    return {
      output: `Error running with skill: ${error.message}`,
      durationMs,
      numTurns: 0,
      costUsd: 0,
      skillUsed: false,
    };
  }
}

/**
 * Direct tactics runner - runs gh search directly without LLM
 *
 * Useful for latency comparison - shows minimum possible time.
 */
export async function runTacticsDirect(query: string): Promise<RunResult> {
  const start = Date.now();

  const keywords = extractKeywords(query);
  const ghResults = await searchGitHub(keywords);
  const output = formatResults(ghResults, query);
  const durationMs = Date.now() - start;

  return {
    output,
    durationMs,
    numTurns: 0,
    costUsd: 0,
    skillUsed: false, // Direct tactics, no skill
  };
}

// --- Helper functions for direct tactics testing ---

function extractKeywords(query: string): string {
  const stopWords = new Set([
    "what", "are", "is", "the", "a", "an", "find", "me", "i", "want",
    "need", "looking", "for", "some", "any", "do", "does", "how", "can",
    "could", "would", "should", "that", "which", "where", "when", "why",
    "there", "their", "they", "this", "these", "those", "it", "its",
    "to", "of", "in", "on", "with", "by", "from", "or", "and", "be",
    "good", "best", "great", "top", "popular", "recommended",
    "alternative", "alternatives", "like", "similar",
    "library", "libraries", "lib", "libs",
    "package", "packages", "pkg",
    "repo", "repos", "repository", "repositories",
    "tool", "tools", "framework", "frameworks",
    "implementation", "implementations",
    "example", "examples",
    "more", "modern", "new", "latest", "better",
  ]);

  const words = query
    .toLowerCase()
    .replace(/[?!.,'"`]/g, "")
    .replace(/n't|'s|'re|'ve|'ll|'d/g, "")
    .split(/\s+/)
    .filter((word) => !stopWords.has(word) && word.length > 2);

  if (words.length < 2) {
    const basicStops = new Set(["what", "are", "is", "the", "a", "an", "find", "me", "for"]);
    const fallback = query
      .toLowerCase()
      .replace(/[?!.,'"]/g, "")
      .split(/\s+/)
      .filter((word) => !basicStops.has(word) && word.length > 1);
    return fallback.join(" ");
  }

  return words.join(" ");
}

interface RepoResult {
  fullName: string;
  description: string;
  stars: number;
  url: string;
}

async function searchGitHub(keywords: string): Promise<RepoResult[]> {
  try {
    const cmd = `gh search repos "${keywords}" --sort=stars --limit=5 --json fullName,description,stargazersCount,url`;
    const result = execSync(cmd, {
      encoding: "utf-8",
      timeout: 15000,
    });

    const parsed = JSON.parse(result);
    return parsed.map(
      (repo: {
        fullName: string;
        description: string;
        stargazersCount: number;
        url: string;
      }) => ({
        fullName: repo.fullName,
        description: repo.description || "No description",
        stars: repo.stargazersCount,
        url: repo.url,
      })
    );
  } catch (error) {
    console.error("GitHub search failed:", error);
    return [];
  }
}

function formatResults(repos: RepoResult[], originalQuery: string): string {
  if (repos.length === 0) {
    return `No repos found for: "${originalQuery}"`;
  }

  const lines = [`Found ${repos.length} repos for: "${originalQuery}"\n`];

  repos.forEach((repo, i) => {
    const stars =
      repo.stars >= 1000
        ? `${(repo.stars / 1000).toFixed(1)}k`
        : repo.stars.toString();
    lines.push(`${i + 1}. ${repo.fullName} (${stars}★)`);
    lines.push(`   ${repo.description}`);
    lines.push("");
  });

  return lines.join("\n");
}
