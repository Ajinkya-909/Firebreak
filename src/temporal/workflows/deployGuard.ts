import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import type { DeployGuardInput } from '../shared.js';

const acts = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: { maximumAttempts: 3 },
});

/**
 * For the guard window after a deploy, compare live metrics to the pre-deploy baseline.
 * A regression opens an incident tagged with the commit range and a rollback suggestion.
 */
export async function deployGuardWorkflow(input: DeployGuardInput): Promise<{ regressed: boolean }> {
  const { guardMinutes } = await acts.loadIncidentConfig();
  const baseline = await acts.capturePreDeployBaseline({ serviceId: input.serviceId, deployedAt: input.deployedAt });

  for (let minute = 1; minute <= guardMinutes; minute++) {
    await sleep('1 minute');
    const regressions = await acts.checkDeployRegression({ serviceId: input.serviceId, baseline });
    if (regressions.length > 0) {
      await acts.openDeployRegressionIncident({ deploy: input, regressions });
      await acts.markDeploy({ deployId: input.deployId, regressed: true });
      return { regressed: true };
    }
  }

  await acts.markDeploy({ deployId: input.deployId, regressed: false });
  return { regressed: false };
}
