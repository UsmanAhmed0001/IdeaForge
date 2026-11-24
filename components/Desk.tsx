'use client';
import { useState } from 'react';
import { YouTubeCard, ReelFrame, TikTokFrame, LinkedInPost, FacebookPost, type Who } from './Frames';
import type {
  PlatformId, PlatformIdeas, Source,
  YouTubeIdea, InstagramIdea, TikTokIdea, LinkedInIdea, FacebookIdea,
} from '@/lib/types';

export const PLATFORMS: { id: PlatformId; name: string }[] = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'facebook', name: 'Facebook' },
];

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy"
      data-done={done}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}

function sourceLine(s: Source) {
  if (s.kind === 'youtube') {
    return [s.outlet, s.views ? `${new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(s.views)} views` : '', fmtDate(s.date)].filter(Boolean).join(', ');
  }
  if (s.kind === 'reddit') {
    const bits = [s.subreddit ? `r/${s.subreddit}` : 'Reddit'];
    if (s.comments) bits.push(`${s.comments.toLocaleString('en-GB')} comments`);
    if (s.date) bits.push(fmtDate(s.date));
    return bits.join(', ');
  }
  return [s.outlet, fmtDate(s.date)].filter(Boolean).join(', ');
}

/** "Why this week" with the sources it was built from, linked. */
function Why({ why, ids, sources }: { why: string; ids: string[]; sources: Source[] }) {
  const used = ids.map(id => sources.find(s => s.id === id)).filter((s): s is Source => !!s);
  return (
    <>
      {why && (
        <div className="why">
          <span className="label">Why this week</span>
          <p><span className="mark">{why}</span></p>
        </div>
      )}
      {used.length > 0 && (
        <div className="based">
          <span>Based on</span>
          {used.map(s => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title} <span style={{ color: 'var(--graphite)' }}>({sourceLine(s)})</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// ── One row per idea, per platform ────────────────────────────────────────────

function YouTubeRow({ idea, who, image, sources }: { idea: YouTubeIdea; who: Who; image?: string; sources: Source[] }) {
  return (
    <article className="idea">
      <YouTubeCard who={who} title={idea.title} thumbnailText={idea.thumbnailText} image={image} />
      <div className="notes">
        <div><span className="label">What happens</span><p>{idea.concept}</p></div>
        <Why why={idea.why} ids={idea.sources} sources={sources} />
        <div className="actions">
          <CopyButton text={idea.title} label="Copy title" />
          <CopyButton text={`${idea.title}\n\nThumbnail: ${idea.thumbnailText}\n\n${idea.concept}`} label="Copy all" />
        </div>
      </div>
    </article>
  );
}

function InstagramRow({ idea, who, image, sources }: { idea: InstagramIdea; who: Who; image?: string; sources: Source[] }) {
  const tags = idea.hashtags.join(' ');
  return (
    <article className="idea">
      <ReelFrame who={who} coverText={idea.coverText} caption={idea.caption} image={image} />
      <div className="notes">
        <h3>{idea.hook}</h3>
        <div><span className="label">What to film</span><p>{idea.shot}</p></div>
        <div><span className="label">Caption</span><p style={{ whiteSpace: 'pre-line' }}>{idea.caption}</p></div>
        {tags && <p className="tags">{tags}</p>}
        <Why why={idea.why} ids={idea.sources} sources={sources} />
        <div className="actions">
          <CopyButton text={`${idea.caption}\n\n${tags}`} label="Copy caption" />
        </div>
      </div>
    </article>
  );
}

function TikTokRow({ idea, who, image, sources }: { idea: TikTokIdea; who: Who; image?: string; sources: Source[] }) {
  return (
    <article className="idea">
      <TikTokFrame who={who} onScreenText={idea.onScreenText} hook={idea.hook} sound={idea.sound} image={image} />
      <div className="notes">
        <h3>{idea.hook}</h3>
        <div>
          <span className="label">Cut by cut</span>
          <ol>{idea.beats.map((b, i) => <li key={i}>{b}</li>)}</ol>
        </div>
        {idea.sound && <div><span className="label">Sound</span><p>{idea.sound}</p></div>}
        <Why why={idea.why} ids={idea.sources} sources={sources} />
        <div className="actions">
          <CopyButton text={`${idea.hook}\n\nOn screen: ${idea.onScreenText}\n\n${idea.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}`} label="Copy script" />
        </div>
      </div>
    </article>
  );
}

function LinkedInRow({ idea, who, sources }: { idea: LinkedInIdea; who: Who; sources: Source[] }) {
  const full = `${idea.opener}\n\n${idea.body}\n\n${idea.question}`;
  return (
    <article className="idea wide">
      <LinkedInPost who={who} opener={idea.opener} body={`${idea.body}\n\n${idea.question}`} />
      <div className="notes">
        <Why why={idea.why} ids={idea.sources} sources={sources} />
        <div className="actions"><CopyButton text={full} label="Copy post" /></div>
      </div>
    </article>
  );
}

function FacebookRow({ idea, who, sources }: { idea: FacebookIdea; who: Who; sources: Source[] }) {
  const full = `${idea.opener}\n\n${idea.body}\n\n${idea.question}`;
  return (
    <article className="idea wide">
      <FacebookPost who={who} opener={idea.opener} body={idea.body} question={idea.question} />
      <div className="notes">
        <Why why={idea.why} ids={idea.sources} sources={sources} />
        <div className="actions"><CopyButton text={full} label="Copy post" /></div>
      </div>
    </article>
  );
}

// ── The desk ──────────────────────────────────────────────────────────────────

export function Desk({
  who, images, platforms, failed, sources, sourcesReady, active, setActive,
}: {
  who: Who;
  images: string[];
  platforms: Partial<PlatformIdeas>;
  failed: Partial<Record<PlatformId, string>>;
  sources: Source[];
  sourcesReady: boolean;
  active: PlatformId;
  setActive: (p: PlatformId) => void;
}) {
  const img = (i: number) => (images.length ? images[i % images.length] : undefined);
  const list = platforms[active];
  const news = sources.filter(s => s.kind === 'news');
  const threads = sources.filter(s => s.kind === 'reddit');
  const trending = sources.filter(s => s.kind === 'youtube');

  return (
    <section className="desk">
      <div>
        <div className="tabs" role="tablist" aria-label="Platforms">
          {PLATFORMS.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={active === p.id}
              className="tab"
              data-p={p.id}
              onClick={() => setActive(p.id)}
              title={`Shortcut: ${i + 1}`}
            >
              {p.name}
              {platforms[p.id] && <small>{platforms[p.id]!.length}</small>}
            </button>
          ))}
        </div>

        <div className="ideas" role="tabpanel">
          {failed[active] && !list && (
            <p className="failed">The {PLATFORMS.find(p => p.id === active)?.name} drafts didn&apos;t come through ({failed[active]}). Run the channel again to retry.</p>
          )}
          {!failed[active] && !list && <p className="pending">Writing {PLATFORMS.find(p => p.id === active)?.name} drafts</p>}

          {active === 'youtube' && (list as YouTubeIdea[] | undefined)?.map((idea, i) =>
            <YouTubeRow key={i} idea={idea} who={who} image={img(i)} sources={sources} />)}
          {active === 'instagram' && (list as InstagramIdea[] | undefined)?.map((idea, i) =>
            <InstagramRow key={i} idea={idea} who={who} image={img(i + 1)} sources={sources} />)}
          {active === 'tiktok' && (list as TikTokIdea[] | undefined)?.map((idea, i) =>
            <TikTokRow key={i} idea={idea} who={who} image={img(i + 2)} sources={sources} />)}
          {active === 'linkedin' && (list as LinkedInIdea[] | undefined)?.map((idea, i) =>
            <LinkedInRow key={i} idea={idea} who={who} sources={sources} />)}
          {active === 'facebook' && (list as FacebookIdea[] | undefined)?.map((idea, i) =>
            <FacebookRow key={i} idea={idea} who={who} sources={sources} />)}
        </div>
      </div>

      <aside className="side">
        <h2>Getting views in your niche</h2>
        {!sourcesReady ? <p className="empty">Searching</p> : trending.length ? (
          <ol>{trending.map(s => (
            <li key={s.id}><a className="src" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<span>{sourceLine(s)}</span></a></li>
          ))}</ol>
        ) : <p className="empty" style={{ marginBottom: 24 }}>No breakout videos on these topics this week.</p>}

        <h2>In the news this week</h2>
        {!sourcesReady ? <p className="empty">Searching</p> : news.length ? (
          <ol>{news.map(s => (
            <li key={s.id}><a className="src" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<span>{sourceLine(s)}</span></a></li>
          ))}</ol>
        ) : <p className="empty" style={{ marginBottom: 24 }}>No matching headlines from the last 7 days.</p>}

        <h2>On Reddit this week</h2>
        {!sourcesReady ? <p className="empty">Searching</p> : threads.length ? (
          <ol>{threads.map(s => (
            <li key={s.id}><a className="src" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<span>{sourceLine(s)}</span></a></li>
          ))}</ol>
        ) : <p className="empty">No matching threads from the last 7 days.</p>}
      </aside>
    </section>
  );
}