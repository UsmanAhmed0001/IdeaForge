// Caching and rate limits.
// Briefs: one per channel per day (UTC), kept in memory and in Vercel Blob,
// so re-running a channel the same day makes no AI calls.

import type { StreamEvent } from './types';
import { readJSON, saveJSON } from './store';

const today = () => new Date().toISOString().slice(0, 10);
const briefPath = (channelId: string) => `briefs/${channelId}/${today()}.json`;

const memory = new Map<string, StreamEvent[]>();

export async function getCached(channelId: string): Promise<StreamEvent[] | null> {
  const key = briefPath(channelId);
  const hit = memory.get(key);
  if (hit) return hit;

  const stored = await readJSON<StreamEvent[]>(key);
  if (stored?.length) {
    remember(key, stored);
    return stored;
  }
  return null;
}

export async function setCached(channelId: string, events: StreamEvent[]) {
  const key = briefPath(channelId);
  remember(key, events);
  await saveJSON(key, events);
}

function remember(key: string, events: StreamEvent[]) {
  if (memory.size > 200) memory.delete(memory.keys().next().value as string);
  memory.set(key, events);
}

// ── Rate limits (per server instance) ─────────────────────────────────────────

const WINDOW = 10 * 60 * 1000; // 10 minutes
const buckets = new Map<string, number[]>();

/** Returns seconds to wait, or 0 if allowed. */
export function rateLimit(ip: string, kind: 'brief' | 'image' = 'brief'): number {
  const limit = kind === 'brief' ? 8 : 15;
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter(t => now - t < WINDOW);
  if (recent.length >= limit) return Math.ceil((WINDOW - (now - recent[0])) / 1000);
  recent.push(now);
  buckets.set(key, recent);
  return 0;
}
