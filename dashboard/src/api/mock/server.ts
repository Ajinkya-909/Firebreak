import type { Evaluation, FeedbackVerdict, Incident, IncidentState, NewService, Service } from '../types';
import { createMockDb } from './data';

/**
 * In-browser stand-in for the Express API. Routes, status codes and response bodies mirror
 * src/api/routes/* so the dashboard code is identical in mock and live mode.
 */

const db = createMockDb();

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

const notFound = (what: string) => new MockHttpError(404, { error: `${what}_not_found` });
const invalid = (message: string) => new MockHttpError(400, { error: 'invalid_request', issues: [{ message }] });

function findIncident(id: string): Incident {
  const incident = db.incidents.find((i) => i.id === id);
  if (!incident) throw notFound('incident');
  return incident;
}

function serviceName(id: string) {
  return db.services.find((s) => s.id === id)?.name ?? 'unknown';
}

/** Mirrors the Temporal Query: a projection of the running workflow's state. */
function incidentState(incident: Incident): IncidentState {
  const anomalies = db.anomalies.filter((a) => a.incidentId === incident.id);
  const verdict = incident.title
    ? {
        isIncident: incident.status !== 'noise',
        severity: incident.severity ?? 'SEV3',
        confidence: incident.confidence ?? 0,
        title: incident.title,
        summary: incident.summary ?? '',
        suspectedComponent: incident.suspectedComponent ?? '',
        userImpact: incident.userImpact ?? '',
        startedAt: incident.startedAt,
        reasoning: incident.status === 'noise' ? (incident.summary ?? '') : 'Error-rate and log anomalies are correlated.',
      }
    : null;
  const investigation = incident.rootCause && incident.fix ? { rootCauses: incident.rootCause, fix: incident.fix } : null;
  const verification =
    incident.finalReport?.verification ??
    (incident.status === 'awaiting_recovery' ? { status: 'skipped' as const, details: 'Runbook fix; nothing to build.' } : null);
  return {
    incidentId: incident.id,
    fingerprint: incident.fingerprint,
    status: incident.status,
    anomalies: anomalies.map((a) => ({
      anomalyId: a.id,
      serviceId: a.serviceId,
      serviceName: serviceName(a.serviceId),
      source: a.source,
      signal: a.signal,
      value: a.value,
      baselineMean: a.baselineMean,
      baselineStd: a.baselineStd,
      zScore: a.zScore,
      observedAt: a.observedAt,
      ...(a.detail && { detail: a.detail }),
    })),
    verdict,
    investigation,
    verification,
    acknowledgedBy: incident.acknowledgedBy,
    escalated: !incident.acknowledgedBy && Date.now() - Date.parse(incident.detectedAt) > 10 * 60_000 && incident.severity !== 'SEV3',
    slack: incident.slackChannel && incident.slackThreadTs ? { channel: incident.slackChannel, threadTs: incident.slackThreadTs } : null,
    usage: { tokens: incident.tokensUsed, costUsd: incident.costUsd },
    budgetExhausted: false,
  };
}

/** Same matching rules as GET /api/evaluation. */
function evaluation(days: number): Evaluation {
  const since = Date.now() - days * 86_400_000;
  const GRACE = 15 * 60_000;
  const injections = db.chaosInjections.filter((i) => Date.parse(i.startedAt) >= since);
  const incidents = db.incidents.filter((i) => Date.parse(i.detectedAt) >= since && i.status !== 'noise');
  const matched = new Set<string>();
  const ttr: number[] = [];
  const perInjection = injections.map((inj) => {
    const start = Date.parse(inj.startedAt);
    const end = Date.parse(inj.endedAt ?? inj.startedAt) + GRACE;
    const hit = incidents
      .filter((i) => i.serviceId === inj.serviceId && Date.parse(i.detectedAt) >= start && Date.parse(i.detectedAt) <= end)
      .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))[0];
    if (hit) {
      matched.add(hit.id);
      if (hit.initialReportAt) ttr.push((Date.parse(hit.initialReportAt) - start) / 1000);
    }
    return { label: inj.label, faultType: inj.faultType, detected: !!hit, incidentId: hit?.id ?? null };
  });
  const judged = db.feedback.filter((f) => matched.has(f.incidentId) && f.verdict !== 'not_incident');
  const underTest = new Set(injections.map((i) => i.serviceId));
  const candidates = incidents.filter((i) => underTest.has(i.serviceId));
  const sorted = [...ttr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    windowDays: days,
    injections: injections.length,
    incidents: candidates.length,
    recall: injections.length ? matched.size / injections.length : null,
    precision: candidates.length ? matched.size / candidates.length : null,
    medianTimeToInitialReportSec: sorted.length ? (sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) : null,
    rootCauseAccuracy: judged.length ? judged.filter((f) => f.verdict === 'correct').length / judged.length : null,
    perInjection,
  };
}

const SERVICE_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

function validateService(body: Partial<NewService>, partial: boolean) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !SERVICE_NAME.test(body.name)) throw invalid('name: lowercase letters, digits and dashes');
  }
  if ((!partial || body.promSelector !== undefined) && !body.promSelector) throw invalid('promSelector is required');
  if ((!partial || body.lokiSelector !== undefined) && !/^\{.*\}$/.test(body.lokiSelector ?? ''))
    throw invalid('lokiSelector must be a LogQL stream selector, e.g. {app="checkout"}');
  if (body.githubRepo && !/^[\w.-]+\/[\w.-]+$/.test(body.githubRepo)) throw invalid('githubRepo must look like owner/repo');
}

type Handler = (params: Record<string, string>, query: URLSearchParams, body: unknown, userId: string) => unknown;

const routes: Array<[method: string, pattern: string, handler: Handler]> = [
  ['GET', '/healthz', () => ({ ok: true })],

  ['GET', '/api/services', () => [...db.services].sort((a, b) => a.name.localeCompare(b.name))],
  [
    'POST',
    '/api/services',
    (_p, _q, body) => {
      const b = body as NewService;
      validateService(b, false);
      if (db.services.some((s) => s.name === b.name)) throw new MockHttpError(409, { error: 'service_exists' });
      const now = new Date().toISOString();
      const service: Service = {
        id: crypto.randomUUID(),
        githubRepo: null,
        slackChannel: null,
        sloTarget: 0.999,
        verifyImage: null,
        verifyCommand: null,
        enabled: true,
        ...b,
        createdAt: now,
        updatedAt: now,
      };
      db.services.push(service);
      return service;
    },
  ],
  [
    'PATCH',
    '/api/services/:id',
    ({ id }, _q, body) => {
      const service = db.services.find((s) => s.id === id);
      if (!service) throw notFound('service');
      const { name: _ignored, ...patch } = body as Partial<NewService>;
      validateService(patch, true);
      Object.assign(service, patch, { updatedAt: new Date().toISOString() });
      return service;
    },
  ],
  [
    'DELETE',
    '/api/services/:id',
    ({ id }) => {
      const service = db.services.find((s) => s.id === id);
      if (!service) throw notFound('service');
      service.enabled = false;
      service.updatedAt = new Date().toISOString();
      return null;
    },
  ],

  [
    'GET',
    '/api/incidents',
    (_p, q) => {
      const status = q.get('status');
      const serviceId = q.get('serviceId');
      const limit = Math.min(Number(q.get('limit') ?? 50), 200);
      return db.incidents
        .filter((i) => (!status || i.status === status) && (!serviceId || i.serviceId === serviceId))
        .slice(0, limit);
    },
  ],
  ['GET', '/api/incidents/:id', ({ id }) => {
    const incident = findIncident(id!);
    return { ...incident, anomalies: db.anomalies.filter((a) => a.incidentId === incident.id) };
  }],
  ['GET', '/api/incidents/:id/state', ({ id }) => incidentState(findIncident(id!))],
  [
    'POST',
    '/api/incidents/:id/ack',
    ({ id }, _q, _b, userId) => {
      const incident = findIncident(id!);
      incident.acknowledgedBy ??= userId;
      incident.acknowledgedAt ??= new Date().toISOString();
      return { ok: true };
    },
  ],
  [
    'POST',
    '/api/incidents/:id/feedback',
    ({ id }, _q, body, userId) => {
      const incident = findIncident(id!);
      const { verdict, comment } = body as { verdict: FeedbackVerdict; comment?: string };
      if (!['correct', 'wrong_root_cause', 'not_incident'].includes(verdict)) throw invalid('verdict is invalid');
      db.feedback.push({ id: crypto.randomUUID(), incidentId: incident.id, verdict, userId, comment: comment ?? null, createdAt: new Date().toISOString() });
      return { ok: true };
    },
  ],

  ['GET', '/api/evaluation', (_p, q) => evaluation(Math.min(Math.max(Number(q.get('days') ?? 7), 1), 90))],
];

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Resolve a request against the mock routes after a short, realistic delay. */
export async function mockRequest(method: string, url: string, body: unknown, userId: string): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
  const { pathname, searchParams } = new URL(url, 'http://mock.local');
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const params = match(pattern, pathname);
    if (params) return structuredClone(handler(params, searchParams, body, userId));
  }
  throw new MockHttpError(404, { error: 'not_found' });
}

