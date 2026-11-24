// Durable storage on Vercel Blob, so generated briefs and thumbnails survive
// restarts and are shared by every server instance. Needs BLOB_READ_WRITE_TOKEN,
// which Vercel adds automatically when a Blob store is connected to the project.
// Without it, everything falls back to the in-memory cache.

import { createHash } from 'crypto';
import { head, put } from '@vercel/blob';

export const hasStore = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function fingerprint(...parts: string[]): string {
  return createHash('sha256').update(parts.join('␟')).digest('hex').slice(0, 32);
}

/** Public URL of a stored file, or null if it doesn't exist. */
export async function storedUrl(pathname: string): Promise<string | null> {
  if (!hasStore()) return null;
  try {
    return (await head(pathname)).url;
  } catch {
    return null; // not found, or store unavailable
  }
}

export async function saveFile(pathname: string, body: Buffer | string, contentType: string): Promise<string | null> {
  if (!hasStore()) return null;
  try {
    const res = await put(pathname, body, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    return res.url;
  } catch (err) {
    console.error('[store] save failed', pathname, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function readJSON<T>(pathname: string): Promise<T | null> {
  const url = await storedUrl(pathname);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(pathname: string, data: unknown) {
  return saveFile(pathname, JSON.stringify(data), 'application/json');
}
