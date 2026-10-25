import { BaseLlm, type BaseLlmConnection, type LlmRequest, type LlmResponse } from '@google/adk';
import type { Content, Part, Schema } from '@google/genai';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { env, requireEnv } from '../../config/env.js';

/**
 * ADK model backed by a JarvisLabs serverless deployment. The endpoint is OpenAI-compatible
 * (https://docs.jarvislabs.ai/serverless/), so ADK's Gemini-shaped requests are translated to
 * chat-completions: contents → messages, function declarations → tools, responseSchema →
 * json_schema response_format, and back again for the response.
 */
export class JarvisLlm extends BaseLlm {
  private readonly client: OpenAI;

  constructor(model = env.JARVIS_MODEL) {
    super({ model });
    this.client = new OpenAI({
      apiKey: requireEnv('JARVIS_API_KEY'),
      baseURL: `${env.JARVIS_BASE_URL}/openai/${requireEnv('JARVIS_DEPLOYMENT_ID')}/v1`,
      // JarvisLabs asks clients to retry 408/429/502/503/504 (cold starts, full queues);
      // the OpenAI SDK retries exactly those with backoff.
      maxRetries: 4,
      timeout: 120_000,
    });
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    this.maybeAppendUserContent(llmRequest);
    const config = llmRequest.config ?? {};
    const tools = toOpenAiTools(llmRequest);

    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: toOpenAiMessages(systemText(config.systemInstruction), llmRequest.contents),
        ...(tools.length > 0 && { tools }),
        ...(config.temperature != null && { temperature: config.temperature }),
        ...(config.maxOutputTokens != null && { max_tokens: config.maxOutputTokens }),
        // With tools present, ADK enforces the output schema itself via a set_model_response tool.
        ...(config.responseSchema && tools.length === 0
          ? {
              response_format: {
                type: 'json_schema' as const,
                json_schema: { name: 'response', schema: toJsonSchema(config.responseSchema as Schema), strict: false },
              },
            }
          : {}),
      },
      { signal: abortSignal },
    );

    const choice = completion.choices[0];
    const parts: Part[] = [];
    if (choice?.message.content) parts.push({ text: choice.message.content });
    for (const call of choice?.message.tool_calls ?? []) {
      if (call.type !== 'function') continue;
      parts.push({ functionCall: { id: call.id, name: call.function.name, args: parseArgs(call.function.arguments) } });
    }

    yield {
      content: { role: 'model', parts },
      turnComplete: true,
      usageMetadata: {
        promptTokenCount: completion.usage?.prompt_tokens,
        candidatesTokenCount: completion.usage?.completion_tokens,
        totalTokenCount: completion.usage?.total_tokens,
      },
      modelVersion: completion.model,
    };
  }

  connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    return Promise.reject(new Error('JarvisLlm does not support live (bidirectional) connections'));
  }
}

function systemText(instruction: unknown): string | undefined {
  if (!instruction) return undefined;
  if (typeof instruction === 'string') return instruction;
  const content = instruction as Content;
  return content.parts?.map((p) => p.text ?? '').join('\n') || undefined;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return { _raw: raw };
  }
}

function toOpenAiMessages(system: string | undefined, contents: Content[]): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: 'system', content: system });

  for (const content of contents) {
    const parts = content.parts ?? [];
    const text = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('\n');

    if (content.role === 'model') {
      const toolCalls: ChatCompletionMessageToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({
          id: p.functionCall!.id ?? `call_${i}`,
          type: 'function',
          function: { name: p.functionCall!.name ?? '', arguments: JSON.stringify(p.functionCall!.args ?? {}) },
        }));
      if (!text && toolCalls.length === 0) continue;
      messages.push({ role: 'assistant', content: text || null, ...(toolCalls.length > 0 && { tool_calls: toolCalls }) });
      continue;
    }

    // User turns carry both plain text and the results of the model's tool calls.
    parts
      .filter((p) => p.functionResponse)
      .forEach((p, i) =>
        messages.push({
          role: 'tool',
          tool_call_id: p.functionResponse!.id ?? `call_${i}`,
          content: JSON.stringify(p.functionResponse!.response ?? {}),
        }),
      );
    if (text) messages.push({ role: 'user', content: text });
  }
  return messages;
}

function toOpenAiTools(llmRequest: LlmRequest): ChatCompletionTool[] {
  const declarations = (llmRequest.config?.tools ?? []).flatMap((t) =>
    'functionDeclarations' in t ? (t.functionDeclarations ?? []) : [],
  );
  return declarations.map((d) => ({
    type: 'function',
    function: {
      name: d.name ?? 'unnamed',
      description: d.description,
      parameters: (d.parametersJsonSchema as Record<string, unknown> | undefined) ??
        (d.parameters ? toJsonSchema(d.parameters) : { type: 'object', properties: {} }),
    },
  }));
}

/** genai Schema (OBJECT/STRING/... enums) → plain JSON Schema for OpenAI-compatible servers. */
export function toJsonSchema(schema: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (schema.type) out.type = String(schema.type).toLowerCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.format) out.format = schema.format;
  if (schema.nullable) out.type = [out.type, 'null'];
  if (schema.minimum != null) out.minimum = schema.minimum;
  if (schema.maximum != null) out.maximum = schema.maximum;
  if (schema.items) out.items = toJsonSchema(schema.items);
  if (schema.anyOf) out.anyOf = schema.anyOf.map(toJsonSchema);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toJsonSchema(v)]));
  }
  if (schema.required) out.required = schema.required;
  return out;
}

/** Sum token usage across ADK events, priced for the per-incident cost guard. */
export function usageFrom(events: Array<{ usageMetadata?: { totalTokenCount?: number } }>) {
  const tokens = events.reduce((n, e) => n + (e.usageMetadata?.totalTokenCount ?? 0), 0);
  return { tokens, costUsd: (tokens / 1_000_000) * env.JARVIS_PRICE_PER_MTOK };
}
