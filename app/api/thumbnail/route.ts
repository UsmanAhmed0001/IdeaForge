import { NextRequest } from 'next/server';
import { generateThumbnail } from '@/lib/image';
import { fingerprint, saveFile, storedUrl } from '@/lib/store';
import { rateLimit } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same idea → same file. Kept in memory too for when no Blob store is connected.
const memory = new Map<string, string>();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const thumbnailText = typeof body.thumbnailText === 'string' ? body.thumbnailText.trim().slice(0, 60) : '';
  const concept = typeof body.concept === 'string' ? body.concept.trim().slice(0, 900) : '';
  const channelFormat = typeof body.channelFormat === 'string' ? body.channelFormat.trim().slice(0, 200) : '';
  const peek = body.peek === true;

  if (!title) return Response.json({ error: 'Missing the video title.' }, { status: 400 });

  const id = fingerprint(title.toLowerCase(), thumbnailText.toLowerCase());
  const pathname = `thumbs/${id}.png`;

  // 1. Already made? Free.
  const known = memory.get(id) || (await storedUrl(pathname));
  if (known) {
    memory.set(id, known);
    return Response.json({ url: known, cached: true });
  }
  if (peek) return Response.json({ url: null });

  // 2. Otherwise generate once, then keep it.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const wait = rateLimit(ip, 'image');
  if (wait) return Response.json({ error: `Thumbnail limit reached. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429 });

  try {
    const img = await generateThumbnail({ title, thumbnailText, concept, channelFormat });
    const url = (await saveFile(pathname, img.data, img.mime)) || `data:${img.mime};base64,${img.data.toString('base64')}`;
    if (memory.size > 300) memory.delete(memory.keys().next().value as string);
    memory.set(id, url);
    return Response.json({ url, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Thumbnail failed.';
    console.error('[thumbnail]', message);
    return Response.json({ error: message }, { status: 502 });
  }
}