import { Supermemory } from 'supermemory';
import { requireEnv } from '../config/env.js';

/**
 * Long-term incident memory. One namespace per service keeps recall focused on that
 * service's history; `kind` metadata separates the kinds of memory the agents use.
 */
export type MemoryKind = 'noise_pattern' | 'incident_report' | 'rejected_fix' | 'feedback';

let client: Supermemory | undefined;

function sm(): Supermemory {
  client ??= new Supermemory({ apiKey: requireEnv('SUPERMEMORY_API_KEY'), timeoutInSeconds: 20 });
  return client;
}

export const serviceNamespace = (serviceName: string) => `firebreak-svc-${serviceName}`;

export async function remember(input: {
  serviceName: string;
  kind: MemoryKind;
  content: string;
  id: string;
  metadata?: Record<string, string | number | boolean | string[]>;
}): Promise<void> {
  await sm().add(serviceNamespace(input.serviceName), {
    content: input.content,
    id: input.id,
    metadata: { kind: input.kind, ...input.metadata },
    dreaming: 'instant',
  });
}

export interface Recalled {
  text: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function recall(input: {
  serviceName: string;
  query: string;
  kinds?: MemoryKind[];
  limit?: number;
}): Promise<Recalled[]> {
  const { results } = await sm().search(serviceNamespace(input.serviceName), {
    query: input.query,
    limit: input.limit ?? 5,
    searchMode: 'hybrid',
  });
  return results
    .filter((r) => !input.kinds || input.kinds.includes(r.metadata.kind as MemoryKind))
    .map((r) => ({ text: r.memory ?? r.chunk ?? '', similarity: r.similarity, metadata: r.metadata }));
}
