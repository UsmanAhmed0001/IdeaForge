'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Desk, PLATFORMS } from '@/components/Desk';
import { YouTubeCard, ReelFrame, TikTokFrame, LinkedInPost, type Who } from '@/components/Frames';
import type { Channel, Video, Profile, Source, PlatformId, PlatformIdeas, StreamEvent } from '@/lib/types';

const SUGGESTIONS = ['MrBeast', 'Ali Abdaal', 'Veritasium'];

type Phase = 'idle' | 'working' | 'done';

function compact(n: number) {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function shortDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

// Plain colour fields for the landing sample, so it needs no stock photos.
const swatch = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="${a}"/><circle cx="118" cy="52" r="34" fill="${b}"/></svg>`)}`;

const SAMPLE_WHO: Who = { name: 'Kitchen Notes', handle: '@kitchennotes', avatar: '' };

function Sample() {
  return (
    <section className="sample" aria-label="Sample drafts">
      <p className="sample-note">
        Sample drafts for a made-up cooking channel. Yours will use your own thumbnails,
        your title style and what people are reading this week.
      </p>
      <div className="collage">
        <div className="piece p-yt">
          <span className="tape">YouTube</span>
          <YouTubeCard who={SAMPLE_WHO} title="I Cooked From a 1950s Ration Book for 7 Days" thumbnailText="7 days on rations" image={swatch('#7a4b2a', '#d9a066')} />
        </div>
        <div className="piece p-ig">
          <span className="tape">Reels</span>
          <ReelFrame who={SAMPLE_WHO} coverText="£1 dinner, honestly" caption="Lentils, one onion, a tin of tomatoes. I timed it: 22 minutes and it fed three of us." image={swatch('#3d5a40', '#a7c4a0')} />
        </div>
        <div className="piece p-tt">
          <span className="tape">TikTok</span>
          <TikTokFrame who={SAMPLE_WHO} onScreenText="the onion trick nobody uses" hook="Stop crying over onions. Do this instead." sound="original sound" image={swatch('#2b2f4a', '#8c93c9')} />
        </div>
        <div className="piece p-li">
          <span className="tape">LinkedIn</span>
          <LinkedInPost who={SAMPLE_WHO} opener="I spent a year cooking on £25 a week. The hardest part wasn't the money." body="It was planning. Here's the Sunday routine that made it work, and the three meals I'd keep forever." />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [platforms, setPlatforms] = useState<Partial<PlatformIdeas>>({});
  const [failed, setFailed] = useState<Partial<Record<PlatformId, string>>>({});
  const [active, setActive] = useState<PlatformId>('youtube');

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetResults = () => {
    setChannel(null); setVideos([]); setProfile(null); setSources(null);
    setPlatforms({}); setFailed({}); setLog([]); setActive('youtube');
  };

  const handle = useCallback((e: StreamEvent) => {
    switch (e.type) {
      case 'log': setLog(l => [...l, e.text]); break;
      case 'channel': setChannel(e.channel); setVideos(e.videos); break;
      case 'profile': setProfile(e.profile); break;
      case 'sources': setSources(e.sources); break;
      case 'platform': setPlatforms(p => ({ ...p, [e.platform]: e.items })); break;
      case 'platform_error': setFailed(f => ({ ...f, [e.platform]: e.message })); break;
      case 'error': setError(e.message); setPhase('done'); break;
      case 'done': setPhase('done'); break;
    }
  }, []);

  const run = useCallback(async (value?: string) => {
    const q = (value ?? query).trim();
    if (!q || phase === 'working') return;
    setQuery(q);
    setError('');
    resetResults();
    setPhase('working');

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed (${res.status}).`);
        setPhase('idle');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) handle(JSON.parse(line) as StreamEvent);
        }
      }
      setPhase(p => (p === 'working' ? 'done' : p));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('Lost the connection partway through. Check your internet and run it again.');
      setPhase('done');
    }
  }, [query, phase, handle]);

  const startOver = () => {
    abortRef.current?.abort();
    resetResults();
    setError('');
    setQuery('');
    setPhase('idle');
    window.scrollTo({ top: 0 });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Keyboard: ⌘K or / to focus the search, 1–5 to switch platforms
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        if (!inputRef.current) return;
        e.preventDefault();
        inputRef.current.focus();
        inputRef.current.select();
      } else if (!typing && channel && /^[1-5]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
        setActive(PLATFORMS[Number(e.key) - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channel]);

  const showResults = !!channel;

  return (
    <>
      <header className="wrap top">
        <button className="wordmark" onClick={startOver}>IdeaForge</button>
        {showResults && <button className="top-link" onClick={startOver}>Try another channel</button>}
      </header>

      <main>
        {!showResults && (
          <div className="wrap">
            <section className="intro">
              <h1>What should you post this week?</h1>
              <p>
                Give us a YouTube channel. We read its recent uploads, this week&apos;s news and
                what people are discussing on Reddit, then draft five posts each for YouTube,
                Instagram, TikTok, LinkedIn and Facebook.
              </p>
              <form className="ask" onSubmit={e => { e.preventDefault(); run(); }}>
                <label htmlFor="q" className="sr-only" style={{ position: 'absolute', left: -9999 }}>Channel name or link</label>
                <input
                  id="q"
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Channel name or youtube.com link"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={phase === 'working'}
                />
                <button className="btn" type="submit" disabled={!query.trim() || phase === 'working'}>
                  {phase === 'working' ? 'Looking it up' : 'Draft my week'}
                </button>
              </form>
              {error
                ? <p className="error" role="alert">{error}</p>
                : (
                  <p className="try">
                    Or try{' '}
                    {SUGGESTIONS.map((s, i) => (
                      <span key={s}>
                        <button type="button" onClick={() => run(s)}>{s}</button>
                        {i < SUGGESTIONS.length - 2 ? ', ' : i === SUGGESTIONS.length - 2 ? ' or ' : '.'}
                      </span>
                    ))}
                  </p>
                )}
            </section>
            <Sample />
          </div>
        )}

        {showResults && channel && (
          <div className="wrap">
            <section className="chan">
              {channel.avatar && <img src={channel.avatar} alt="" />}
              <div>
                <h1>{channel.name}</h1>
                <p>
                  {compact(channel.subscribers)} subscribers. We read {videos.length} recent uploads
                  {videos[0] && <>, the latest from {shortDate(videos[0].publishedAt)}</>}.
                </p>
              </div>
            </section>

            {sources && sources.length > 0 && (
              <div className="ticker" aria-label="This week's headlines">
                <div className="ticker-track">
                  {[...sources, ...sources].map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" tabIndex={i < sources.length ? 0 : -1} aria-hidden={i >= sources.length}>
                      <b>{s.kind === 'reddit' ? (s.subreddit ? `r/${s.subreddit}` : 'Reddit') : s.outlet}</b>{s.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(phase === 'working' || error) && (
              <ul className="log" aria-live="polite">
                {log.slice(-5).map((line, i, arr) => (
                  <li key={i} className={phase === 'working' && i === arr.length - 1 ? 'working' : ''}>{line}</li>
                ))}
                {error && <li style={{ color: 'var(--danger)' }}>{error}</li>}
              </ul>
            )}

            {profile && (
              <dl className="read">
                <dt>Covers</dt><dd>{profile.topics.join(', ')}</dd>
                <dt>Titles look like</dt><dd>{profile.titleFormula}</dd>
                <dt>Voice</dt><dd>{profile.voice}</dd>
                <dt>Watched by</dt><dd>{profile.audience}</dd>
                <dt>Gap it fills</dt><dd>{profile.angle}</dd>
              </dl>
            )}

            {videos.length > 0 && (
              <section className="uploads">
                <h2>Recent uploads, used to avoid repeats</h2>
                <div className="uploads-row">
                  {videos.map(v => (
                    <a key={v.id} className="up" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer">
                      <img src={v.thumbnail} alt="" loading="lazy" />
                      <b>{v.title}</b>
                      <span>{compact(v.views)} views, {shortDate(v.publishedAt)}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {profile && (
              <Desk
                who={{ name: channel.name, handle: channel.handle, avatar: channel.avatar }}
                images={videos.map(v => v.thumbnail).filter(Boolean)}
                platforms={platforms}
                failed={failed}
                sources={sources || []}
                sourcesReady={sources !== null}
                active={active}
                setActive={setActive}
              />
            )}
          </div>
        )}
      </main>

      <footer className="wrap foot">
        Built in London by <a href="https://portfolio-blue-two-67.vercel.app" target="_blank" rel="noopener noreferrer">Usman Ahmed</a>.
        Headlines come from news search, threads from Reddit, and the drafts are written fresh for each channel.
      </footer>
    </>
  );
}