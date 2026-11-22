/* eslint-disable @next/next/no-img-element */
// Drafts rendered in each platform's own shape. Images are the channel's real
// recent thumbnails, so a draft looks like it belongs on that channel.

import type { ReactNode } from 'react';

export interface Who {
  name: string;
  handle: string;
  avatar: string;
}

function Avatar({ src, size }: { src: string; size?: number }) {
  return src
    ? <img className="av" src={src} alt="" width={size} height={size} />
    : <span className="av" style={{ width: size, height: size, display: 'inline-block' }} />;
}

/** Thumbnail text with the last word in yellow, the way most thumbnails are set. */
function ThumbText({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <b>{text}</b>;
  const last = words.pop();
  return <b>{words.join(' ')} <span className="hot">{last}</span></b>;
}

export function YouTubeCard({ who, title, thumbnailText, image }: { who: Who; title: string; thumbnailText: string; image?: string }) {
  return (
    <div className="yt">
      <div className="yt-thumb">
        {image && <img src={image} alt="" />}
        {thumbnailText && <ThumbText text={thumbnailText} />}
      </div>
      <div className="yt-meta">
        <Avatar src={who.avatar} size={32} />
        <div>
          <strong>{title}</strong>
          <span>{who.name}</span>
        </div>
      </div>
    </div>
  );
}

const Icon = {
  heart: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>,
  comment: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.6 22l4.2-2.2c1 .3 2.1.4 3.2.4 5.5 0 10-3.9 10-8.6S17.5 3 12 3z"/></svg>,
  share: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 3 3 10.5l7 2.5 2.5 7L21 3z"/></svg>,
  save: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>,
};

function Phone({ image, top, children, rail }: { image?: string; top: ReactNode; children: ReactNode; rail: ReactNode[] }) {
  return (
    <div className="phone">
      {image && <img src={image} alt="" />}
      <div className="chrome">{top}</div>
      {children}
      <div className="rail">{rail.map((r, i) => <span key={i}>{r}</span>)}</div>
    </div>
  );
}

export function ReelFrame({ who, coverText, caption, image }: { who: Who; coverText: string; caption: string; image?: string }) {
  return (
    <Phone image={image} top={<><span>Reels</span><span /></>} rail={[Icon.heart, Icon.comment, Icon.share, Icon.save]}>
      {coverText && <div className="cover">{coverText}</div>}
      <div className="bottom">
        <div className="who"><Avatar src={who.avatar} size={22} />{who.handle || who.name}</div>
        <div className="cap">{caption} <em>more</em></div>
      </div>
    </Phone>
  );
}

export function TikTokFrame({ who, onScreenText, hook, sound, image }: { who: Who; onScreenText: string; hook: string; sound: string; image?: string }) {
  const soundName = /original|voice|none/i.test(sound) ? `original sound, ${who.name}` : sound.split(/[.,]/)[0];
  return (
    <Phone image={image} top={<><span>Following</span><span>For You</span></>} rail={[Icon.heart, Icon.comment, Icon.save, Icon.share]}>
      {onScreenText && <div className="tt-text">{onScreenText}</div>}
      <div className="bottom">
        <div className="who">{who.handle || who.name}</div>
        <div className="cap">{hook}</div>
        <div className="sound">♫ {soundName}</div>
      </div>
    </Phone>
  );
}

function clip(text: string, max: number) {
  if (text.length <= max) return { shown: text, cut: false };
  const at = text.lastIndexOf(' ', max);
  return { shown: text.slice(0, at > 0 ? at : max), cut: true };
}

export function LinkedInPost({ who, opener, body }: { who: Who; opener: string; body: string }) {
  const { shown, cut } = clip(`${opener}\n\n${body}`, 260);
  return (
    <div className="post li">
      <div className="post-head">
        <Avatar src={who.avatar} size={44} />
        <div><strong>{who.name}</strong><span>Creator · 1h</span></div>
      </div>
      <div className="post-body">{shown}{cut && <span className="more">… see more</span>}</div>
      <div className="post-foot"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div>
    </div>
  );
}

export function FacebookPost({ who, opener, body, question }: { who: Who; opener: string; body: string; question: string }) {
  const { shown, cut } = clip(`${opener}\n\n${body}\n\n${question}`, 240);
  return (
    <div className="post fb">
      <div className="post-head">
        <Avatar src={who.avatar} size={40} />
        <div><strong>{who.name}</strong><span>Just now</span></div>
      </div>
      <div className="post-body">{shown}{cut && <span className="more">… See more</span>}</div>
      <div className="post-foot"><span>Like</span><span>Comment</span><span>Share</span></div>
    </div>
  );
}
