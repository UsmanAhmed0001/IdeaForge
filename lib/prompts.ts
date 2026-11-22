import { str, strArr, objArr } from './ai';
import { tidy, tidyHashtags, validSources } from './clean';
import type {
  Channel, Video, Profile, Source, PlatformId,
  YouTubeIdea, InstagramIdea, TikTokIdea, LinkedInIdea, FacebookIdea,
} from './types';

// ── House style, shared by every call ─────────────────────────────────────────

export const SYSTEM = `You are a senior content strategist who has run channels for working creators.
You reply with one JSON object and nothing else.

How you write:
- Like a creator talking to their audience, never like a marketer or an assistant.
- Plain words, short sentences, concrete details: names, numbers, places, objects.
- Never use em dashes or en dashes. Use commas or full stops.
- Never use these words or phrases: delve, unlock, unleash, elevate, empower, game-changer, seamless, robust, cutting-edge, landscape, journey, navigate, realm, tapestry, testament, "in today's", "ever wondered", "let's dive", "here's the thing", "buckle up", "not just X but Y", "whether you're", "look no further", "the secret to".
- No emoji at the start of a line. No exclamation marks unless the creator's own titles use them.
- Never mention AI, algorithms you can't verify, or "content".
- Never invent statistics, quotes, studies or events. Only use facts that appear in the sources you are given. If a source gives no number, don't make one up.`;

// ── Shared context block ──────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'this week';
}

export function contextBlock(channel: Channel, videos: Video[], profile: Profile, sources: Source[]): string {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const uploads = videos.slice(0, 12).map(v => `- "${v.title}" (${v.views.toLocaleString('en-GB')} views)`).join('\n');
  const src = sources.length
    ? sources.map(s => `${s.id}: ${s.title} (${s.kind === 'reddit' ? `r/${s.subreddit || 'reddit'}` : s.outlet}, ${fmtDate(s.date)})`).join('\n')
    : 'None found this week. Base ideas on the channel\'s evergreen topics and say so in "why".';

  return `Today is ${today}.

CHANNEL: ${channel.name}
WHAT IT COVERS: ${profile.topics.join('; ')}
TITLE PATTERN: ${profile.titleFormula}
VOICE: ${profile.voice}
AUDIENCE: ${profile.audience}
FORMAT: ${profile.format}
GAP IT FILLS: ${profile.angle}

ALREADY PUBLISHED (do not repeat these topics; higher views show what lands):
${uploads}

SOURCES FROM THE LAST 7 DAYS (cite by id, e.g. "N2" or "R1"):
${src}

Rules for every idea:
- Tie each idea to at least one source above when one fits. Put the ids in "sources". Never write ids inside the text.
- "why" is one plain sentence a creator would say out loud about why this works this week.
- Each idea must be filmable by this creator with the setup their uploads already show.
- Write in the same language and mix the channel uses in its titles.
- Viewers watch with captions from anywhere, so don't assume a country unless the channel does.
- Five ideas, all different from each other.`;
}

// ── Channel profile ───────────────────────────────────────────────────────────

export function profilePrompt(channel: Channel, videos: Video[]): string {
  const list = videos.map(v => `- "${v.title}" (${v.views.toLocaleString('en-GB')} views)`).join('\n');
  return `Read this YouTube channel and describe it precisely.

CHANNEL: ${channel.name}
DESCRIPTION: ${channel.description || '(none)'}
RECENT UPLOADS:
${list}

Return:
{
  "topics": [4 to 6 specific subjects it covers, e.g. "dengue fever symptoms" not "health"],
  "searchTerms": [3 short news-search phrases (2 to 4 words) that would find this week's stories this audience cares about],
  "titleFormula": "the pattern their titles follow, with one real example from the list",
  "voice": "how they talk: tone, pacing, how they open videos, any language mix",
  "audience": "who watches, described by the problem they're trying to solve, not by country or language",
  "format": "what a typical upload looks like, e.g. 8-minute talking-head explainer with on-screen diagrams",
  "angle": "the gap this channel fills that bigger channels don't"
}`;
}

export function validateProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const topics = strArr(r.topics, 6, 80);
  if (!topics.length) return null;
  return {
    topics,
    searchTerms: strArr(r.searchTerms, 3, 60).length ? strArr(r.searchTerms, 3, 60) : topics.slice(0, 3),
    titleFormula: tidy(str(r.titleFormula, 300)),
    voice: tidy(str(r.voice, 300)),
    audience: tidy(str(r.audience, 300)),
    format: tidy(str(r.format, 200)),
    angle: tidy(str(r.angle, 300)),
  };
}

// ── Per-platform briefs ───────────────────────────────────────────────────────

const BRIEFS: Record<PlatformId, string> = {
  youtube: `Write 5 YouTube video ideas.
- "title": indistinguishable from the channel's own titles: same pattern, length, capitalisation and language mix.
- "thumbnailText": the 2 to 4 words printed on the thumbnail. Different from the title.
- "concept": 3 to 4 sentences. What the first 15 seconds say, what's shown, and the moment people will remember.
Return {"items":[{"title":"","thumbnailText":"","concept":"","why":"","sources":[]}]}`,

  instagram: `Write 5 Instagram Reels.
- "hook": the first line spoken or shown, under 12 words.
- "coverText": 2 to 5 words for the Reel cover.
- "caption": 40 to 90 words, first-person, ends with a reason to save or share. At most 2 emoji, never at a line start.
- "hashtags": 5 to 8 specific tags, no generic ones like #viral or #fyp.
- "shot": what to film, in one or two sentences: location, framing, what's on screen.
Return {"items":[{"hook":"","coverText":"","caption":"","hashtags":[],"shot":"","why":"","sources":[]}]}`,

  tiktok: `Write 5 TikToks.
- "hook": the first 2 seconds, under 10 words, spoken to camera.
- "onScreenText": the text overlay for the opening frame, under 8 words.
- "beats": 3 to 5 short lines, the video in order, each one a cut.
- "sound": original voice, a specific type of trending sound, or none, with one reason.
Return {"items":[{"hook":"","onScreenText":"","beats":[],"sound":"","why":"","sources":[]}]}`,

  linkedin: `Write 5 LinkedIn posts the creator would publish as themselves.
- "opener": the line shown before "see more", under 20 words. A specific claim or observation, not a question.
- "body": 80 to 150 words, short paragraphs separated by blank lines, one practical takeaway. No hashtag walls.
- "question": one closing question people in the field will have a real answer to.
Return {"items":[{"opener":"","body":"","question":"","why":"","sources":[]}]}`,

  facebook: `Write 5 Facebook posts for the creator's page.
- "opener": first line, warm and plain, under 15 words.
- "body": 50 to 110 words, conversational, like telling a friend something useful you just learned.
- "question": a specific question people will want to answer in the comments.
Return {"items":[{"opener":"","body":"","question":"","why":"","sources":[]}]}`,
};

export function platformPrompt(platform: PlatformId, context: string): string {
  return `${context}\n\n${BRIEFS[platform]}`;
}

// ── Validators: coerce, clean, drop anything unusable ─────────────────────────

function items(raw: unknown) {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  return objArr(Array.isArray(raw) ? raw : r.items).slice(0, 5);
}

const cite = (o: Record<string, unknown>, known: Set<string>) => ({
  why: tidy(str(o.why, 300)),
  sources: validSources(strArr(o.sources, 4, 6), known),
});

type AnyIdeas = YouTubeIdea[] | InstagramIdea[] | TikTokIdea[] | LinkedInIdea[] | FacebookIdea[];

export function validatorFor(platform: PlatformId, known: Set<string>): (raw: unknown) => AnyIdeas | null {
  const need = <T>(list: T[]) => (list.length >= 3 ? list : null);

  switch (platform) {
    case 'youtube':
      return (raw: unknown) => need<YouTubeIdea>(items(raw).map(o => ({
        title: tidy(str(o.title, 140)),
        thumbnailText: tidy(str(o.thumbnailText, 40)),
        concept: tidy(str(o.concept, 900)),
        ...cite(o, known),
      })).filter(i => i.title && i.concept));

    case 'instagram':
      return (raw: unknown) => need<InstagramIdea>(items(raw).map(o => ({
        hook: tidy(str(o.hook, 140)),
        coverText: tidy(str(o.coverText, 50)),
        caption: tidy(str(o.caption, 900)),
        hashtags: tidyHashtags(strArr(o.hashtags, 12, 40)),
        shot: tidy(str(o.shot, 400)),
        ...cite(o, known),
      })).filter(i => i.hook && i.caption));

    case 'tiktok':
      return (raw: unknown) => need<TikTokIdea>(items(raw).map(o => ({
        hook: tidy(str(o.hook, 120)),
        onScreenText: tidy(str(o.onScreenText, 60)),
        beats: strArr(o.beats, 6, 160).map(tidy),
        sound: tidy(str(o.sound, 200)),
        ...cite(o, known),
      })).filter(i => i.hook && i.beats.length));

    case 'linkedin':
      return (raw: unknown) => need<LinkedInIdea>(items(raw).map(o => ({
        opener: tidy(str(o.opener, 200)),
        body: tidy(str(o.body, 1400)),
        question: tidy(str(o.question, 200)),
        ...cite(o, known),
      })).filter(i => i.opener && i.body));

    case 'facebook':
      return (raw: unknown) => need<FacebookIdea>(items(raw).map(o => ({
        opener: tidy(str(o.opener, 160)),
        body: tidy(str(o.body, 1000)),
        question: tidy(str(o.question, 200)),
        ...cite(o, known),
      })).filter(i => i.opener && i.body));
  }
}
