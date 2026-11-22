// Headlines from the last 7 days. Order of preference:
//   1. GNews        (GNEWS_API_KEY, free tier allows production use)
//   2. NewsAPI      (NEWSAPI_KEY, free tier is development-only)
//   3. Google News RSS (no key)

import { googleNews, type RssItem } from './rss';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function gnews(term: string): Promise<RssItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const from = new Date(Date.now() - WEEK_MS).toISOString();
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(`"${term}"`)}&lang=en&max=8&from=${from}&sortby=relevance&apikey=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.articles || []).map((a: { title: string; url: string; publishedAt: string; source?: { name?: string } }) => ({
    title: a.title, url: a.url, date: a.publishedAt, outlet: a.source?.name || 'News',
  }));
}

async function newsapi(term: string): Promise<RssItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const from = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(term)}&from=${from}&sortBy=relevancy&pageSize=8&language=en&apiKey=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.articles || [])
    .filter((a: { title?: string }) => a.title && a.title !== '[Removed]')
    .map((a: { title: string; url: string; publishedAt: string; source?: { name?: string } }) => ({
      title: a.title.replace(/ - [^-]+$/, ''), url: a.url, date: a.publishedAt, outlet: a.source?.name || 'News',
    }));
}

async function forTerm(term: string): Promise<RssItem[]> {
  for (const source of [gnews, newsapi]) {
    try {
      const items = await source(term);
      if (items.length >= 2) return items;
    } catch { /* try next */ }
  }
  try { return await googleNews(`${term} when:7d`); } catch { return []; }
}

export async function fetchNews(terms: string[], limit = 6): Promise<RssItem[]> {
  const batches = await Promise.all(terms.slice(0, 3).map(forTerm));
  const cutoff = Date.now() - WEEK_MS;
  const seen = new Set<string>();
  const out: RssItem[] = [];

  // Interleave so one search term doesn't take every slot
  for (let i = 0; i < 8 && out.length < limit; i++) {
    for (const batch of batches) {
      const item = batch[i];
      if (!item) continue;
      if (item.date && new Date(item.date).getTime() < cutoff) continue;
      const key = item.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}
