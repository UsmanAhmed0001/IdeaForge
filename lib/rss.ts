// Minimal Google News RSS reader. No key needed; supports `when:7d` and `site:` operators.

export interface RssItem {
  title: string;
  outlet: string;
  url: string;
  date?: string;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export async function googleNews(query: string, limit = 8): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaForge/2.0)' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return blocks.slice(0, limit).map(b => {
    const pick = (tag: string) => decode(b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || '');
    const outlet = pick('source');
    let title = pick('title');
    // Google appends " - Outlet" to every title
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    const pub = pick('pubDate');
    return {
      title,
      outlet: outlet || 'News',
      url: pick('link'),
      date: pub ? new Date(pub).toISOString() : undefined,
    };
  }).filter(i => i.title.length > 12 && i.url);
}
