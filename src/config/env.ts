import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),

  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('firebreak'),
  TEMPORAL_API_KEY: z.string().optional(),

  // Clerk reads these from the environment itself; the API process asserts them at boot.
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // JarvisLabs serverless, OpenAI-compatible: https://docs.jarvislabs.ai/serverless/
  JARVIS_API_KEY: z.string().optional(),
  JARVIS_BASE_URL: z.string().url().default('https://serverlessn.jarvislabs.net'),
  JARVIS_DEPLOYMENT_ID: z.string().optional(),
  JARVIS_MODEL: z.string().default('Qwen/Qwen2.5-7B-Instruct'),
  // USD per 1M tokens, used for the per-incident cost guard.
  JARVIS_PRICE_PER_MTOK: z.coerce.number().default(0),

  SUPERMEMORY_API_KEY: z.string().optional(),

  PROMETHEUS_URL: z.string().url().default('http://localhost:9090'),
  LOKI_URL: z.string().url().default('http://localhost:3100'),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_DEFAULT_CHANNEL: z.string().optional(),
  PAGERDUTY_ROUTING_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),

  // Shared secrets for machine-to-machine webhooks (CI deploy events, chaos lab ground truth).
  DEPLOY_WEBHOOK_SECRET: z.string().optional(),
  CHAOS_WEBHOOK_SECRET: z.string().optional(),

  // Detection tuning
  DETECTION_INTERVAL_SECONDS: z.coerce.number().default(60),
  ZSCORE_THRESHOLD: z.coerce.number().default(3),
  RECOVERY_STABLE_MINUTES: z.coerce.number().default(10),
  ACK_ESCALATION_MINUTES: z.coerce.number().default(10),
  DEPLOY_GUARD_MINUTES: z.coerce.number().default(15),
  NOISE_COOLDOWN_MINUTES: z.coerce.number().default(30),
  INCIDENT_TOKEN_BUDGET: z.coerce.number().default(200_000),

  VERIFY_WITH_DOCKER: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

type OptionalKey = { [K in keyof Env]-?: undefined extends Env[K] ? K : never }[keyof Env];

/** Read a variable that only some processes need (API vs worker), failing loudly if unset. */
export function requireEnv<K extends OptionalKey & keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value as NonNullable<Env[K]>;
}
