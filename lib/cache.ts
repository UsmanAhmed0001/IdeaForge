// In-memory cache and rate limit. Best-effort: each warm serverless instance
// keeps its own copy. Swap for Upstash Redis when traffic justifies it.

import type { StreamEvent } from './types';

const RESULT_TTL = 6 * 60 * 60 * 1000; // 6 hours
const results = new Map<string, { events: StreamEvent[]; at: number }>();

export function getCached(channelId: string): StreamEvent[] | null {
  const hit = results.get(channelId);
  if (!hit) return null;
  if (Date.now() - hit.at > RESULT_TTL) { results.delete(channelId); return null; }
  return hit.events;
}

export function setCached(channelId: string, events: StreamEvent[]) {
  if (results.size > 200) results.delete(results.keys().next().value as string);
  results.set(channelId, { events, at: Date.now() });
}

const WINDOW = 10 * 60 * 1000; // 10 minutes
const LIMIT = 8;
const hits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 if allowed. */
export function rateLimit(ip: string): number {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (recent.length >= LIMIT) return Math.ceil((WINDOW - (now - recent[0])) / 1000);
  recent.push(now);
  hits.set(ip, recent);
  return 0;
}
