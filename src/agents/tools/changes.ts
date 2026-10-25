import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.js';
import type { Service } from '../../db/schema.js';
import * as github from '../../integrations/github.js';

export function changeTools(service: Service) {
  const recentDeploys = new FunctionTool({
    name: 'recent_deploys',
    description: 'List the most recent deploys of this service with their commit SHAs and times.',
    parameters: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
    execute: async ({ limit }) =>
      db
        .select({ sha: schema.deploys.sha, previousSha: schema.deploys.previousSha, deployedAt: schema.deploys.deployedAt })
        .from(schema.deploys)
        .where(eq(schema.deploys.serviceId, service.id))
        .orderBy(desc(schema.deploys.deployedAt))
        .limit(limit),
  });

  const recentCommits = new FunctionTool({
    name: 'github_recent_commits',
    description: `List commits to ${service.githubRepo ?? 'the service repo'} in the last N hours.`,
    parameters: z.object({ hours: z.number().int().min(1).max(168).default(24) }),
    execute: async ({ hours }) => {
      if (!service.githubRepo) return { error: 'No GitHub repo configured for this service' };
      return github.recentCommits(service.githubRepo, new Date(Date.now() - hours * 3600_000));
    },
  });

  const commitDiff = new FunctionTool({
    name: 'github_commit_diff',
    description: 'Get the unified diff of one commit (truncated to 20k characters).',
    parameters: z.object({ sha: z.string().min(7) }),
    execute: async ({ sha }) => {
      if (!service.githubRepo) return { error: 'No GitHub repo configured for this service' };
      return { diff: await github.commitDiff(service.githubRepo, sha) };
    },
  });

  return { recentDeploys, recentCommits, commitDiff };
}
