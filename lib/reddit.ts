// Reddit threads from the last week.
// With REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET this uses the official API
// (app-only OAuth, works from Vercel and returns real subreddit/score/comments).
// Without them it falls back to Google News RSS, which has titles and links only.

import { googleNews } from './rss';

export interface Thread {
  title: string;
  subreddit: string;
  url: string;
  score?: number;
  comments?: number;
  date?: string;
}

const UA = 'web:ideaforge:2.0 (by /u/ideaforge_app)';
let token: { value: string; expires: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.expires > Date.now() + 60_000) return token.value;

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function official(query: string, auth: string): Promise<Thread[]> {
  const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=top&t=week&limit=15&type=link`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  type Post = { data: { title: string; subreddit: string; permalink: string; score: number; num_comments: number; created_utc: number; over_18: boolean } };
  return (data.data?.children || [])
    .filter((p: Post) => !p.data.over_18)
    .map((p: Post) => ({
      title: p.data.title,
      subreddit: p.data.subreddit,
      url: `https://www.reddit.com${p.data.permalink}`,
      score: p.data.score,
      comments: p.data.num_comments,
      date: new Date(p.data.created_utc * 1000).toISOString(),
    }));
}

async function viaRss(query: string): Promise<Thread[]> {
  const items = await googleNews(`${query} site:reddit.com when:7d`, 10);
  return items.map(i => {
    const sub = i.title.match(/\br\/([A-Za-z0-9_]{2,21})\b/)?.[1];
    return {
      title: i.title.replace(/\s*:\s*r\/[A-Za-z0-9_]+$/, ''),
      subreddit: sub || '',
      url: i.url,
      date: i.date,
    };
  });
}

export async function fetchReddit(terms: string[], limit = 6): Promise<Thread[]> {
  const queries = terms.slice(0, 2).filter(Boolean);
  if (!queries.length) return [];

  let batches: Thread[][] = [];
  try {
    const auth = await getToken();
    if (auth) batches = await Promise.all(queries.map(q => official(q, auth)));
  } catch { /* fall back */ }
  if (!batches.some(b => b.length)) {
    batches = await Promise.all(queries.map(q => viaRss(q).catch(() => [])));
  }

  const seen = new Set<string>();
  return batches
    .flat()
    .sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))
    .filter(t => {
      const k = t.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}
