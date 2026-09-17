// Writes data/contributions.json: the last 30 days of GitHub contributions for the site's "Pit Wall" section.
// Runs daily in .github/workflows/contributions.yml. Needs GITHUB_TOKEN; GH_LOGIN defaults to acunli.
import { mkdir, writeFile } from 'node:fs/promises';

const login = process.env.GH_LOGIN || 'acunli';
const token = process.env.GITHUB_TOKEN;
const DAYS = 30;

if (!token) {
  console.error('GITHUB_TOKEN is not set.');
  process.exit(1);
}

const to = new Date();
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - (DAYS - 1));
from.setUTCHours(0, 0, 0, 0);

const query = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        restrictedContributionsCount
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'ayushman.rocks-contributions',
  },
  body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
});
const payload = await response.json();

if (!response.ok || payload.errors || !payload.data?.user) {
  console.error('GitHub API request failed:', JSON.stringify(payload.errors || payload, null, 2));
  process.exit(1);
}

const collection = payload.data.user.contributionsCollection;
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const firstDate = from.toISOString().slice(0, 10);

const days = collection.contributionCalendar.weeks
  .flatMap(week => week.contributionDays)
  .filter(day => day.date >= firstDate)
  .map(day => ({ date: day.date, count: day.contributionCount, level: LEVELS[day.contributionLevel] ?? 0 }));

const output = {
  login,
  generatedAt: to.toISOString(),
  total: collection.contributionCalendar.totalContributions,
  restricted: collection.restrictedContributionsCount,
  breakdown: {
    commits: collection.totalCommitContributions,
    pullRequests: collection.totalPullRequestContributions,
    reviews: collection.totalPullRequestReviewContributions,
    issues: collection.totalIssueContributions,
    repositories: collection.totalRepositoryContributions,
  },
  days,
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/contributions.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${days.length} days, ${output.total} contributions for ${login}.`);
