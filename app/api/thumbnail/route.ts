import { NextRequest, NextResponse } from 'next/server';

// Map video title keywords → Unsplash search terms
function titleToKeywords(title: string): string {
  const t = title.toLowerCase();
  const kw: string[] = [];

  if (t.match(/\b(ai|artificial intelligence|machine learning|gpt|neural|llm)\b/)) kw.push('artificial-intelligence', 'technology', 'futuristic');
  if (t.match(/\b(camera|photo|photography|lens|sensor|megapixel)\b/)) kw.push('camera', 'photography', 'lens');
  if (t.match(/\b(fold|foldable|flip|rollable)\b/)) kw.push('smartphone', 'technology', 'futuristic');
  if (t.match(/\b(battery|charging|power|watt)\b/)) kw.push('technology', 'energy', 'power');
  if (t.match(/\b(chip|processor|cpu|gpu|performance|benchmark|speed)\b/)) kw.push('circuit-board', 'technology', 'computing');
  if (t.match(/\b(display|screen|oled|amoled|resolution|hz)\b/)) kw.push('screen', 'technology', 'display');
  if (t.match(/\b(budget|cheap|price|value|affordable)\b/)) kw.push('smartphone', 'shopping', 'money');
  if (t.match(/\b(5g|network|connectivity|wifi)\b/)) kw.push('network', 'technology', 'communication');
  if (t.match(/\b(headset|vr|ar|mixed reality|vision)\b/)) kw.push('virtual-reality', 'futuristic', 'technology');
  if (t.match(/\b(watch|wearable|fitness|band|tracker)\b/)) kw.push('smartwatch', 'wearable', 'fitness');
  if (t.match(/\b(laptop|computer|mac|windows|pc)\b/)) kw.push('laptop', 'computer', 'technology');
  if (t.match(/\b(review|test|compare|vs|versus|best|worst)\b/)) kw.push('smartphone', 'technology', 'review');
  if (t.match(/\b(unbox|unboxing|hands.on|first look)\b/)) kw.push('unboxing', 'smartphone', 'technology');
  if (t.match(/\b(future|upcoming|leak|rumor|concept|next)\b/)) kw.push('futuristic', 'technology', 'concept');

  // Always include smartphone/tech as context for this type of channel
  if (kw.length === 0) kw.push('smartphone', 'technology');

  // Unique keywords only, max 3
  const unique = [...new Set(kw)].slice(0, 3);
  return unique.join(',');
}

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 900) + 100;
}

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get('prompt') || 'technology';
  const keywords = titleToKeywords(raw);
  const seed = strHash(raw);

  // 1. Try Unsplash Source (free, no key, relevant photos)
  try {
    const unsplashUrl = `https://source.unsplash.com/featured/1280x720/?${encodeURIComponent(keywords)}`;
    const res = await fetch(unsplashUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 5000) { // real image, not error page
        return new NextResponse(buf, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
        });
      }
    }
  } catch { /* fall through */ }

  // 2. Picsum fallback (always works, seed = consistent per title)
  try {
    const res = await fetch(`https://picsum.photos/seed/${seed}/1280/720`);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
      });
    }
  } catch { /* fall through */ }

  return new NextResponse(null, { status: 404 });
}