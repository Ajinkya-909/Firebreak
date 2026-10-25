import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const severityEnum = pgEnum('severity', ['SEV1', 'SEV2', 'SEV3']);

export const incidentStatusEnum = pgEnum('incident_status', [
  'triaging',
  'noise',
  'open',
  'investigating',
  'verifying',
  'awaiting_recovery',
  'resolved',
]);

export const signalSourceEnum = pgEnum('signal_source', ['prometheus', 'loki', 'predictive', 'deploy_guard']);

export const feedbackVerdictEnum = pgEnum('feedback_verdict', ['correct', 'wrong_root_cause', 'not_incident']);

/** A monitored service and how to find its telemetry. */
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  // PromQL label matcher, e.g. `job="checkout"`. Interpolated into the RED/saturation queries.
  promSelector: text('prom_selector').notNull(),
  // LogQL stream selector, e.g. `{app="checkout"}`.
  lokiSelector: text('loki_selector').notNull(),
  githubRepo: text('github_repo'),
  slackChannel: text('slack_channel'),
  sloTarget: doublePrecision('slo_target').default(0.999).notNull(),
  // Fix verification: image with the service's toolchain, and the command that runs its tests
  // (or replays captured traffic) from the repo root.
  verifyImage: text('verify_image'),
  verifyCommand: text('verify_command'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fingerprint: text('fingerprint').notNull(),
    workflowId: text('workflow_id').notNull(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    status: incidentStatusEnum('status').default('triaging').notNull(),
    severity: severityEnum('severity'),
    confidence: doublePrecision('confidence'),
    title: text('title'),
    summary: text('summary'),
    suspectedComponent: text('suspected_component'),
    userImpact: text('user_impact'),
    rootCause: jsonb('root_cause'),
    fix: jsonb('fix'),
    finalReport: jsonb('final_report'),
    slackChannel: text('slack_channel'),
    slackThreadTs: text('slack_thread_ts'),
    acknowledgedBy: text('acknowledged_by'),
    // Ground-truth label from the chaos lab, when the fault was injected. Used for precision/recall.
    chaosLabel: text('chaos_label'),
    tokensUsed: integer('tokens_used').default(0).notNull(),
    costUsd: doublePrecision('cost_usd').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    initialReportAt: timestamp('initial_report_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('incidents_workflow_id_idx').on(t.workflowId),
    index('incidents_service_status_idx').on(t.serviceId, t.status),
  ],
);

/** Every anomaly that crossed the statistical threshold, merged or not. */
export const anomalies = pgTable(
  'anomalies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    incidentId: uuid('incident_id').references(() => incidents.id),
    source: signalSourceEnum('source').notNull(),
    signal: text('signal').notNull(),
    value: doublePrecision('value').notNull(),
    baselineMean: doublePrecision('baseline_mean'),
    baselineStd: doublePrecision('baseline_std'),
    zScore: doublePrecision('z_score'),
    detail: jsonb('detail'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('anomalies_service_observed_idx').on(t.serviceId, t.observedAt)],
);

export const deploys = pgTable('deploys', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id')
    .references(() => services.id)
    .notNull(),
  sha: text('sha').notNull(),
  previousSha: text('previous_sha'),
  deployedAt: timestamp('deployed_at', { withTimezone: true }).notNull(),
  guardWorkflowId: text('guard_workflow_id'),
  regressed: boolean('regressed'),
});

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id')
    .references(() => incidents.id)
    .notNull(),
  verdict: feedbackVerdictEnum('verdict').notNull(),
  userId: text('user_id').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type Anomaly = typeof anomalies.$inferSelect;
export type Deploy = typeof deploys.$inferSelect;

/** Known log templates per service, for new-signature detection. */
export const logSignatures = pgTable(
  'log_signatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    signature: text('signature').notNull(),
    template: text('template').notNull(),
    sample: text('sample'),
    occurrences: integer('occurrences').default(0).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('log_signatures_service_sig_idx').on(t.serviceId, t.signature)],
);

/**
 * Ground truth from the chaos lab (separate repo). Each injected fault is reported here with
 * its label so detection precision/recall and root-cause accuracy can be measured.
 */
export const chaosInjections = pgTable(
  'chaos_injections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id').notNull().unique(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    label: text('label').notNull(),
    faultType: text('fault_type').notNull(),
    expectedRootCause: text('expected_root_cause'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    matchedIncidentId: uuid('matched_incident_id').references(() => incidents.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('chaos_injections_service_started_idx').on(t.serviceId, t.startedAt)],
);
