import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY!;

// ─── AI via OpenRouter ────────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://idea-forge-liart.vercel.app',
      'X-Title': 'IdeaForge',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: 'You are a YouTube content strategist. Always respond with valid JSON only — no markdown, no code fences.' },
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

// ─── YouTube URL parsing ──────────────────────────────────────────────────────

function parseYouTubeUrl(url: string): { type: string; value: string } | null {
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
    const p = u.pathname;
    if (p.match(/^\/@([^/?&]+)/)) return { type: 'handle', value: p.slice(2).split('/')[0] };
    if (p.match(/^\/channel\/([^/?&]+)/)) return { type: 'channelId', value: p.split('/')[2] };
    if (p.match(/^\/c\/([^/?&]+)/)) return { type: 'custom', value: p.split('/')[2] };
    if (p.match(/^\/user\/([^/?&]+)/)) return { type: 'username', value: p.split('/')[2] };
    const part = p.split('/')[1];
    if (part && !['watch','playlist','shorts','live','feed','results'].includes(part))
      return { type: 'username', value: part };
  } catch {}
  return null;
}

async function resolveChannelId(parsed: { type: string; value: string }): Promise<string> {
  if (parsed.type === 'channelId') return parsed.value;
  let apiUrl = '';
  if (parsed.type === 'handle')
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?forHandle=${encodeURIComponent(parsed.value)}&part=id&key=${YOUTUBE_KEY}`;
  else if (parsed.type === 'username')
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?forUsername=${encodeURIComponent(parsed.value)}&part=id&key=${YOUTUBE_KEY}`;
  else
    apiUrl = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(parsed.value)}&type=channel&part=id&maxResults=1&key=${YOUTUBE_KEY}`;
  const res = await fetch(apiUrl);
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  if (!data.items?.length) throw new Error('Channel not found. Check the URL and try again.');
  return data.items[0].id?.channelId || data.items[0].id;
}

// ─── YouTube channel + videos ─────────────────────────────────────────────────

interface Video { title: string; description: string; publishedAt: string; videoId: string; thumbnail: string; }
interface ChannelData { channelName: string; channelDescription: string; thumbnailUrl: string; subscriberCount: string; videos: Video[]; }

async function fetchChannelData(channelId: string): Promise<ChannelData> {
  const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=contentDetails,snippet,statistics&key=${YOUTUBE_KEY}`);
  const chData = await chRes.json();
  if (chData.error) throw new Error(`YouTube: ${chData.error.message}`);
  if (!chData.items?.length) throw new Error('Channel not found.');
  const ch = chData.items[0];
  const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('Could not find uploads playlist.');
  const vRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsId}&part=snippet&maxResults=10&key=${YOUTUBE_KEY}`);
  const vData = await vRes.json();
  if (vData.error) throw new Error(`YouTube: ${vData.error.message}`);
  const videos: Video[] = (vData.items || []).map((item: any) => ({
    title: item.snippet?.title || 'Untitled',
    description: (item.snippet?.description || '').slice(0, 300),
    publishedAt: item.snippet?.publishedAt || '',
    videoId: item.snippet?.resourceId?.videoId || '',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
  }));
  return {
    channelName: ch.snippet?.title || 'Unknown',
    channelDescription: ch.snippet?.description?.slice(0, 400) || '',
    thumbnailUrl: ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || '',
    subscriberCount: ch.statistics?.subscriberCount ? Number(ch.statistics.subscriberCount).toLocaleString() : 'N/A',
    videos,
  };
}

// ─── NewsAPI (real news, free tier 1000/day) ──────────────────────────────────

interface NewsItem { headline: string; summary: string; relevance: string; }

async function fetchNews(channelName: string, topics: string[]): Promise<NewsItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];
  const query = encodeURIComponent(`${channelName}`);
  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).slice(0, 6).map((a: any) => ({
      headline: a.title?.replace(/ - [^-]+$/, '') || '',
      summary: a.description?.slice(0, 200) || '',
      relevance: `Published ${new Date(a.publishedAt).toLocaleDateString()} · ${a.source?.name || 'News'}`,
    })).filter((n: NewsItem) => n.headline.length > 10);
  } catch { return []; }
}

// ─── Reddit via Google RSS ────────────────────────────────────────────────────

interface RedditPost { title: string; subreddit: string; score: number; comments: number; url: string; }

async function fetchReddit(channelName: string): Promise<RedditPost[]> {
  try {
    const q = encodeURIComponent(`${channelName} site:reddit.com`);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return items.slice(0, 6).map((item) => {
      const t = (item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();
      const u = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const sub = u.match(/reddit\.com\/r\/([^/]+)/)?.[1] || 'reddit';
      return { title: t, subreddit: sub, score: 0, comments: 0, url: u };
    }).filter(p => p.title.length > 10);
  } catch { return []; }
}

// ─── Channel analysis ─────────────────────────────────────────────────────────

interface ChannelAnalysis {
  topics: string[]; titleFormula: string; hookWords: string[];
  channelStyle: string; targetAudience: string; contentFormat: string;
  news: NewsItem[];
}

async function analyzeChannel(channelName: string, channelDescription: string, videos: Video[]): Promise<ChannelAnalysis> {
  const videoList = videos.map((v, i) => `${i+1}. "${v.title}"`).join('\n');
  const text = await callAI(`Analyse this YouTube channel. Return ONLY valid JSON.

CHANNEL: "${channelName}"
DESCRIPTION: ${channelDescription || '(none)'}
LAST 10 VIDEOS:
${videoList}

Study the title patterns and return:
{"topics":["topic1","topic2","topic3","topic4"],"titleFormula":"the recurring pattern e.g. I [extreme verb] [thing] for [duration]","hookWords":["word1","word2","word3"],"channelStyle":"specific tone, energy, format description","targetAudience":"specific audience","contentFormat":"specific format e.g. high-budget challenge videos"}`);
  const parsed = parseJSON(text);
  if (parsed?.topics) return { ...parsed, news: [] };
  return { topics:[channelName], titleFormula:'', hookWords:[], channelStyle:'N/A', targetAudience:'General', contentFormat:'YouTube videos', news:[] };
}

// ─── Idea generation ──────────────────────────────────────────────────────────

interface VideoIdea { id: number; title: string; trendConnection: string; thumbnailDesign: string; videoIdea: string; }

async function generateIdeas(channelName: string, analysis: ChannelAnalysis, videos: Video[], reddit: RedditPost[]): Promise<VideoIdea[]> {
  const videoList = videos.map((v,i) => `${i+1}. "${v.title}"`).join('\n');
  const newsList = analysis.news.length
    ? analysis.news.map((n,i) => `[NEWS ${i+1}] ${n.headline} — ${n.summary}`).join('\n')
    : 'No live news available.';
  const redditList = reddit.length
    ? reddit.map((p,i) => `[REDDIT ${i+1}] r/${p.subreddit} — "${p.title}"`).join('\n')
    : 'No Reddit data.';

  const text = await callAI(`You are the world's top YouTube content strategist. Generate 5 viral video ideas for ${channelName}.

TITLE FORMULA: ${analysis.titleFormula}
POWER WORDS: ${analysis.hookWords?.join(', ')}
STYLE: ${analysis.channelStyle}
FORMAT: ${analysis.contentFormat}
AUDIENCE: ${analysis.targetAudience}

RECENT TITLES (copy this EXACT style):
${videoList}

CURRENT NEWS (cite these specifically):
${newsList}

REDDIT DISCUSSIONS (use these for ideas):
${redditList}

Rules:
- Title MUST sound exactly like this creator — same formula, same energy, same length
- Each idea MUST reference a specific [NEWS X] or [REDDIT X] item
- Be SPECIFIC: what exactly happens, what is the hook, what is the twist
- Think: what would make someone stop scrolling and click?

Return ONLY this JSON:
[{"id":1,"title":"","trendConnection":"References [NEWS/REDDIT X]: why this is perfect timing","thumbnailDesign":"exact colors, layout, text overlay, main visual, emotion","videoIdea":"exactly what happens, the hook, why it performs now"},{"id":2,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":3,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":4,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":5,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""}]`);

  const parsed = parseJSON(text);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as VideoIdea[];
  return [];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!YOUTUBE_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured.' }, { status: 500 });
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured.' }, { status: 500 });

    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });

    const parsed = parseYouTubeUrl(url);
    if (!parsed) return NextResponse.json({ error: 'Invalid YouTube URL. Try: youtube.com/@channelname' }, { status: 400 });

    const channelId = await resolveChannelId(parsed);
    const channelData = await fetchChannelData(channelId);

    const [analysis, reddit] = await Promise.all([
      analyzeChannel(channelData.channelName, channelData.channelDescription, channelData.videos),
      fetchReddit(channelData.channelName),
    ]);

    const news = await fetchNews(channelData.channelName, analysis.topics);
    analysis.news = news;

    const ideas = await generateIdeas(channelData.channelName, analysis, channelData.videos, reddit);

    return NextResponse.json({
      channel: { channelName: channelData.channelName, channelDescription: channelData.channelDescription, thumbnailUrl: channelData.thumbnailUrl, subscriberCount: channelData.subscriberCount, channelId },
      videos: channelData.videos,
      analysis,
      redditPosts: reddit,
      ideas,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    console.error('[analyze]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}