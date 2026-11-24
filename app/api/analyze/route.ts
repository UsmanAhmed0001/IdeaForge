import { NextRequest } from 'next/server';
import { askJSON, hasAIKey } from '@/lib/ai';
import { resolveChannelId, fetchChannel, fetchNicheVideos } from '@/lib/youtube';
import { fetchNews } from '@/lib/news';
import { fetchReddit } from '@/lib/reddit';
import { getCached, setCached, rateLimit } from '@/lib/cache';
import { SYSTEM, contextBlock, profilePrompt, validateProfile, platformPrompt, validatorFor, relevancePrompt, validateKeep } from '@/lib/prompts';
import { PLATFORM_IDS, type Source, type StreamEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAMES = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook' } as const;

export async function POST(req: NextRequest) {
  const { query } = await req.json().catch(() => ({ query: '' }));
  const input = typeof query === 'string' ? query.trim().slice(0, 200) : '';

  const missing = [
    ...(process.env.YOUTUBE_API_KEY ? [] : ['YOUTUBE_API_KEY']),
    ...(hasAIKey() ? [] : ['GEMINI_API_KEY']),
  ];
  if (missing.length) return Response.json({ error: `Server is missing ${missing.join(', ')}.` }, { status: 500 });
  if (!input) return Response.json({ error: 'Type a channel name or paste a channel link.' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const wait = rateLimit(ip);
  if (wait) return Response.json({ error: `Too many requests. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sent: StreamEvent[] = [];
      const send = (e: StreamEvent) => {
        if (e.type !== 'log') sent.push(e);
        controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      };

      try {
        // 1. Channel
        send({ type: 'log', text: `Looking up "${input}"` });
        const channelId = await resolveChannelId(input);

        const cached = await getCached(channelId);
        if (cached) {
          send({ type: 'log', text: 'Using this channel\'s brief from earlier today' });
          for (const e of cached) send(e);
          send({ type: 'done', cached: true });
          controller.close();
          return;
        }

        const { channel, videos } = await fetchChannel(channelId);
        send({ type: 'channel', channel, videos });
        send({ type: 'log', text: `Found ${channel.name}, read ${videos.length} recent uploads` });

        // 2. Profile
        const profile = await askJSON(SYSTEM, profilePrompt(channel, videos), validateProfile, 0.4);
        send({ type: 'profile', profile });
        send({ type: 'log', text: `Searching this week for: ${profile.searchTerms.join(', ')}` });

        // 3. Sources
        const [news, threads, niche] = await Promise.all([
          fetchNews(profile.searchTerms).catch(() => []),
          fetchReddit(profile.searchTerms).catch(() => []),
          fetchNicheVideos(profile.searchTerms, channelId).catch(() => []),
        ]);
        const found: Source[] = [
          ...news.map((n, i) => ({ id: `N${i + 1}`, kind: 'news' as const, title: n.title, outlet: n.outlet, url: n.url, date: n.date })),
          ...threads.map((t, i) => ({
            id: `R${i + 1}`, kind: 'reddit' as const, title: t.title, outlet: 'Reddit', subreddit: t.subreddit,
            url: t.url, date: t.date, score: t.score, comments: t.comments,
          })),
          ...niche.map((v, i) => ({
            id: `Y${i + 1}`, kind: 'youtube' as const, title: v.title, outlet: v.channel,
            url: `https://www.youtube.com/watch?v=${v.id}`, date: v.publishedAt, views: v.views,
          })),
        ];

        // Drop anything this audience wouldn't care about before it can steer the ideas
        send({ type: 'log', text: `Found ${found.length} items from the last 7 days, checking which fit ${channel.name}` });
        let sources = found;
        if (found.length) {
          const keep = await askJSON(SYSTEM, relevancePrompt(channel, profile, found), validateKeep(new Set(found.map(s => s.id))), 0.2)
            .catch(() => null);
          if (keep) sources = found.filter(s => keep.includes(s.id));
        }
        send({ type: 'sources', sources });
        const count = (k: Source['kind']) => sources.filter(s => s.kind === k).length;
        send({ type: 'log', text: `Kept ${count('news')} headlines, ${count('youtube')} trending videos and ${count('reddit')} Reddit threads` });

        // 4. All five platforms in parallel, each sent the moment it's ready
        const context = contextBlock(channel, videos, profile, sources);
        const known = new Set(sources.map(s => s.id));

        await Promise.all(PLATFORM_IDS.map(async platform => {
          try {
            const items = await askJSON(SYSTEM, platformPrompt(platform, context), validatorFor(platform, known));
            send({ type: 'platform', platform, items });
            send({ type: 'log', text: `${NAMES[platform]} drafts ready` });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed';
            send({ type: 'platform_error', platform, message });
            send({ type: 'log', text: `${NAMES[platform]} failed: ${message}` });
          }
        }));

        if (!sent.some(e => e.type === 'platform_error')) await setCached(channelId, sent);
        send({ type: 'done', cached: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        console.error('[analyze]', message);
        send({ type: 'error', message });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}