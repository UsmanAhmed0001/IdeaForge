import type { Channel, Video } from './types';

const API = 'https://www.googleapis.com/youtube/v3';
const key = () => process.env.YOUTUBE_API_KEY || '';

async function yt(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, key: key() });
  const res = await fetch(`${API}/${path}?${qs}`, { signal: AbortSignal.timeout(10_000) });
  const data = await res.json();
  if (data.error) throw new Error(`YouTube: ${data.error.message}`);
  return data;
}

type Parsed = { kind: 'id' | 'handle' | 'username' | 'query'; value: string };

export function parseInput(raw: string): Parsed {
  const input = raw.trim();
  if (!/youtube\.com|youtu\.be/i.test(input)) {
    // "@mkbhd" or a single word is probably a handle; anything else is a search
    if (/^@?[\w.-]{3,30}$/.test(input)) return { kind: 'handle', value: input.replace(/^@/, '') };
    return { kind: 'query', value: input };
  }
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    const [first, second] = u.pathname.split('/').filter(Boolean);
    if (first?.startsWith('@')) return { kind: 'handle', value: first.slice(1) };
    if (first === 'channel' && second) return { kind: 'id', value: second };
    if (first === 'user' && second) return { kind: 'username', value: second };
    if (first === 'c' && second) return { kind: 'query', value: second };
    if (first && !['watch', 'playlist', 'shorts', 'live', 'feed', 'results'].includes(first)) {
      return { kind: 'handle', value: first };
    }
  } catch { /* not a URL */ }
  throw new Error('That YouTube link points to a video or playlist. Paste the channel link instead.');
}

/** Resolves input to a channel id. Handle lookups cost 1 quota unit; search costs 100, so it goes last. */
export async function resolveChannelId(raw: string): Promise<string> {
  const parsed = parseInput(raw);
  if (parsed.kind === 'id') return parsed.value;

  if (parsed.kind === 'handle') {
    const d = await yt('channels', { part: 'id', forHandle: parsed.value });
    if (d.items?.length) return d.items[0].id;
  }
  if (parsed.kind === 'username') {
    const d = await yt('channels', { part: 'id', forUsername: parsed.value });
    if (d.items?.length) return d.items[0].id;
  }
  const d = await yt('search', { part: 'id', type: 'channel', maxResults: '1', q: parsed.value });
  const id = d.items?.[0]?.id?.channelId;
  if (!id) throw new Error(`Couldn't find a channel called "${parsed.value}".`);
  return id;
}

interface YtThumbs { maxres?: { url: string }; high?: { url: string }; medium?: { url: string }; default?: { url: string } }
const bestThumb = (t?: YtThumbs) => t?.maxres?.url || t?.high?.url || t?.medium?.url || t?.default?.url || '';

export async function fetchChannel(channelId: string): Promise<{ channel: Channel; videos: Video[] }> {
  const ch = await yt('channels', { part: 'snippet,statistics,contentDetails', id: channelId });
  const c = ch.items?.[0];
  if (!c) throw new Error('Channel not found.');

  const uploads: string | undefined = c.contentDetails?.relatedPlaylists?.uploads;
  const pl = uploads
    ? await yt('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '12' })
    : { items: [] };

  const ids: string[] = (pl.items || [])
    .map((i: { snippet?: { resourceId?: { videoId?: string } } }) => i.snippet?.resourceId?.videoId)
    .filter(Boolean);

  const views = new Map<string, number>();
  if (ids.length) {
    const st = await yt('videos', { part: 'statistics', id: ids.join(',') });
    for (const v of st.items || []) views.set(v.id, Number(v.statistics?.viewCount || 0));
  }

  const videos: Video[] = (pl.items || []).map((i: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails: YtThumbs } }) => ({
    id: i.snippet.resourceId.videoId,
    title: i.snippet.title,
    publishedAt: i.snippet.publishedAt,
    thumbnail: bestThumb(i.snippet.thumbnails),
    views: views.get(i.snippet.resourceId.videoId) || 0,
  })).filter((v: Video) => v.id && v.title !== 'Private video' && v.title !== 'Deleted video');

  return {
    channel: {
      id: channelId,
      name: c.snippet?.title || 'Unknown channel',
      handle: c.snippet?.customUrl || '',
      description: (c.snippet?.description || '').slice(0, 500),
      avatar: bestThumb(c.snippet?.thumbnails),
      subscribers: Number(c.statistics?.subscriberCount || 0),
    },
    videos,
  };
}
