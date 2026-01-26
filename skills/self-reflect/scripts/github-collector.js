#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'github');

function runGhQuery(query) {
  const escaped = query.replace(/\n/g, ' ').replace(/"/g, '\\"');
  const result = execSync(`gh api graphql -f query="${escaped}"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(result);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function formatDate(date) {
  return date.toISOString().split('T')[0] + 'T00:00:00Z';
}

export async function collectGitHubData(options = {}) {
  const to = options.to ? new Date(options.to) : new Date();
  const from = options.from ? new Date(options.from) : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  console.log(`Collecting GitHub data from ${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}...`);

  ensureDataDir();

  // Get user info
  const userQuery = `{
    viewer {
      login
      name
      avatarUrl
    }
  }`;
  const userData = runGhQuery(userQuery);
  const username = userData.data.viewer.login;
  console.log(`User: ${username}`);

  // Get contribution data (max 1 year span per query)
  const contribQuery = `{
    viewer {
      contributionsCollection(from: "${formatDate(from)}", to: "${formatDate(to)}") {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            createdAt
            owner { login }
            isPrivate
            isFork
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }`;

  console.log('Fetching contributions...');
  const contribData = runGhQuery(contribQuery);

  // Get repos created in time period
  const reposQuery = `{
    viewer {
      repositories(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          nameWithOwner
          createdAt
          isPrivate
          isFork
          owner { login }
        }
      }
    }
  }`;

  console.log('Fetching repositories...');
  const reposData = runGhQuery(reposQuery);

  // Filter repos to time period
  const reposInPeriod = reposData.data.viewer.repositories.nodes.filter(repo => {
    const created = new Date(repo.createdAt);
    return created >= from && created <= to;
  });

  // Compile results
  const result = {
    user: userData.data.viewer,
    period: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    contributions: contribData.data.viewer.contributionsCollection,
    reposCreated: reposInPeriod,
    collectedAt: new Date().toISOString()
  };

  // Save to file
  const filename = join(DATA_DIR, 'contributions.json');
  writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(`Data saved to ${filename}`);

  // Print summary
  const c = result.contributions;
  console.log('\n--- Summary ---');
  console.log(`Total contributions: ${c.contributionCalendar.totalContributions}`);
  console.log(`Commits: ${c.totalCommitContributions}`);
  console.log(`PRs: ${c.totalPullRequestContributions}`);
  console.log(`Issues: ${c.totalIssueContributions}`);
  console.log(`Repos created: ${reposInPeriod.length}`);
  console.log(`\nTop repos by commits:`);
  c.commitContributionsByRepository
    .sort((a, b) => b.contributions.totalCount - a.contributions.totalCount)
    .slice(0, 10)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.repository.nameWithOwner}: ${r.contributions.totalCount} commits`);
    });

  return result;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) options.from = args[++i];
    if (args[i] === '--to' && args[i + 1]) options.to = args[++i];
  }

  collectGitHubData(options).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
