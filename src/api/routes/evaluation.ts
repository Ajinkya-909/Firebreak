import { and, gte, ne } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../../db/client.js';

export const evaluationRouter = Router();

// An incident counts as detecting an injection if it opened within this long after the fault ended.
const MATCH_GRACE_MS = 15 * 60_000;

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Detection quality measured against chaos-lab ground truth: precision, recall, time to the
 * initial report, and root-cause accuracy (from engineer feedback on matched incidents).
 */
evaluationRouter.get('/', async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
  const since = new Date(Date.now() - days * 24 * 3600_000);

  const injections = await db.select().from(schema.chaosInjections).where(gte(schema.chaosInjections.startedAt, since));
  const incidents = await db
    .select()
    .from(schema.incidents)
    .where(and(gte(schema.incidents.detectedAt, since), ne(schema.incidents.status, 'noise')));
  const feedback = await db.select().from(schema.feedback).where(gte(schema.feedback.createdAt, since));

  const matched = new Set<string>();
  const timeToReportSec: number[] = [];
  const perInjection = injections.map((inj) => {
    const windowEnd = (inj.endedAt ?? inj.startedAt).getTime() + MATCH_GRACE_MS;
    const hit = incidents
      .filter((i) => i.serviceId === inj.serviceId && i.detectedAt >= inj.startedAt && i.detectedAt.getTime() <= windowEnd)
      .sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime())[0];
    if (hit) {
      matched.add(hit.id);
      if (hit.initialReportAt) timeToReportSec.push((hit.initialReportAt.getTime() - inj.startedAt.getTime()) / 1000);
    }
    return { label: inj.label, faultType: inj.faultType, detected: !!hit, incidentId: hit?.id ?? null };
  });

  const judged = feedback.filter((f) => matched.has(f.incidentId) && f.verdict !== 'not_incident');
  const servicesUnderTest = new Set(injections.map((i) => i.serviceId));
  const candidateIncidents = incidents.filter((i) => servicesUnderTest.has(i.serviceId));

  res.json({
    windowDays: days,
    injections: injections.length,
    incidents: candidateIncidents.length,
    recall: injections.length ? matched.size / injections.length : null,
    precision: candidateIncidents.length ? matched.size / candidateIncidents.length : null,
    medianTimeToInitialReportSec: median(timeToReportSec),
    rootCauseAccuracy: judged.length ? judged.filter((f) => f.verdict === 'correct').length / judged.length : null,
    perInjection,
  });
});
