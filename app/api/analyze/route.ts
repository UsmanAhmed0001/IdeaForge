import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY!;

// ─── AI helper via OpenRouter ─────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'IdeaForge',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        {
          role: 'system',
          content: 'You are a YouTube content strategist. Always respond with valid JSON only — no markdown, no code fences, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter error ${res.status}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');
  return content;
}

function parseJSON(text: string) {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const ai = clean.indexOf('['), ae = clean.lastIndexOf(']');
  if (ai !== -1 && ae > ai) try { return JSON.parse(clean.slice(ai, ae + 1)); } catch {}
  const oi = clean.indexOf('{'), oe = clean.lastIndexOf('}');
  if (oi !== -1 && oe > oi) try { return JSON.parse(clean.slice(oi, oe + 1)); } catch {}
  return null;
}

// ─── YouTube URL parsing ───────────────────────────────────────────────────────

function parseYouTubeUrl(url: string): { type: string; value: string } | null {
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
    const p = u.pathname;
    if (p.match(/^\/@([^/?&]+)/)) return { type: 'handle', value: p.slice(2).split('/')[0] };
    if (p.match(/^\/channel\/([^/?&]+)/)) return { type: 'channelId', value: p.split('/')[2] };
    if (p.match(/^\/c\/([^/?&]+)/)) return { type: 'custom', value: p.split('/')[2] };
    if (p.match(/^\/user\/([^/?&]+)/)) return { type: 'username', value: p.split('/')[2] };
    const part = p.split('/')[1];
    if (part && !['watch', 'playlist', 'shorts', 'live', 'feed', 'results'].includes(part))
      return { type: 'username', value: part };
  } catch {}
  return null;
}

async function resolveChannelId(parsed: { type: string; value: string }): Promise<string> {
  if (parsed.type === 'channelId') return parsed.value;

  let apiUrl = '';
  if (parsed.type === 'handle') {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?forHandle=${encodeURIComponent(parsed.value)}&part=id&key=${YOUTUBE_KEY}`;
  } else if (parsed.type === 'username') {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?forUsername=${encodeURIComponent(parsed.value)}&part=id&key=${YOUTUBE_KEY}`;
  } else {
    apiUrl = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(parsed.value)}&type=channel&part=id&maxResults=1&key=${YOUTUBE_KEY}`;
  }

  const res = await fetch(apiUrl);
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  if (!data.items?.length) throw new Error('Channel not found — check the URL and try again.');
  const item = data.items[0];
  return item.id?.channelId || item.id;
}

// ─── YouTube channel + videos ──────────────────────────────────────────────────

interface Video {
  title: string;
  description: string;
  publishedAt: string;
  videoId: string;
  thumbnail: string;
}

interface ChannelData {
  channelName: string;
  channelDescription: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videos: Video[];
}

async function fetchChannelData(channelId: string): Promise<ChannelData> {
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=contentDetails,snippet,statistics&key=${YOUTUBE_KEY}`
  );
  const channelData = await channelRes.json();
  if (channelData.error) throw new Error(`YouTube API: ${channelData.error.message}`);
  if (!channelData.items?.length) throw new Error('Channel data not found.');

  const ch = channelData.items[0];
  const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('Could not find uploads playlist.');

  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsId}&part=snippet&maxResults=10&key=${YOUTUBE_KEY}`
  );
  const videosData = await videosRes.json();
  if (videosData.error) throw new Error(`YouTube API: ${videosData.error.message}`);

  const videos: Video[] = (videosData.items || []).map((item: any) => ({
    title: item.snippet?.title || 'Untitled',
    description: (item.snippet?.description || '').slice(0, 300),
    publishedAt: item.snippet?.publishedAt || '',
    videoId: item.snippet?.resourceId?.videoId || '',
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url || '',
  }));

  return {
    channelName: ch.snippet?.title || 'Unknown Channel',
    channelDescription: ch.snippet?.description?.slice(0, 400) || '',
    thumbnailUrl:
      ch.snippet?.thumbnails?.high?.url ||
      ch.snippet?.thumbnails?.medium?.url ||
      ch.snippet?.thumbnails?.default?.url || '',
    subscriberCount: ch.statistics?.subscriberCount
      ? Number(ch.statistics.subscriberCount).toLocaleString()
      : 'N/A',
    videos,
  };
}

// ─── Reddit search ─────────────────────────────────────────────────────────────

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  url: string;
}

async function searchReddit(query: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=month&limit=8`,
      {
        headers: { 'User-Agent': 'IdeaForge/1.0 content-research-tool' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.children || []).slice(0, 6).map((p: any) => ({
      title: p.data.title,
      subreddit: p.data.subreddit,
      score: p.data.score,
      comments: p.data.num_comments,
      url: `https://reddit.com${p.data.permalink}`,
    }));
  } catch { return []; }
}

// ─── Channel analysis ─────────────────────────────────────────────────────────

interface NewsItem { headline: string; summary: string; relevance: string; }
interface ChannelAnalysis {
  topics: string[];
  channelStyle: string;
  targetAudience: string;
  contentFormat: string;
  news: NewsItem[];
}

async function analyzeChannel(
  channelName: string,
  channelDescription: string,
  videos: Video[]
): Promise<ChannelAnalysis> {
  const videoList = videos
    .map((v, i) => `${i + 1}. "${v.title}" — ${new Date(v.publishedAt).toLocaleDateString('en-GB')}`)
    .join('\n');

  const text = await callAI(
    `Analyse this YouTube channel.

CHANNEL: "${channelName}"
DESCRIPTION: ${channelDescription || '(none)'}

LAST 10 VIDEOS:
${videoList}

Tasks:
1. Identify 4-7 core topics/themes
2. Describe the content style, tone, format
3. Identify target audience
4. Based on your knowledge, suggest 4-5 relevant recent news topics or trends that this channel should cover right now (May 2026)

Return this exact JSON structure:
{"topics":["topic1","topic2"],"channelStyle":"description","targetAudience":"description","contentFormat":"description","news":[{"headline":"headline","summary":"1-2 sentence summary","relevance":"why relevant"}]}`
  );

  const parsed = parseJSON(text) as ChannelAnalysis;
  if (parsed?.topics) return parsed;
  return { topics: [channelName], channelStyle: 'N/A', targetAudience: 'General', contentFormat: 'YouTube videos', news: [] };
}

// ─── Idea generation ──────────────────────────────────────────────────────────

interface VideoIdea { id: number; title: string; thumbnailDesign: string; videoIdea: string; }

async function generateVideoIdeas(
  channelName: string,
  analysis: ChannelAnalysis,
  videos: Video[],
  redditPosts: RedditPost[]
): Promise<VideoIdea[]> {
  const videoList = videos.map((v, i) => `${i + 1}. "${v.title}"`).join('\n');
  const newsList = analysis.news.length
    ? analysis.news.map(n => `• ${n.headline}: ${n.summary}`).join('\n')
    : 'No news data.';
  const redditList = redditPosts.length
    ? redditPosts.map(p => `• r/${p.subreddit} | ${p.score} upvotes | "${p.title}"`).join('\n')
    : 'No Reddit data.';

  const text = await callAI(
    `Generate 5 outstanding YouTube video ideas for this channel.

CHANNEL: ${channelName}
STYLE: ${analysis.channelStyle}
FORMAT: ${analysis.contentFormat}
AUDIENCE: ${analysis.targetAudience}
TOPICS: ${analysis.topics.join(', ')}

RECENT VIDEOS (match this title style exactly):
${videoList}

RELEVANT NEWS/TRENDS:
${newsList}

REDDIT DISCUSSIONS:
${redditList}

Rules:
- Titles MUST match the channel's exact style (same capitalisation, punctuation, hook pattern, length)
- Each idea must connect to the news or Reddit data above
- Thumbnail: specific layout, colors, main image, text overlay, mood
- Concept: what the video covers, key points, why it will perform well now

Return this exact JSON array with exactly 5 items:
[{"id":1,"title":"","thumbnailDesign":"","videoIdea":""},{"id":2,"title":"","thumbnailDesign":"","videoIdea":""},{"id":3,"title":"","thumbnailDesign":"","videoIdea":""},{"id":4,"title":"","thumbnailDesign":"","videoIdea":""},{"id":5,"title":"","thumbnailDesign":"","videoIdea":""}]`
  );

  const parsed = parseJSON(text);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as VideoIdea[];
  return [];
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!YOUTUBE_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY is not configured.' }, { status: 500 });
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 });

    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });

    const parsed = parseYouTubeUrl(url);
    if (!parsed) return NextResponse.json({ error: 'Could not parse YouTube URL. Try: youtube.com/@channelname' }, { status: 400 });

    const channelId = await resolveChannelId(parsed);
    const channelData = await fetchChannelData(channelId);

    const analysis = await analyzeChannel(
      channelData.channelName,
      channelData.channelDescription,
      channelData.videos
    );

    const redditResults = await Promise.all([
      searchReddit(analysis.topics[0] || channelData.channelName),
      analysis.topics[1] ? searchReddit(analysis.topics[1]) : Promise.resolve([]),
    ]);
    const redditPosts = [...redditResults[0], ...redditResults[1]]
      .filter((p, i, arr) => arr.findIndex(q => q.title === p.title) === i)
      .slice(0, 8);

    const ideas = await generateVideoIdeas(
      channelData.channelName,
      analysis,
      channelData.videos,
      redditPosts
    );

    return NextResponse.json({
      channel: {
        channelName: channelData.channelName,
        channelDescription: channelData.channelDescription,
        thumbnailUrl: channelData.thumbnailUrl,
        subscriberCount: channelData.subscriberCount,
        channelId,
      },
      videos: channelData.videos,
      analysis,
      redditPosts,
      ideas,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    console.error('[analyze]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}