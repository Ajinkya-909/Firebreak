import { InMemoryRunner, isFinalResponse, stringifyContent, type BaseAgent, type Event } from '@google/adk';
import { randomUUID } from 'node:crypto';
import { usageFrom } from './llm/jarvis.js';

export interface AgentRun {
  finalText: string;
  state: Record<string, unknown>;
  usage: { tokens: number; costUsd: number };
}

/**
 * Run an agent tree once with an initial state and prompt. Sessions are throwaway: durable
 * context lives in Temporal (workflow state) and Supermemory, not in ADK sessions.
 * `onEvent` lets long-running activities heartbeat while the agents work.
 */
export async function runAgent(
  agent: BaseAgent,
  input: { prompt: string; state?: Record<string, unknown>; onEvent?: (e: Event) => void; abortSignal?: AbortSignal },
): Promise<AgentRun> {
  const runner = new InMemoryRunner({ agent, appName: 'firebreak' });
  const session = await runner.sessionService.createSession({
    appName: 'firebreak',
    userId: 'firebreak',
    sessionId: randomUUID(),
    state: input.state ?? {},
  });

  const events: Event[] = [];
  let finalText = '';
  for await (const event of runner.runAsync({
    userId: 'firebreak',
    sessionId: session.id,
    newMessage: { role: 'user', parts: [{ text: input.prompt }] },
    abortSignal: input.abortSignal,
  })) {
    events.push(event);
    input.onEvent?.(event);
    if (event.errorMessage) throw new Error(`Agent error (${event.errorCode ?? 'unknown'}): ${event.errorMessage}`);
    if (isFinalResponse(event)) finalText = stringifyContent(event) || finalText;
  }

  const finished = await runner.sessionService.getSession({ appName: 'firebreak', userId: 'firebreak', sessionId: session.id });
  return { finalText, state: finished?.state ?? {}, usage: usageFrom(events) };
}
