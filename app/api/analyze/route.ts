import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY!;

// ─── AI helper via OpenRouter ─────────────────────────────────────────────────

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

// ─── Google News RSS — real live headlines, no API key needed ─────────────────

interface NewsItem { headline: string; summary: string; relevance: string; }

function parseRSS(xml: string, channelName: string): NewsItem[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const results: NewsItem[] = [];
  for (const item of items.slice(0, 6)) {
    const rawTitle = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const rawDesc  = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
    const title = rawTitle
      .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const desc = rawDesc
      .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .slice(0, 220).trim();
    if (title && title.length > 10) {
      results.push({
        headline: title,
        summary: desc || 'Click to read the full story.',
        relevance: `Relevant to ${channelName}'s content and audience`,
      });
    }
  }
  return results;
}

async function fetchRealNews(channelName: string, topics: string[]): Promise<NewsItem[]> {
  const queries = [
    channelName,
    `${channelName} YouTube`,
    topics.slice(0, 2).join(' '),
  ].filter((q, i, arr) => Boolean(q) && arr.indexOf(q) === i);

  for (const query of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaForge/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRSS(xml, channelName);
      if (items.length >= 2) return items;
    } catch { continue; }
  }
  return [];
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
  if (!query?.trim()) return [];
  // Reddit blocks Vercel IPs — use Google News RSS with site:reddit.com instead
  try {
    const rssQuery = `${query} site:reddit.com`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(rssQuery)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaForge/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return items.slice(0, 6).map((item) => {
      const rawTitle = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const rawUrl   = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
                       item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] || '';
      const title = rawTitle
        .replace(/<!\/\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g,'&').replace(/&quot;/g,'"'). replace(/&#39;/g,"'").trim();
      // Extract subreddit from URL if present
      const subMatch = rawUrl.match(/reddit\.com\/r\/([^/]+)/);
      const subreddit = subMatch?.[1] || 'reddit';
      return {
        title,
        subreddit,
        score: 0,
        comments: 0,
        url: rawUrl || `https://reddit.com/search?q=${encodeURIComponent(query)}`,
      };
    }).filter(p => p.title.length > 10);
  } catch { return []; }
}

// ─── Channel analysis (topics & style only — no AI-hallucinated news) ────────

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
): Promise<ChannelAnalysis & { titleFormula: string; hookWords: string[] }> {
  const videoList = videos
    .map((v, i) => `${i + 1}. "${v.title}"`)
    .join('\n');

  const text = await callAI(
    `You are a YouTube analytics expert. Deeply analyse this channel.

CHANNEL: "${channelName}"
DESCRIPTION: ${channelDescription || '(none)'}

LAST 10 VIDEOS (study the title patterns carefully):
${videoList}

Analyse the title formula — what pattern do they consistently use?
Examples of formulas:
- MrBeast style: "I [extreme action] for [time/number]" or "$X vs $X" or "Last To [action] Wins $X"
- Tech reviewer style: "The [product] that [surprising claim]" or "Why I [switched/quit/chose] [product]"
- Commentary style: "[Creator] just [action] and it's [reaction]"

Return ONLY valid JSON, no markdown:
{
  "topics": ["specific niche topic 1", "specific niche topic 2", "specific niche topic 3", "specific niche topic 4"],
  "titleFormula": "describe the exact recurring title pattern with examples from their videos",
  "hookWords": ["power words they use repeatedly"],
  "channelStyle": "specific description: energy level, tone, pacing, production style, what makes it unique",
  "targetAudience": "specific demographic and psychographic description",
  "contentFormat": "specific format description e.g. high-budget outdoor challenges with prize reveals, or talking-head tech reviews with b-roll"
}`
  );

  const parsed = parseJSON(text);
  if (parsed?.topics) return { ...parsed, news: [] };
  return { topics: [channelName], titleFormula: '', hookWords: [], channelStyle: 'N/A', targetAudience: 'General', contentFormat: 'YouTube videos', news: [] };
}

// ─── Idea generation ──────────────────────────────────────────────────────────

interface VideoIdea { id: number; title: string; trendConnection: string; thumbnailDesign: string; videoIdea: string; }

async function generateVideoIdeas(
  channelName: string,
  analysis: ChannelAnalysis & { titleFormula?: string; hookWords?: string[] },
  videos: Video[],
  redditPosts: RedditPost[]
): Promise<VideoIdea[]> {
  const videoList = videos.map((v, i) => `${i + 1}. "${v.title}"`).join('\n');
  const newsList = analysis.news.length
    ? analysis.news.map((n, i) => `[NEWS ${i+1}] ${n.headline}\n   → ${n.summary}`).join('\n')
    : 'No live news available.';
  const redditList = redditPosts.length
    ? redditPosts.map((p, i) => `[REDDIT ${i+1}] r/${p.subreddit} (↑${p.score}) — "${p.title}"`).join('\n')
    : 'No Reddit posts found.';
  const hookWords = analysis.hookWords?.join(', ') || '';
  const titleFormula = analysis.titleFormula || '';

  const text = await callAI(
    `You are the world's best YouTube content strategist with a track record of 100M+ view videos. You understand viral mechanics, trend timing, and audience psychology.

Your task: Generate 5 UNMISSABLE, SPECIFIC, EXECUTABLE video ideas for ${channelName} that capitalise on CURRENT trends.

═══ CHANNEL DNA ═══
Creator: ${channelName}
Title Formula: ${titleFormula}
Power Words They Use: ${hookWords}
Content Style: ${analysis.channelStyle}
Format: ${analysis.contentFormat}
Audience: ${analysis.targetAudience}

═══ THEIR ACTUAL RECENT TITLES (copy this EXACT style, energy, length) ═══
${videoList}

═══ BREAKING NEWS RIGHT NOW (EACH IDEA MUST LINK TO ONE OF THESE) ═══
${newsList}

═══ REDDIT COMMUNITY BUZZ (what their audience is saying RIGHT NOW) ═══
${redditList}

═══ RULES — READ CAREFULLY ═══
1. TITLE: Must sound IDENTICAL to this creator — same capitalisation, same hooks, same length, same energy. If they use "$X" in titles, use it. If they use "I Spent", use it. Do NOT deviate from their formula.
2. TREND CONNECTION: Each idea MUST reference a specific [NEWS X] or [REDDIT X] item above. Name it explicitly. Explain WHY this is the perfect moment to make this video.
3. THUMBNAIL: Think like a professional designer. Specific colors, exact text overlay wording, composition, what emotion the viewer feels when they see it.
4. CONCEPT: Be SPECIFIC. What exactly happens in the video? What is the hook? What is the surprising moment? What will people talk about after watching?

THINK: What would make someone with 10 seconds of attention STOP and click? What would make them share it? What would make it trend?

Return ONLY this JSON array, no markdown, no explanation:
[
  {
    "id": 1,
    "title": "TITLE IN CREATOR'S EXACT VOICE AND STYLE",
    "trendConnection": "This connects to [NEWS/REDDIT X]: [specific reason why now is perfect timing for this video]",
    "thumbnailDesign": "Exact brief: [background], [main visual], [text overlay: exact wording], [color scheme], [mood/emotion], [CTR strategy]",
    "videoIdea": "Specific concept: [exactly what happens], [the hook/twist], [why audiences will watch to the end], [why this performs well based on the current trend]"
  },
  {"id":2,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},
  {"id":3,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},
  {"id":4,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},
  {"id":5,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""}
]`
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

    // Step 1: AI analysis — topics & style only (fast, no hallucinated news)
    const analysis = await analyzeChannel(
      channelData.channelName,
      channelData.channelDescription,
      channelData.videos
    );

    // Step 2: Real news + Reddit in parallel
    const [news, redditByName, redditByChannel] = await Promise.all([
      fetchRealNews(channelData.channelName, analysis.topics),
      searchReddit(`${channelData.channelName} youtube`),
      searchReddit(channelData.channelName),
    ]);

    const redditByTopic = analysis.topics[0]
      ? await searchReddit(analysis.topics[0])
      : [];

    analysis.news = news;

    const redditPosts = [...redditByName, ...redditByChannel, ...redditByTopic]
      .filter((p, i, arr) => arr.findIndex(q => q.title === p.title) === i)
      .slice(0, 8);

    // Step 3: Generate ideas grounded in real data
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