'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Video { title: string; description: string; publishedAt: string; videoId: string; thumbnail: string; }
interface NewsItem { headline: string; summary: string; relevance: string; }
interface RedditPost { title: string; subreddit: string; score: number; comments: number; url: string; }

interface VideoIdea { id: number; title: string; trendConnection: string; thumbnailDesign: string; videoIdea: string; }
interface InstagramIdea { id: number; reelHook: string; caption: string; hashtags: string; visualDirection: string; trendConnection: string; }
interface LinkedInIdea  { id: number; headline: string; postBody: string; cta: string; trendConnection: string; }
interface FacebookIdea  { id: number; postTitle: string; postBody: string; engagementQuestion: string; trendConnection: string; }
interface TikTokIdea    { id: number; hook: string; concept: string; audioSuggestion: string; trendConnection: string; }

interface AnalysisResult {
  channel: { channelName: string; channelDescription: string; thumbnailUrl: string; subscriberCount: string; channelId: string; };
  videos: Video[];
  analysis: { topics: string[]; channelStyle: string; targetAudience: string; contentFormat: string; news: NewsItem[]; };
  redditPosts: RedditPost[];
  ideas: VideoIdea[];
  platforms?: { instagram: InstagramIdea[]; linkedin: LinkedInIdea[]; facebook: FacebookIdea[]; tiktok: TikTokIdea[]; };
}

// ─── Platform metadata ────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',   short: 'YT', key: '1' },
  { id: 'instagram', label: 'Instagram', short: 'IG', key: '2' },
  { id: 'tiktok',    label: 'TikTok',    short: 'TT', key: '3' },
  { id: 'linkedin',  label: 'LinkedIn',  short: 'LI', key: '4' },
  { id: 'facebook',  label: 'Facebook',  short: 'FB', key: '5' },
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

const TRY_CHANNELS = ['MrBeast', 'MKBHD', 'Ali Abdaal', 'Veritasium', 'Emma Chamberlain'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return n.toString();
}

// Animated number count-up hook
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  const counted = useCountUp(value);
  return (
    <div className="stat-card fade-in">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{counted}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const ToastContext = React.createContext<(msg: string) => void>(() => {});

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast ${msg ? 'show' : ''}`}>
        ✓ {msg}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Idea card actions ───────────────────────────────────────────────────────

function IdeaActions({ copyText, platform }: { copyText: string; platform: PlatformId }) {
  const [copied, setCopied] = useState(false);
  const toast = React.useContext(ToastContext);

  const copy = () => {
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    toast('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  };

  const lockedClick = (feature: string) => toast(`${feature} — coming in v2`);

  return (
    <div className="idea-actions">
      <button className={`action-btn ${copied ? 'copied' : ''}`} onClick={copy}>
        {copied ? '✓ COPIED' : 'COPY'}
      </button>
      <button className="action-btn locked" onClick={() => lockedClick('Regenerate')}>
        ↻ <span className="lock-badge">V2</span>
      </button>
      {platform === 'youtube' && (
        <>
          <button className="action-btn locked" onClick={() => lockedClick('AI Script Writer')}>
            SCRIPT <span className="lock-badge">V2</span>
          </button>
          <button className="action-btn locked" onClick={() => lockedClick('AI Thumbnail Studio')}>
            THUMBNAIL <span className="lock-badge">V2</span>
          </button>
        </>
      )}
      {platform !== 'youtube' && (
        <button className="action-btn locked" onClick={() => lockedClick('AI Script Writer')}>
          SCRIPT <span className="lock-badge">V2</span>
        </button>
      )}
    </div>
  );
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

const STEPS = [
  'Analysing channel',
  'Fetching live news',
  'Mining Reddit',
  'Generating ideas',
  'Adapting per platform',
];

function LoadingOverlay({ step }: { step: number }) {
  const progress = Math.min(((step + 1) / STEPS.length) * 100, 100);
  return (
    <div className="loading">
      <div className="loading-glow" />
      <div className="loading-inner">
        <div className="loading-pill">PROCESSING</div>
        <div className="loading-title">
          Building your<br/>
          <em>content pack</em>
        </div>
        <div className="loading-steps">
          {STEPS.map((label, i) => (
            <div key={i} className={`loading-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
              <div className="step-dot" />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Top navigation ───────────────────────────────────────────────────────────

function TopNav({ onLogoClick, onSearchClick }: { onLogoClick: () => void; onSearchClick: () => void }) {
  const toast = React.useContext(ToastContext);
  return (
    <div className="topnav">
      <div className="topnav-logo" onClick={onLogoClick}>IDEAFORGE</div>
      <div className="topnav-spacer" />
      <div className="topnav-search" onClick={onSearchClick}>
        <span>Search channel</span>
        <span style={{ flex: 1 }} />
        <span className="kbd">⌘</span><span className="kbd">K</span>
      </div>
      <button className="topnav-icon" onClick={() => toast('Trend alerts — coming in v2')} aria-label="Notifications">
        🔔<span className="badge" />
      </button>
      <button className="topnav-icon" onClick={() => toast('Settings — coming in v2')} aria-label="Settings">
        ⚙
      </button>
      <div className="topnav-avatar" onClick={() => toast('Account — coming in v2')}>U</div>
    </div>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({ result, onReset, platform, setPlatform }: {
  result: AnalysisResult;
  onReset: () => void;
  platform: PlatformId;
  setPlatform: (p: PlatformId) => void;
}) {
  const { channel, analysis, videos, redditPosts, ideas, platforms } = result;

  const counts = {
    youtube:   ideas.length,
    instagram: platforms?.instagram?.length || 0,
    tiktok:    platforms?.tiktok?.length || 0,
    linkedin:  platforms?.linkedin?.length || 0,
    facebook:  platforms?.facebook?.length || 0,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="results">

      <div className="channel-bar fade-in">
        {channel.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnailUrl} alt={channel.channelName} className="channel-avatar" />
        )}
        <div className="channel-info">
          <div className="channel-name">{channel.channelName}</div>
          <div className="channel-meta">
            <span>{channel.subscriberCount} subscribers</span>
            <span className="dot">·</span>
            <span>{videos.length} recent videos</span>
            {analysis.topics?.[0] && (
              <>
                <span className="dot">·</span>
                <span className="accent-meta">{analysis.topics[0]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stats-bento">
        <StatCard label="Total Ideas" value={total} sub="across 5 platforms" />
        <StatCard label="News This Week" value={analysis.news?.length || 0} sub="live headlines" />
        <StatCard label="Reddit Threads" value={redditPosts.length} sub="community signals" />
        <StatCard label="Channel Topics" value={analysis.topics?.length || 0} sub={analysis.contentFormat?.slice(0, 20) || 'analysed'} />
      </div>

      {videos.length > 0 && (
        <div className="sect fade-in delay-2">
          <div className="sect-head">
            <span className="sect-title">Recent uploads</span>
            <span className="sect-count">{videos.length} videos · matched for style</span>
          </div>
          <div className="videos-rail">
            {videos.map((v, i) => (
              <a key={i} href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="video-thumb">
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt={v.title} />
                )}
                <div className="video-thumb-meta">
                  <div className="video-thumb-date">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : ''}
                  </div>
                  <div className="video-thumb-title">{v.title}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="sect fade-in delay-3">
        <div className="sect-head">
          <span className="sect-title">Intelligence feed</span>
          <span className="sect-count">last 7 days · live</span>
        </div>
        <div className="intel-grid">
          <div>
            <div className="intel-col-head">Latest news</div>
            {analysis.news.length > 0 ? analysis.news.map((n, i) => (
              <div key={i} className="news-card">
                <div className="news-hl">{n.headline}</div>
                {n.summary && <div className="news-sum">{n.summary}</div>}
                {n.relevance && <div className="news-rel">{n.relevance}</div>}
              </div>
            )) : <div className="no-data">No news data retrieved</div>}
          </div>
          <div>
            <div className="intel-col-head">Reddit discussions</div>
            {redditPosts.length > 0 ? redditPosts.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="reddit-card">
                <div className="reddit-meta">
                  <span className="reddit-sub">r/{p.subreddit}</span>
                  {p.score > 0 && <span>↑ {fmtNum(p.score)}</span>}
                </div>
                <div className="reddit-t">{p.title}</div>
              </a>
            )) : <div className="no-data">No Reddit posts found</div>}
          </div>
        </div>
      </div>

      {/* PLATFORM PACK ------------------------------------------------ */}
      <div className="platforms-section">
        <div className="platforms-head">
          <span className="platforms-eyebrow">◆ AI-generated · trend-informed · channel-matched</span>
          <div className="platforms-title">
            Your <em>content pack</em>
          </div>
          <div className="platforms-sub">5 ideas per platform — ready to publish</div>
        </div>

        <div className="tab-bar-wrap">
          <div className="tab-bar">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`tab ${platform === p.id ? 'active' : ''}`}
                title={`Press ${p.key}`}
              >
                <span className="tab-code">{p.short}</span>
                <span>{p.label}</span>
                {counts[p.id] > 0 && <span className="tab-count">{counts[p.id]}</span>}
                <span className="tab-key">{p.key}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ideas-grid">

          {platform === 'youtube' && (
            ideas.length === 0
              ? <div className="no-data">No YouTube ideas — try again</div>
              : ideas.map((idea, i) => (
                <div key={idea.id} className="idea-card" data-platform="youtube" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="platform-strip youtube" />
                  <div className="idea-body">
                    <div className="idea-top">
                      <span className="idea-num">YT · IDEA {String(idea.id).padStart(2, '0')}</span>
                      <IdeaActions
                        platform="youtube"
                        copyText={`${idea.title}\n\n${idea.videoIdea}\n\nThumbnail: ${idea.thumbnailDesign}`}
                      />
                    </div>
                    <h3 className="idea-headline">{idea.title}</h3>
                    <div className="idea-block">
                      <div className="idea-label">Video concept</div>
                      <div className="idea-text">{idea.videoIdea}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Thumbnail direction</div>
                      <div className="idea-text" style={{ fontStyle: 'italic' }}>{idea.thumbnailDesign}</div>
                    </div>
                    {idea.trendConnection && (
                      <div className="idea-trend">
                        <div className="idea-label">Trend connection</div>
                        <div className="idea-text">{idea.trendConnection}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}

          {platform === 'instagram' && (
            !platforms?.instagram?.length
              ? <div className="no-data">Instagram content generating...</div>
              : platforms.instagram.map((item, i) => (
                <div key={item.id} className="idea-card" data-platform="instagram" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="platform-strip instagram" />
                  <div className="idea-body">
                    <div className="idea-top">
                      <span className="idea-num">IG · REEL {String(item.id).padStart(2, '0')}</span>
                      <IdeaActions
                        platform="instagram"
                        copyText={`${item.reelHook}\n\n${item.caption}\n\n${item.hashtags}`}
                      />
                    </div>
                    <h3 className="idea-headline">{item.reelHook}</h3>
                    <div className="idea-block">
                      <div className="idea-label">Caption</div>
                      <div className="idea-text">{item.caption}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Visual direction</div>
                      <div className="idea-text" style={{ fontStyle: 'italic' }}>{item.visualDirection}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Hashtags</div>
                      <div className="hashtag-block">{item.hashtags}</div>
                    </div>
                    {item.trendConnection && (
                      <div className="idea-trend">
                        <div className="idea-label">Trend connection</div>
                        <div className="idea-text">{item.trendConnection}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}

          {platform === 'tiktok' && (
            !platforms?.tiktok?.length
              ? <div className="no-data">TikTok content generating...</div>
              : platforms.tiktok.map((item, i) => (
                <div key={item.id} className="idea-card" data-platform="tiktok" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="platform-strip tiktok" />
                  <div className="idea-body">
                    <div className="idea-top">
                      <span className="idea-num">TT · IDEA {String(item.id).padStart(2, '0')}</span>
                      <IdeaActions
                        platform="tiktok"
                        copyText={`${item.hook}\n\n${item.concept}\n\nAudio: ${item.audioSuggestion}`}
                      />
                    </div>
                    <h3 className="idea-headline">{item.hook}</h3>
                    <div className="idea-block">
                      <div className="idea-label">Video concept</div>
                      <div className="idea-text">{item.concept}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Audio direction</div>
                      <div className="idea-text" style={{ fontStyle: 'italic' }}>{item.audioSuggestion}</div>
                    </div>
                    {item.trendConnection && (
                      <div className="idea-trend">
                        <div className="idea-label">Trend connection</div>
                        <div className="idea-text">{item.trendConnection}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}

          {platform === 'linkedin' && (
            !platforms?.linkedin?.length
              ? <div className="no-data">LinkedIn content generating...</div>
              : platforms.linkedin.map((item, i) => (
                <div key={item.id} className="idea-card" data-platform="linkedin" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="platform-strip linkedin" />
                  <div className="idea-body">
                    <div className="idea-top">
                      <span className="idea-num">LI · POST {String(item.id).padStart(2, '0')}</span>
                      <IdeaActions
                        platform="linkedin"
                        copyText={`${item.headline}\n\n${item.postBody}\n\n${item.cta}`}
                      />
                    </div>
                    <h3 className="idea-headline">{item.headline}</h3>
                    <div className="idea-block">
                      <div className="idea-label">Post body</div>
                      <div className="idea-text">{item.postBody}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Call to action</div>
                      <div className="idea-text" style={{ fontStyle: 'italic' }}>{item.cta}</div>
                    </div>
                    {item.trendConnection && (
                      <div className="idea-trend">
                        <div className="idea-label">Trend connection</div>
                        <div className="idea-text">{item.trendConnection}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}

          {platform === 'facebook' && (
            !platforms?.facebook?.length
              ? <div className="no-data">Facebook content generating...</div>
              : platforms.facebook.map((item, i) => (
                <div key={item.id} className="idea-card" data-platform="facebook" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="platform-strip facebook" />
                  <div className="idea-body">
                    <div className="idea-top">
                      <span className="idea-num">FB · POST {String(item.id).padStart(2, '0')}</span>
                      <IdeaActions
                        platform="facebook"
                        copyText={`${item.postTitle}\n\n${item.postBody}\n\n${item.engagementQuestion}`}
                      />
                    </div>
                    <h3 className="idea-headline">{item.postTitle}</h3>
                    <div className="idea-block">
                      <div className="idea-label">Post body</div>
                      <div className="idea-text">{item.postBody}</div>
                    </div>
                    <div className="idea-block">
                      <div className="idea-label">Engagement question</div>
                      <div className="idea-text" style={{ fontStyle: 'italic' }}>{item.engagementQuestion}</div>
                    </div>
                    {item.trendConnection && (
                      <div className="idea-trend">
                        <div className="idea-label">Trend connection</div>
                        <div className="idea-text">{item.trendConnection}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="reset-wrap">
        <button className="reset-btn" onClick={onReset}>← Analyse another channel</button>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ url, setUrl, onAnalyse, error, inputRef }: {
  url: string;
  setUrl: (s: string) => void;
  onAnalyse: () => void;
  error: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-pill">
        <span className="live-dot" />
        CONTENT INTELLIGENCE · LIVE
      </div>
      <h1 className="hero-title">
        One channel.<br/>
        <span>Every platform.</span>
      </h1>
      <p className="hero-sub">
        Drop any YouTube channel. Get 25 ideas across YouTube, Instagram, TikTok,
        LinkedIn and Facebook — grounded in this week&apos;s real news.
      </p>
      <div className="input-section">
        <div className="input-row">
          <input
            ref={inputRef}
            className="url-input"
            type="text"
            placeholder="MrBeast, Sehat Studio, or a full YouTube URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAnalyse()}
            autoFocus
          />
          <button className="analyse-btn" onClick={onAnalyse} disabled={!url.trim()}>
            ANALYSE →
          </button>
        </div>
        {error
          ? <p className="input-error">⚠ {error}</p>
          : <p className="input-hint">Type a channel name · paste a URL · press <span className="kbd">⏎</span> to analyse</p>
        }
        <div className="try-row">
          {TRY_CHANNELS.map(c => (
            <button key={c} className="try-chip" onClick={() => { setUrl(c); setTimeout(onAnalyse, 50); }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Feature preview */}
      <div className="feature-row">
        {PLATFORMS.map(p => (
          <div key={p.id} className="feature-card">
            <div className={`feature-icon ${p.short.toLowerCase()}`}>{p.short}</div>
            <div className="feature-name">{p.label}</div>
            <div className="feature-meta">5 IDEAS</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HomeContent() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('youtube');
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toast = React.useContext(ToastContext);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [result]);

  const analyze = useCallback(async (override?: string) => {
    const target = (override ?? url).trim();
    if (!target || phase === 'loading') return;
    setUrl(target);
    clearTimers();
    setPhase('loading');
    setStep(0);
    setError('');
    setResult(null);

    const addTimer = (fn: () => void, d: number) => {
      const id = setTimeout(fn, d);
      timers.current.push(id);
    };
    addTimer(() => setStep(1), 6000);
    addTimer(() => setStep(2), 14000);
    addTimer(() => setStep(3), 24000);
    addTimer(() => setStep(4), 38000);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setPhase('error');
        return;
      }
      setStep(STEPS.length);
      await new Promise(r => setTimeout(r, 500));
      setResult(data as AnalysisResult);
      setPlatform('youtube');
      setPhase('done');
    } catch {
      setError('Network error — try again');
      setPhase('error');
    } finally {
      clearTimers();
    }
  }, [url, phase]);

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setError('');
    setUrl('');
    setPlatform('youtube');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // ⌘K or / → focus input
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !inInput)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      // 1–5 → switch platform (only when results shown)
      if (!inInput && phase === 'done' && /^[1-5]$/.test(e.key)) {
        const idx = parseInt(e.key) - 1;
        setPlatform(PLATFORMS[idx].id);
        toast(`Switched to ${PLATFORMS[idx].label}`);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, toast]);

  return (
    <div className="page" data-platform={phase === 'done' ? platform : undefined}>

      <TopNav onLogoClick={reset} onSearchClick={() => inputRef.current?.focus()} />

      {phase === 'loading' && <LoadingOverlay step={step} />}

      {(phase === 'idle' || phase === 'error') && (
        <Hero
          url={url}
          setUrl={setUrl}
          onAnalyse={() => analyze()}
          error={error}
          inputRef={inputRef}
        />
      )}

      {phase === 'done' && result && (
        <div ref={resultsRef}>
          <ResultsView
            result={result}
            onReset={reset}
            platform={platform}
            setPlatform={setPlatform}
          />
        </div>
      )}

      {phase !== 'loading' && (
        <footer className="footer">
          IDEAFORGE · YOUTUBE · INSTAGRAM · TIKTOK · LINKEDIN · FACEBOOK · {new Date().getFullYear()}
        </footer>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}