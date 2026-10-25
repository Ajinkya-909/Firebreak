import { mockRequest, MockHttpError } from './mock/server';
import type {
  Evaluation,
  FeedbackVerdict,
  Incident,
  IncidentDetail,
  IncidentFilters,
  IncidentState,
  NewService,
  Service,
} from './types';

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const err = (body as { error?: string } | null)?.error;
    super(err ? `${err.replaceAll('_', ' ')} (HTTP ${status})` : `Request failed (HTTP ${status})`);
  }

  /** First validation message from a 400 `invalid_request` body, if any. */
  get issue(): string | undefined {
    return (this.body as { issues?: Array<{ message?: string }> } | null)?.issues?.[0]?.message;
  }
}

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;
let currentUserId = 'demo_user';

/** Wired by the auth provider: Clerk session token in live mode, demo identity in mock mode. */
export function configureApiAuth(opts: { getToken: TokenGetter; userId: string }) {
  getToken = opts.getToken;
  currentUserId = opts.userId;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (API_MODE === 'mock') {
    try {
      return (await mockRequest(method, path, body, currentUserId)) as T;
    } catch (err) {
      if (err instanceof MockHttpError) throw new ApiError(err.status, err.body);
      throw err;
    }
  }

  const token = await getToken();
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined).map(([k, v]) => [k, String(v)]),
  ).toString();
  return s ? `?${s}` : '';
};

export const api = {
  listServices: () => request<Service[]>('GET', '/api/services'),
  createService: (body: NewService) => request<Service>('POST', '/api/services', body),
  updateService: (id: string, body: Partial<NewService>) => request<Service>('PATCH', `/api/services/${id}`, body),
  disableService: (id: string) => request<null>('DELETE', `/api/services/${id}`),

  listIncidents: (f: IncidentFilters = {}) => request<Incident[]>('GET', `/api/incidents${qs({ ...f })}`),
  getIncident: (id: string) => request<IncidentDetail>('GET', `/api/incidents/${id}`),
  getIncidentState: (id: string) => request<IncidentState>('GET', `/api/incidents/${id}/state`),
  acknowledge: (id: string) => request<{ ok: true }>('POST', `/api/incidents/${id}/ack`),
  sendFeedback: (id: string, verdict: FeedbackVerdict, comment?: string) =>
    request<{ ok: true }>('POST', `/api/incidents/${id}/feedback`, { verdict, comment }),

  evaluation: (days: number) => request<Evaluation>('GET', `/api/evaluation${qs({ days })}`),
};
