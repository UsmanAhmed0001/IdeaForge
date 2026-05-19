'use client';
import React from 'react';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Video {
  title: string;
  description: string;
  publishedAt: string;
  videoId: string;
  thumbnail: string;
}

interface NewsItem {
  headline: string;
  summary: string;
  relevance: string;
}

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  url: string;
}

interface VideoIdea {
  id: number;
  title: string;
  trendConnection: string;
  thumbnailDesign: string;
  videoIdea: string;
}

interface AnalysisResult {
  channel: {
    channelName: string;
    channelDescription: string;
    thumbnailUrl: string;
    subscriberCount: string;
    channelId: string;
  };
  videos: Video[];
  analysis: {
    topics: string[];
    channelStyle: string;
    targetAudience: string;
    contentFormat: string;
    news: NewsItem[];
  };
  redditPosts: RedditPost[];
  ideas: VideoIdea[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return ''; }
}

function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ─── Thumbnail Design Brief Card ─────────────────────────────────────────────

const BRIEF_PALETTES = [
  { bg1:'#020d1f', bg2:'#061835', accent:'#4da6ff', accent2:'#00d4ff', name:'Electric Blue' },
  { bg1:'#140a00', bg2:'#3a1a00', accent:'#ffaa33', accent2:'#ff6600', name:'Warm Amber'    },
  { bg1:'#0d0020', bg2:'#200050', accent:'#bb66ff', accent2:'#ff44cc', name:'Neon Purple'   },
  { bg1:'#001a00', bg2:'#003300', accent:'#33ff88', accent2:'#00ffcc', name:'Electric Green'},
  { bg1:'#1a0a00', bg2:'#402000', accent:'#ff6633', accent2:'#ffcc00', name:'Solar Orange'  },
  { bg1:'#0a0a0a', bg2:'#1c1c1c', accent:'#e0e0e0', accent2:'#999999', name:'Minimal B&W'  },
  { bg1:'#050010', bg2:'#100025', accent:'#9966ff', accent2:'#ff44ff', name:'Deep Cosmos'   },
  { bg1:'#001520', bg2:'#003040', accent:'#00d4ff', accent2:'#4488ff', name:'Cyber Teal'    },
];

function getBriefPalette(title: string, desc: string, id: number) {
  const t = `${title} ${desc}`.toLowerCase();
  if (t.match(/\b(ai|neural|machine|gpt|llm|data)\b/))            return BRIEF_PALETTES[0];
  if (t.match(/\b(camera|photo|lens|sensor|color|warm)\b/))        return BRIEF_PALETTES[1];
  if (t.match(/\b(fold|foldable|luxury|premium|pro)\b/))           return BRIEF_PALETTES[2];
  if (t.match(/\b(battery|eco|green|nature|environment)\b/))       return BRIEF_PALETTES[3];
  if (t.match(/\b(budget|cheap|price|fast|gaming|extreme)\b/))     return BRIEF_PALETTES[4];
  if (t.match(/\b(compare|versus|vs|review|test|rank|score)\b/))   return BRIEF_PALETTES[5];
  if (t.match(/\b(future|upcoming|leak|rumor|concept|next)\b/))    return BRIEF_PALETTES[6];
  if (t.match(/\b(5g|network|chip|cpu|tech|cyber|digital)\b/))     return BRIEF_PALETTES[7];
  return BRIEF_PALETTES[id % BRIEF_PALETTES.length];
}

function parseLayout(desc: string): string {
  const d = desc.toLowerCase();
  if (d.match(/split|left.*right|two.*side/))  return 'Split-screen';
  if (d.match(/center|central|middle/))         return 'Centered hero';
  if (d.match(/close.?up|macro|detail/))        return 'Extreme close-up';
  if (d.match(/full.?bleed|wide|panoram/))      return 'Full-bleed wide';
  if (d.match(/person|face|reaction|hold/))     return 'Presenter + product';
  if (d.match(/before.*after|compar/))          return 'Before / After';
  return 'Dynamic composition';
}

function parseMood(desc: string): string {
  const d = desc.toLowerCase();
  if (d.match(/dark|moody|dramatic|cinematic/))    return 'Dark & Dramatic';
  if (d.match(/bright|vibrant|bold|colorful/))     return 'Bright & Bold';
  if (d.match(/clean|minimal|simple|white/))       return 'Clean & Minimal';
  if (d.match(/futuristic|neon|cyber|glow/))       return 'Futuristic / Neon';
  if (d.match(/warm|sunset|orange|amber/))         return 'Warm & Energetic';
  return 'High Contrast';
}

function IdeaThumbnail({ idea }: { idea: VideoIdea }) {
  const pal = getBriefPalette(idea.title, idea.thumbnailDesign, idea.id);
  const layout = parseLayout(idea.thumbnailDesign);
  const mood = parseMood(idea.thumbnailDesign);

  // Extract 3 key visual elements from the description
  const descWords = idea.thumbnailDesign
    .replace(/[,;.]/g, ' ')
    .split(' ')
    .filter(w => w.length > 4)
    .slice(0, 6);

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${pal.bg1} 0%, ${pal.bg2} 100%)`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Subtle grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.04,
        backgroundImage:'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)',
        backgroundSize:'36px 36px' }} />

      {/* Accent radial glow */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 55% 55% at 85% 20%, ${pal.accent}30 0%, transparent 70%)` }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 40% 40% at 15% 80%, ${pal.accent2}20 0%, transparent 70%)` }} />

      {/* TOP ROW — badge + colour chips */}
      <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'clamp(8px,1.5vw,16px) clamp(10px,2vw,20px)', borderBottom:`1px solid ${pal.accent}20` }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(14px,2.2vw,22px)',
            color:pal.accent, letterSpacing:'0.06em' }}>
            0{idea.id}
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(7px,1vw,10px)',
            letterSpacing:'0.14em', textTransform:'uppercase', color:`${pal.accent}90` }}>
            Thumbnail Brief
          </div>
        </div>
        {/* Colour palette chips */}
        <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
          {[pal.bg2, pal.accent, pal.accent2, '#ffffff'].map((c, i) => (
            <div key={i} style={{ width:'clamp(12px,2vw,18px)', height:'clamp(12px,2vw,18px)',
              borderRadius:'3px', background:c, border:'1px solid rgba(255,255,255,0.15)' }} />
          ))}
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(6px,0.9vw,9px)',
            color:`${pal.accent}70`, letterSpacing:'0.1em', marginLeft:'4px' }}>
            {pal.name}
          </div>
        </div>
      </div>

      {/* CENTRE — title + layout diagram */}
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', alignItems:'stretch',
        padding:'clamp(8px,1.5vw,16px) clamp(10px,2vw,20px)', gap:'clamp(10px,2vw,20px)' }}>

        {/* Left: title display */}
        <div style={{ flex:'1 1 55%', display:'flex', flexDirection:'column', justifyContent:'center', gap:'clamp(6px,1vw,10px)' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(14px,2.6vw,32px)',
            lineHeight:1.05, letterSpacing:'0.03em', color:'#ffffff',
            textShadow:`0 0 30px ${pal.accent}60`, wordBreak:'break-word' }}>
            {idea.title}
          </div>
          {/* Tag pills */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
            {[layout, mood].map((tag, i) => (
              <span key={i} style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(6px,0.85vw,9px)',
                letterSpacing:'0.12em', textTransform:'uppercase',
                padding:'3px 8px', borderRadius:'999px',
                background:`${pal.accent}18`, border:`1px solid ${pal.accent}40`,
                color:pal.accent }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: visual direction */}
        <div style={{ flex:'0 0 38%', display:'flex', flexDirection:'column', gap:'clamp(4px,0.8vw,8px)',
          justifyContent:'center' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(6px,0.8vw,9px)',
            letterSpacing:'0.18em', textTransform:'uppercase', color:`${pal.accent}70`,
            marginBottom:'2px' }}>
            Visual Direction
          </div>
          {descWords.slice(0, 4).map((word, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'clamp(3px,0.5vw,5px)', height:'clamp(3px,0.5vw,5px)',
                borderRadius:'50%', background:pal.accent, opacity: 1 - i*0.2, flexShrink:0 }} />
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(7px,0.9vw,10px)',
                color:`rgba(255,255,255,${0.8 - i*0.15})`, letterSpacing:'0.04em',
                textTransform:'capitalize', lineHeight:1.3 }}>
                {word}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM BAR — layout preview */}
      <div style={{ position:'relative', zIndex:2, padding:'clamp(6px,1.2vw,12px) clamp(10px,2vw,20px)',
        borderTop:`1px solid ${pal.accent}20`,
        background:`linear-gradient(to right, ${pal.accent}12 0%, transparent 100%)`,
        display:'flex', alignItems:'center', gap:'clamp(8px,1.5vw,16px)' }}>

        {/* Tiny layout sketch */}
        <div style={{ flexShrink:0, display:'flex', gap:'2px', alignItems:'center' }}>
          {layout === 'Split-screen' && <>
            <div style={{ width:'clamp(14px,2.2vw,22px)', height:'clamp(10px,1.5vw,14px)',
              background:`${pal.accent}35`, borderRadius:'2px 0 0 2px' }} />
            <div style={{ width:'clamp(14px,2.2vw,22px)', height:'clamp(10px,1.5vw,14px)',
              background:`${pal.accent2}35`, borderRadius:'0 2px 2px 0' }} />
          </>}
          {layout !== 'Split-screen' && <>
            <div style={{ width:'clamp(10px,1.5vw,14px)', height:'clamp(10px,1.5vw,14px)',
              background:`${pal.accent}25`, borderRadius:'2px' }} />
            <div style={{ width:'clamp(16px,2.5vw,24px)', height:'clamp(10px,1.5vw,14px)',
              background:`${pal.accent}40`, borderRadius:'2px' }} />
          </>}
        </div>

        <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(7px,0.9vw,10px)',
          color:`rgba(255,255,255,0.5)`, letterSpacing:'0.1em', flex:1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {idea.thumbnailDesign.slice(0, 80)}{idea.thumbnailDesign.length > 80 ? '…' : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

const STEPS = [
  'Fetching channel & videos',
  'Analysing content topics',
  'Searching latest news',
  'Scanning Reddit discussions',
  'Generating 5 video ideas',
];

function LoadingOverlay({ step }: { step: number }) {
  const pct = Math.min(Math.round((step / STEPS.length) * 100), 98);
  return (
    <div className="loading-overlay">
      <div className="loading-logo">IDEA<span>FORGE</span></div>
      <div className="loading-tagline">Content Intelligence Engine</div>
      <ul className="loading-steps">
        {STEPS.map((s, i) => (
          <li key={i} className={`loading-step${i < step ? ' done' : i === step ? ' active' : ''}`}>
            <span className="step-dot">
              {i < step ? '✓' : i === step ? '◉' : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

const TICKS = [
  'Content Intelligence', 'YouTube Analysis', 'Trend Discovery', 'Idea Generation',
  'Reddit Research', 'News Monitoring', 'Channel Insights', 'AI Strategy',
  'Thumbnail Direction', 'Topic Mapping', 'Audience Analysis', 'Video Ideation',
];

function Ticker() {
  const items = [...TICKS, ...TICKS];
  return (
    <div className="ticker">
      <div className="ticker-inner">
        {items.map((t, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-dot" />{t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const r = result.analysis;

  return (
    <div className="results-section">

      {/* Channel header */}
      <div className="channel-header">
        {result.channel.thumbnailUrl ? (
          <Image
            src={result.channel.thumbnailUrl}
            alt={result.channel.channelName}
            width={64} height={64}
            className="channel-avatar"
            unoptimized
          />
        ) : (
          <div className="channel-avatar-ph">
            {result.channel.channelName[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="channel-tag">◈ {result.channel.subscriberCount} subscribers</div>
          <div className="channel-name">{result.channel.channelName.toUpperCase()}</div>
          {result.channel.channelDescription && (
            <p className="channel-desc">{result.channel.channelDescription}</p>
          )}
        </div>
      </div>

      {/* Videos */}
      <div className="sec">
        <div className="sec-hd">
          <span className="sec-num">01</span>
          <span className="sec-title">RECENT VIDEOS</span>
        </div>
        <div className="videos-grid">
          {result.videos.map((v, i) => (
            <a
              key={i}
              href={`https://youtube.com/watch?v=${v.videoId}`}
              target="_blank" rel="noopener noreferrer"
              className="video-card"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {v.thumbnail
                ? <Image src={v.thumbnail} alt={v.title} width={320} height={180} className="video-thumb-img" unoptimized />
                : <div className="video-thumb-ph">▶</div>
              }
              <div className="video-info">
                <div className="video-date">{fmtDate(v.publishedAt)}</div>
                <div className="video-title">{v.title}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* Channel profile */}
      <div className="sec">
        <div className="sec-hd">
          <span className="sec-num">02</span>
          <span className="sec-title">CHANNEL PROFILE</span>
        </div>
        <div className="topics-wrap">
          {r.topics.map((t, i) => <span key={i} className="topic-tag">{t}</span>)}
        </div>
        <div className="meta-block">
          <strong>Format</strong>{r.contentFormat}<br />
          <strong>Audience</strong>{r.targetAudience}<br />
          <strong>Style</strong>{r.channelStyle}
        </div>
      </div>

      <div className="divider" />

      {/* Intelligence feed */}
      <div className="sec">
        <div className="sec-hd">
          <span className="sec-num">03</span>
          <span className="sec-title">INTELLIGENCE FEED</span>
        </div>
        <div className="two-col">
          <div>
            <div className="feed-label">◈ Latest News</div>
            {r.news.length ? (
              <div className="news-list">
                {r.news.map((n, i) => (
                  <div key={i} className="news-card">
                    <div className="news-hl">{n.headline}</div>
                    <div className="news-sum">{n.summary}</div>
                    {n.relevance && <div className="news-rel">↳ {n.relevance}</div>}
                  </div>
                ))}
              </div>
            ) : <p className="no-data">No news data retrieved.</p>}
          </div>
          <div>
            <div className="feed-label">◈ Reddit Discussions</div>
            {result.redditPosts.length ? (
              <div className="reddit-list">
                {result.redditPosts.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="reddit-card">
                    <div className="reddit-meta">
                      <span className="reddit-sub">r/{p.subreddit}</span>
                      <span className="reddit-eng">↑{fmtNum(p.score)} · {fmtNum(p.comments)}</span>
                    </div>
                    <div className="reddit-t">{p.title}</div>
                  </a>
                ))}
              </div>
            ) : <p className="no-data">No Reddit posts found.</p>}
          </div>
        </div>
      </div>

      {/* Video ideas */}
      <div className="ideas-section">
        <div className="ideas-hd">
          <div className="ideas-ey">◈ AI-Generated · Trend-Informed · Channel-Matched</div>
          <div className="ideas-big">5 VIDEO<br />IDEAS</div>
        </div>

        {result.ideas.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '32px 0' }}>
            No ideas generated — try analysing again.
          </p>
        )}

        {result.ideas.map((idea, i) => (
          <div key={idea.id} className="idea-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <IdeaThumbnail idea={idea} />
            <div className="idea-body">
              <div className="idea-num-col">
                <span className="idea-num">0{idea.id}</span>
                <span className="idea-num-label">Concept</span>
              </div>
              <div className="idea-content">
                <h3 className="idea-title">{idea.title}</h3>
                <div className="idea-fields">
                  <div>
                    <div className="idea-fl">Video Concept</div>
                    <p className="idea-fd">{idea.videoIdea}</p>
                  </div>
                  <div>
                    <div className="idea-fl">Thumbnail Direction</div>
                    <p className="idea-fd italic">{idea.thumbnailDesign}</p>
                  </div>
                </div>
                {idea.trendConnection && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div className="idea-fl">Trend Connection</div>
                    <p style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, letterSpacing: '0.02em' }}>{idea.trendConnection}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="reset-wrap">
        <button className="reset-btn" onClick={onReset}>← Analyse Another Channel</button>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [result]);

  const analyze = async () => {
    if (!url.trim() || phase === 'loading') return;
    clearTimers();
    setPhase('loading');
    setStep(0);
    setError('');
    setResult(null);

    const addTimer = (fn: () => void, d: number) => {
      const id = setTimeout(fn, d);
      timers.current.push(id);
    };
    addTimer(() => setStep(1), 5000);
    addTimer(() => setStep(2), 12000);
    addTimer(() => setStep(3), 22000);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setPhase('error');
        return;
      }
      setStep(4);
      await new Promise(r => setTimeout(r, 600));
      setResult(data as AnalysisResult);
      setPhase('done');
    } catch {
      setError('Network error — is the server running?');
      setPhase('error');
    } finally {
      clearTimers();
    }
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setError('');
    setUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  return (
    <div className="page">

      {/* Full-screen loading overlay */}
      {phase === 'loading' && <LoadingOverlay step={step} />}

      {/* Hero */}
      {(phase === 'idle' || phase === 'error') && (
        <section className="hero">
          <div className="hero-grid" />
          <div className="hero-glow" />
          <div className="hero-eye">Content Intelligence Engine</div>
          <h1 className="hero-title">IDEA<span>FORGE</span></h1>
          <p className="hero-sub">
            Drop a YouTube channel URL. Get 5 data-informed video ideas — matched to the
            channel&apos;s style, fuelled by today&apos;s trends and community discussions.
          </p>
          <div className="input-section">
            <label className="input-label" htmlFor="channel-url">Channel Name or URL</label>
            <div className="input-row">
              <span className="input-prefix">🔍</span>
              <input
                ref={inputRef}
                id="channel-url"
                className="url-input"
                type="text"
                placeholder="e.g. MrBeast, Sehat Studio, or full URL"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyze()}
                autoFocus
              />
              <button
                className="analyse-btn"
                onClick={analyze}
                disabled={!url.trim()}
              >
                ANALYSE
              </button>
            </div>
            {error
              ? <p className="input-error">⚠ {error}</p>
              : <p className="input-hint">Type a channel name · paste a YouTube URL · either works</p>
            }
          </div>
        </section>
      )}

      <Ticker />

      {/* Results */}
      {phase === 'done' && result && (
        <div ref={resultsRef}>
          <ResultsView result={result} onReset={reset} />
        </div>
      )}

      {phase !== 'loading' && (
        <footer className="footer">
          IDEAFORGE · YouTube Data API · Reddit · {new Date().getFullYear()}
        </footer>
      )}

    </div>
  );
}