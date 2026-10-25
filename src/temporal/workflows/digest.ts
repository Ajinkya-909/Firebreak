import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

const { sendSev3Digest } = proxyActivities<typeof activities>({ startToCloseTimeout: '1 minute' });

/** Daily digest of SEV3 incidents, started by a schedule. */
export async function digestWorkflow(): Promise<void> {
  await sendSev3Digest({ sinceHours: 24 });
}
