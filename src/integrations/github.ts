import { env } from '../config/env.js';

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(env.GITHUB_TOKEN && { authorization: `Bearer ${env.GITHUB_TOKEN}` }),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub ${path} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

export async function recentCommits(repo: string, since: Date, limit = 20): Promise<CommitSummary[]> {
  const commits = await gh<
    Array<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null } }>
  >(`/repos/${repo}/commits?since=${since.toISOString()}&per_page=${limit}`);
  return commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0] ?? '',
    author: c.commit.author?.name ?? 'unknown',
    date: c.commit.author?.date ?? '',
    url: c.html_url,
  }));
}

export async function commitDiff(repo: string, sha: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, {
    headers: {
      accept: 'application/vnd.github.diff',
      ...(env.GITHUB_TOKEN && { authorization: `Bearer ${env.GITHUB_TOKEN}` }),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub diff ${sha} failed (${res.status})`);
  // Keep tool output bounded; the agent only needs the shape of the change.
  return (await res.text()).slice(0, 20_000);
}

export async function createDraftPr(input: {
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<string> {
  const pr = await gh<{ html_url: string }>(`/repos/${input.repo}/pulls`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: input.title, head: input.head, base: input.base, body: input.body, draft: true }),
  });
  return pr.html_url;
}
