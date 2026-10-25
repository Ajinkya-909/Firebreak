import { heartbeat } from '@temporalio/activity';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../../config/env.js';
import { createDraftPr } from '../../integrations/github.js';
import type { FixProposal, VerificationResult } from '../shared.js';
import { getService } from './detection.js';

const exec = promisify(execFile);

async function run(cmd: string, args: string[], cwd: string, timeoutMs = 10 * 60_000) {
  heartbeat({ cmd, args: args.slice(0, 3) });
  return exec(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 });
}

/**
 * Verify a proposed code fix: clone the service repo, apply the diff, and run the service's
 * verify command (tests, or a replay of captured failing traffic) inside a throwaway Docker
 * container. On success, push a branch and open a draft PR.
 */
export async function verifyFix(input: { incidentId: string; serviceId: string; fix: FixProposal }): Promise<VerificationResult> {
  if (input.fix.kind !== 'code_diff' || !input.fix.diff) {
    return { status: 'skipped', details: 'Runbook fix; nothing to build.' };
  }
  const service = await getService(input.serviceId);
  if (!env.VERIFY_WITH_DOCKER || !service.githubRepo || !service.verifyImage || !service.verifyCommand) {
    return { status: 'skipped', details: 'Docker verification not configured for this service.' };
  }

  const dir = await mkdtemp(join(tmpdir(), `firebreak-verify-${input.incidentId.slice(0, 8)}-`));
  const repoUrl = env.GITHUB_TOKEN
    ? `https://x-access-token:${env.GITHUB_TOKEN}@github.com/${service.githubRepo}.git`
    : `https://github.com/${service.githubRepo}.git`;
  const branch = `firebreak/incident-${input.incidentId.slice(0, 8)}`;

  try {
    await run('git', ['clone', '--depth', '50', repoUrl, 'repo'], dir);
    const repo = join(dir, 'repo');
    await writeFile(join(dir, 'fix.patch'), input.fix.diff.endsWith('\n') ? input.fix.diff : `${input.fix.diff}\n`);
    try {
      await run('git', ['apply', '--whitespace=nowarn', join(dir, 'fix.patch')], repo);
    } catch (err) {
      return { status: 'failed', details: `Patch does not apply: ${(err as Error).message.slice(0, 500)}` };
    }

    try {
      await run(
        'docker',
        ['run', '--rm', '--network', 'none', '--memory', '2g', '-v', `${repo}:/workspace`, '-w', '/workspace',
          service.verifyImage, 'sh', '-c', service.verifyCommand],
        repo,
        20 * 60_000,
      );
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      return { status: 'failed', details: `Verification failed: ${(e.stderr || e.stdout || e.message).slice(-1500)}` };
    }

    let draftPrUrl: string | undefined;
    if (env.GITHUB_TOKEN) {
      const { stdout: base } = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo);
      await run('git', ['checkout', '-b', branch], repo);
      await run('git', ['-c', 'user.name=firebreak', '-c', 'user.email=firebreak@users.noreply.github.com',
        'commit', '-am', `fix: ${input.fix.summary}`.slice(0, 72)], repo);
      await run('git', ['push', 'origin', branch], repo);
      draftPrUrl = await createDraftPr({
        repo: service.githubRepo,
        head: branch,
        base: base.trim(),
        title: `[Firebreak] ${input.fix.summary}`.slice(0, 120),
        body: `Proposed automatically by Firebreak for incident \`${input.incidentId}\`.\n\nVerified with \`${service.verifyCommand}\` in \`${service.verifyImage}\`.\n\nPrevention:\n${input.fix.prevention.map((p) => `- ${p}`).join('\n')}`,
      });
    }
    return { status: 'passed', details: `\`${service.verifyCommand}\` passed with the patch applied.`, draftPrUrl };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
