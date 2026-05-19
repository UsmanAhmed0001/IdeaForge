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

// Search YouTube by channel name keyword
async function searchChannelByName(name: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(name)}&type=channel&part=id,snippet&maxResults=1&key=${YOUTUBE_KEY}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  if (!data.items?.length) throw new Error(`No channel found for "${name}". Try being more specific.`);
  return data.items[0].id?.channelId || data.items[0].id.channelId;
}

function isYouTubeUrl(input: string): boolean {
  return input.includes('youtube.com') || input.includes('youtu.be');
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

  // Use specific search terms extracted from channel content
  // e.g. "dengue fever prevention", "HMPV virus symptoms", "black seed oil benefits"
  const queries = [
    topics[0],                        // most specific term first
    topics[1],                        // second specific term
    topics.slice(0, 2).join(' '),     // combined search
    topics.slice(0, 3).join(' OR '),  // broader fallback
  ].filter(Boolean);

  // Last 7 days only — no outdated news
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${sevenDaysAgo}&to=${todayStr}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items = (data.articles || []).slice(0, 8).map((a: any) => ({
        headline: a.title?.replace(/ - [^-]+$/, '') || '',
        summary: a.description?.slice(0, 220) || '',
        relevance: `${a.source?.name || 'News'} · ${new Date(a.publishedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`,
      })).filter((n: NewsItem) => n.headline.length > 10 && !n.headline.includes('[Removed]'));
      if (items.length >= 2) return items;
    } catch { continue; }
  }
  return [];
}

// ─── Reddit via Google RSS ────────────────────────────────────────────────────

interface RedditPost { title: string; subreddit: string; score: number; comments: number; url: string; }

async function fetchReddit(nicheQuery: string): Promise<RedditPost[]> {
  try {
    // Use after: to get only posts from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`;
    const q = encodeURIComponent(`${nicheQuery} site:reddit.com after:${dateStr}`);
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
  topics: string[]; searchTerms: string[]; titleFormula: string; hookWords: string[];
  channelStyle: string; targetAudience: string; contentFormat: string;
  uniqueAngle: string; news: NewsItem[];
}

async function analyzeChannel(channelName: string, channelDescription: string, videos: Video[]): Promise<ChannelAnalysis> {
  const videoList = videos.map((v, i) => `${i+1}. "${v.title}"`).join('\n');
  const text = await callAI(`Analyse this YouTube channel. Return ONLY valid JSON.

CHANNEL: "${channelName}"
DESCRIPTION: ${channelDescription || '(none)'}
LAST 10 VIDEOS:
${videoList}

Analyse deeply and return ONLY this JSON:
{
  "topics": [
    "SPECIFIC searchable topic from their videos e.g. dengue fever prevention, not just health",
    "SPECIFIC condition or subject e.g. HMPV virus symptoms, black seed oil benefits",
    "SPECIFIC underrepresented topic they cover e.g. breast lumps early detection",
    "SPECIFIC seasonal or situational topic e.g. Ramadan fasting dehydration"
  ],
  "searchTerms": [
    "2-4 word phrase you would type into Google News to find articles relevant to this channel",
    "another specific search phrase",
    "another one"
  ],
  "titleFormula": "the recurring structural pattern in their titles e.g. [Condition] + [Solution/Warning] | [Urdu subtitle]",
  "hookWords": ["specific power words they use repeatedly"],
  "channelStyle": "specific description — do they use shocking stats? before/after? expert authority? fear then solution?",
  "targetAudience": "describe audience by their interests and pain points ONLY — not by language. YouTube auto-captions make every channel globally accessible to anyone. Describe WHO they are by what problems they are trying to solve, what they are searching for, what keeps them up at night.",
  "contentFormat": "specific format e.g. short problem-solution health explainers with Urdu narration and visual demonstrations",
  "uniqueAngle": "what makes this channel different — what underrepresented gap do they fill that others do not?"
}`);
  const parsed = parseJSON(text);
  if (parsed?.topics) return { ...parsed, news: [] };
  return { topics:[channelName], searchTerms:[], titleFormula:'', hookWords:[], channelStyle:'N/A', targetAudience:'General', contentFormat:'YouTube videos', uniqueAngle:'', news:[] };
}

// ─── Idea generation ──────────────────────────────────────────────────────────

interface VideoIdea { id: number; title: string; trendConnection: string; thumbnailDesign: string; videoIdea: string; }

// ─── Multi-platform content interfaces ───────────────────────────────────────
interface InstagramIdea {
  id: number;
  reelHook: string;       // Opening 3 seconds — must stop the scroll
  caption: string;        // Full caption (Instagram voice, max 150 words)
  hashtags: string;       // 8-12 relevant hashtags
  visualDirection: string; // What to film/show for the Reel
  trendConnection: string;
}

interface LinkedInIdea {
  id: number;
  headline: string;       // Opening line (must create curiosity or deliver value)
  postBody: string;       // Full post (professional tone, 100-200 words)
  cta: string;            // Call to action / closing question
  trendConnection: string;
}

interface FacebookIdea {
  id: number;
  postTitle: string;      // Attention-grabbing opener
  postBody: string;       // Conversational post (warm community tone, 80-150 words)
  engagementQuestion: string; // Question to drive comments
  trendConnection: string;
}

interface TikTokIdea {
  id: number;
  hook: string;           // First 2 seconds — most critical on TikTok
  concept: string;        // What happens in the video
  audioSuggestion: string; // Trending sound direction or original audio style
  trendConnection: string;
}

interface PlatformPack {
  instagram: InstagramIdea[];
  linkedin: LinkedInIdea[];
  facebook: FacebookIdea[];
  tiktok: TikTokIdea[];
}

async function generateIdeas(channelName: string, analysis: ChannelAnalysis, videos: Video[], reddit: RedditPost[]): Promise<VideoIdea[]> {
  const videoList = videos.map((v,i) => `${i+1}. "${v.title}"`).join('\n');
  const newsList = analysis.news.length
    ? analysis.news.map((n,i) => `[NEWS ${i+1}] ${n.headline} — ${n.summary}`).join('\n')
    : 'No live news available.';
  const redditList = reddit.length
    ? reddit.map((p,i) => `[REDDIT ${i+1}] r/${p.subreddit} — "${p.title}"`).join('\n')
    : 'No Reddit data.';

  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const text = await callAI(`You are the world's top YouTube content strategist. Today is ${today}. Generate 5 VIDEO IDEAS that could be filmed and published THIS WEEK.

CHANNEL: ${channelName}
TITLE FORMULA: ${analysis.titleFormula}
POWER WORDS: ${analysis.hookWords?.join(', ')}
STYLE: ${analysis.channelStyle}
FORMAT: ${analysis.contentFormat}
AUDIENCE: ${analysis.targetAudience}
UNIQUE ANGLE: ${analysis.uniqueAngle || 'Covers underrepresented topics the audience cannot find elsewhere'}
TOPICS: ${analysis.topics.join(', ')}

═══ VIDEOS ALREADY PUBLISHED — DO NOT REPEAT THESE TOPICS ═══
${videoList}

═══ BREAKING NEWS THIS WEEK — CITE THESE DIRECTLY ═══
${newsList}

═══ WHAT PEOPLE ARE DISCUSSING RIGHT NOW ═══
${redditList}

═══ STRICT RULES ═══
1. FRESHNESS: Every idea must be tied to something happening THIS WEEK (reference a specific [NEWS X] or [REDDIT X] with its date). If you cannot connect it to current events, do not suggest it.
2. NO REPEATS: Cross-check every idea against the already-published videos above. If the channel has already covered a topic, the idea is REJECTED — suggest something completely different.
3. PRACTICAL: The idea must be filmable with the creator's existing setup — no ideas that require resources they clearly do not have.
4. GLOBAL AUDIENCE: YouTube auto-captions make every video globally accessible. Focus on the universal human problem being solved, not language or location.
5. TITLE MATCH: The title must sound indistinguishable from this creator's existing titles — same formula, same length, same energy, same capitalisation style.
6. SPECIFICITY: State exactly what happens in the video, minute by minute if needed. Vague concepts are rejected.

Return ONLY this JSON array:
[{"id":1,"title":"TITLE IN CREATOR STYLE","trendConnection":"[NEWS/REDDIT X] published [date] — exactly why this is urgent THIS WEEK","thumbnailDesign":"specific: background color/image, exact text overlay wording, main visual element, layout, emotion","videoIdea":"specific: opening hook, what is shown, key information covered, the surprising fact or reveal, why someone will watch to the end"},{"id":2,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":3,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":4,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""},{"id":5,"title":"","trendConnection":"","thumbnailDesign":"","videoIdea":""}]`);

  const parsed = parseJSON(text);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as VideoIdea[];
  return [];
}

// ─── Multi-platform content generator ────────────────────────────────────────

async function generatePlatformContent(
  channelName: string,
  analysis: ChannelAnalysis & { titleFormula?: string; hookWords?: string[]; uniqueAngle?: string },
  videos: Video[],
  reddit: RedditPost[],
  youtubeIdeas: VideoIdea[]
): Promise<PlatformPack> {
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const newsList = analysis.news.length
    ? analysis.news.map((n, i) => `[NEWS ${i+1}] ${n.headline} — ${n.summary}`).join('\n')
    : 'No live news available.';
  const redditList = reddit.length
    ? reddit.map((p, i) => `[REDDIT ${i+1}] r/${p.subreddit} — "${p.title}"`).join('\n')
    : 'No Reddit data.';
  const ideaTitles = youtubeIdeas.map((v, i) => `${i+1}. ${v.title}`).join('\n');
  const recentVideos = videos.slice(0, 5).map((v, i) => `${i+1}. "${v.title}"`).join('\n');

  const context = `CHANNEL: ${channelName}
NICHE: ${analysis.topics.join(', ')}
UNIQUE ANGLE: ${analysis.uniqueAngle || 'Covers underrepresented topics the audience cannot find elsewhere'}
AUDIENCE: ${analysis.targetAudience}
TODAY: ${today}

THIS WEEK'S NEWS:
${newsList}

REDDIT DISCUSSIONS:
${redditList}

YOUTUBE IDEAS ALREADY GENERATED (use same topics, adapted per platform):
${ideaTitles}

RECENT CHANNEL VIDEOS (do NOT repeat these):
${recentVideos}`;

  // Run all 4 platforms in parallel
  const [igText, liText, fbText, ttText] = await Promise.all([

    // Instagram
    callAI(`You are an Instagram Reels strategist. Today is ${today}.

${context}

Generate 5 Instagram Reel ideas for this channel's niche. Instagram in 2026 rewards RAW, REAL, human content. Hooks must grab attention in 3 seconds.

Rules:
- reelHook: first 3 seconds of the Reel — shocking stat, bold statement, or question. Under 15 words.
- caption: Instagram voice (casual, personal, not corporate). Max 120 words. Emojis allowed.
- hashtags: 8-10 hashtags mixing niche + broad. No spaces in hashtags.
- visualDirection: exactly what to film — location, angle, what to show on screen
- trendConnection: which [NEWS X] or [REDDIT X] makes this timely RIGHT NOW
- Each idea must be different from the others and from recent channel videos

Return ONLY this JSON array:
[{"id":1,"reelHook":"","caption":"","hashtags":"","visualDirection":"","trendConnection":""},{"id":2,"reelHook":"","caption":"","hashtags":"","visualDirection":"","trendConnection":""},{"id":3,"reelHook":"","caption":"","hashtags":"","visualDirection":"","trendConnection":""},{"id":4,"reelHook":"","caption":"","hashtags":"","visualDirection":"","trendConnection":""},{"id":5,"reelHook":"","caption":"","hashtags":"","visualDirection":"","trendConnection":""}]`),

    // LinkedIn
    callAI(`You are a LinkedIn content strategist. Today is ${today}.

${context}

Generate 5 LinkedIn posts for this channel's niche. LinkedIn in 2026: professional credibility, thought leadership, educational value. Content is now cited in AI search results. Video posts get 3× more engagement than text.

Rules:
- headline: first line must stop the scroll — insight, data point, or contrarian take. Under 20 words.
- postBody: professional but human. Teach something. 100-180 words. Line breaks for readability.
- cta: end with a question that makes professionals want to comment. Drives genuine conversation.
- trendConnection: which [NEWS X] or [REDDIT X] makes this relevant to professionals RIGHT NOW
- Do NOT sound like corporate marketing copy. Sound like a knowledgeable human.

Return ONLY this JSON array:
[{"id":1,"headline":"","postBody":"","cta":"","trendConnection":""},{"id":2,"headline":"","postBody":"","cta":"","trendConnection":""},{"id":3,"headline":"","postBody":"","cta":"","trendConnection":""},{"id":4,"headline":"","postBody":"","cta":"","trendConnection":""},{"id":5,"headline":"","postBody":"","cta":"","trendConnection":""}]`),

    // Facebook
    callAI(`You are a Facebook content strategist. Today is ${today}.

${context}

Generate 5 Facebook posts for this channel's niche. Facebook in 2026: community-first, conversational, older demographic (25-45). Meta suppresses duplicate content — this must feel original. Human speech in first 3 seconds of any video boosts reach.

Rules:
- postTitle: warm, relatable opener. Reads like a friend sharing something they just learned.
- postBody: community tone. Tell a story or share a useful insight. 80-140 words. Warm, approachable.
- engagementQuestion: ask a specific question that people in this niche will have an opinion on
- trendConnection: which [NEWS X] or [REDDIT X] is the timely hook RIGHT NOW
- Facebook audience is broader age range — accessible language, no jargon

Return ONLY this JSON array:
[{"id":1,"postTitle":"","postBody":"","engagementQuestion":"","trendConnection":""},{"id":2,"postTitle":"","postBody":"","engagementQuestion":"","trendConnection":""},{"id":3,"postTitle":"","postBody":"","engagementQuestion":"","trendConnection":""},{"id":4,"postTitle":"","postBody":"","engagementQuestion":"","trendConnection":""},{"id":5,"postTitle":"","postBody":"","engagementQuestion":"","trendConnection":""}]`),

    // TikTok
    callAI(`You are a TikTok content strategist. Today is ${today}.

${context}

Generate 5 TikTok ideas for this channel's niche. TikTok in 2026: first 2 seconds are everything. Pattern interrupts, bold statements, visual hooks. Gen Z discovery platform. 54% of TikTok users research products daily.

Rules:
- hook: first 2 seconds — the most important line. Must create FOMO or immediate curiosity. Under 12 words.
- concept: exactly what happens in the video. Specific actions, format, pacing.
- audioSuggestion: trending audio direction OR original audio style that fits the content
- trendConnection: which [NEWS X] or [REDDIT X] is the urgent hook
- TikTok rewards authenticity over polish — raw > perfect

Return ONLY this JSON array:
[{"id":1,"hook":"","concept":"","audioSuggestion":"","trendConnection":""},{"id":2,"hook":"","concept":"","audioSuggestion":"","trendConnection":""},{"id":3,"hook":"","concept":"","audioSuggestion":"","trendConnection":""},{"id":4,"hook":"","concept":"","audioSuggestion":"","trendConnection":""},{"id":5,"hook":"","concept":"","audioSuggestion":"","trendConnection":""}]`),
  ]);

  const ig = parseJSON(igText);
  const li = parseJSON(liText);
  const fb = parseJSON(fbText);
  const tt = parseJSON(ttText);

  return {
    instagram: Array.isArray(ig) ? ig as InstagramIdea[] : [],
    linkedin: Array.isArray(li) ? li as LinkedInIdea[] : [],
    facebook: Array.isArray(fb) ? fb as FacebookIdea[] : [],
    tiktok: Array.isArray(tt) ? tt as TikTokIdea[] : [],
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!YOUTUBE_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured.' }, { status: 500 });
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured.' }, { status: 500 });

    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });

    let channelId: string;

    if (isYouTubeUrl(url)) {
      // Full URL provided — parse normally
      const parsed = parseYouTubeUrl(url);
      if (!parsed) return NextResponse.json({ error: 'Could not parse this YouTube URL.' }, { status: 400 });
      channelId = await resolveChannelId(parsed);
    } else {
      // Channel name / keyword provided — search YouTube
      channelId = await searchChannelByName(url.trim());
    }
    const channelData = await fetchChannelData(channelId);

    const analysis = await analyzeChannel(channelData.channelName, channelData.channelDescription, channelData.videos);

    // Use AI-extracted search terms — specific conditions and topics, not broad labels
    const searchTerms = analysis.searchTerms?.length ? analysis.searchTerms : analysis.topics;
    const primarySearch = searchTerms[0] || analysis.topics[0] || channelData.channelName;
    const secondarySearch = searchTerms[1] || analysis.topics[1] || '';
    const nicheQuery = `${primarySearch} ${secondarySearch}`.trim();

    // Run news + reddit in parallel using specific search terms
    const [news, reddit] = await Promise.all([
      fetchNews(channelData.channelName, searchTerms),
      fetchReddit(nicheQuery),
    ]);
    analysis.news = news;

    const ideas = await generateIdeas(channelData.channelName, analysis, channelData.videos, reddit);

    // Generate platform content pack in parallel with ideas already done
    const platforms = await generatePlatformContent(
      channelData.channelName, analysis, channelData.videos, reddit, ideas
    );

    return NextResponse.json({
      channel: { channelName: channelData.channelName, channelDescription: channelData.channelDescription, thumbnailUrl: channelData.thumbnailUrl, subscriberCount: channelData.subscriberCount, channelId },
      videos: channelData.videos,
      analysis,
      redditPosts: reddit,
      ideas,
      platforms,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    console.error('[analyze]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}