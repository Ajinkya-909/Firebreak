import { WebClient, type KnownBlock } from '@slack/web-api';
import { env } from '../config/env.js';

let client: WebClient | null | undefined;

export function slack(): WebClient | null {
  if (client === undefined) client = env.SLACK_BOT_TOKEN ? new WebClient(env.SLACK_BOT_TOKEN) : null;
  return client;
}

export async function postMessage(channel: string, text: string, blocks?: KnownBlock[], threadTs?: string) {
  const res = await slack()?.chat.postMessage({ channel, text, blocks, thread_ts: threadTs });
  return res?.ts ? { channel: res.channel ?? channel, ts: res.ts } : null;
}

export async function updateMessage(channel: string, ts: string, text: string, blocks?: KnownBlock[]) {
  await slack()?.chat.update({ channel, ts, text, blocks });
}
