# IDEAFORGE — YouTube Content Intelligence

A Next.js (TypeScript) app that analyses any YouTube channel and generates 5 data-informed video ideas, powered by Claude AI, live news search, and Reddit community data.

---

## What it does

1. **Fetches** the channel's last 10 videos via YouTube Data API v3
2. **Analyses** topics, style, format and target audience with Claude Sonnet
3. **Searches the web** (via Claude's built-in web search) for the latest news relevant to the channel's niche
4. **Scans Reddit** for community discussions on those topics
5. **Generates 5 video ideas**, each with:
   - Title (matched to the channel's exact style)
   - Thumbnail design brief (detailed visual direction)
   - Video concept (why it will perform + tie to current trends)

---

## Setup

### 1. Clone and install

```bash
cd youtube-ideas
cp .env.example .env.local
npm install     # or pnpm install / yarn
```

### 2. Get API keys

**YouTube Data API v3**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **YouTube Data API v3**
3. Create credentials → **API Key**
4. (Optional but recommended) Restrict the key to YouTube Data API v3

**Anthropic API**
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Generate an API key

### 3. Configure `.env.local`

```env
ANTHROPIC_API_KEY=sk-ant-...
YOUTUBE_API_KEY=AIza...
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
app/
  page.tsx              — Client-side UI (hero, input, loading, results)
  globals.css           — Dark cinematic design system
  layout.tsx            — Root layout + Google Fonts
  api/
    analyze/
      route.ts          — Server-side orchestration:
                          1. Parse YouTube URL
                          2. Resolve channel ID via YouTube API
                          3. Fetch last 10 videos
                          4. Claude (claude-sonnet-4-20250514) + web_search:
                             analyse topics + find latest news
                          5. Reddit public JSON API: search discussions
                          6. Claude: generate 5 video ideas as structured JSON
```

## Supported URL formats

- `youtube.com/@channelname`
- `youtube.com/channel/UCxxxxxxxxxxxxxxx`
- `youtube.com/c/customname`
- `youtube.com/user/username`
- `youtube.com/channelname` (legacy)

---

## Notes

- The YouTube Data API free tier includes 10,000 units/day. This app uses ~5 units per analysis.
- Reddit data is fetched via the public `reddit.com/search.json` endpoint — no API key required.
- Web news search is performed by Claude using Anthropic's built-in `web_search_20250305` tool.
- Analysis takes ~20–40 seconds (primarily Claude's web search + two LLM calls).
