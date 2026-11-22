// Shared between the API route and the client.

export type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'linkedin' | 'facebook';

export const PLATFORM_IDS: PlatformId[] = ['youtube', 'instagram', 'tiktok', 'linkedin', 'facebook'];

export interface Channel {
  id: string;
  name: string;
  handle: string;
  description: string;
  avatar: string;
  subscribers: number;
}

export interface Video {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
}

export interface Profile {
  topics: string[];
  searchTerms: string[];
  titleFormula: string;
  voice: string;
  audience: string;
  format: string;
  angle: string;
}

/** A real, linkable item the ideas are allowed to cite. id is N1..N6 or R1..R6. */
export interface Source {
  id: string;
  kind: 'news' | 'reddit';
  title: string;
  outlet: string;
  subreddit?: string;
  url: string;
  date?: string;
  score?: number;
  comments?: number;
}

interface Cited {
  why: string;
  sources: string[];
}

export interface YouTubeIdea extends Cited {
  title: string;
  thumbnailText: string;
  concept: string;
}

export interface InstagramIdea extends Cited {
  hook: string;
  coverText: string;
  caption: string;
  hashtags: string[];
  shot: string;
}

export interface TikTokIdea extends Cited {
  hook: string;
  onScreenText: string;
  beats: string[];
  sound: string;
}

export interface LinkedInIdea extends Cited {
  opener: string;
  body: string;
  question: string;
}

export interface FacebookIdea extends Cited {
  opener: string;
  body: string;
  question: string;
}

export interface PlatformIdeas {
  youtube: YouTubeIdea[];
  instagram: InstagramIdea[];
  tiktok: TikTokIdea[];
  linkedin: LinkedInIdea[];
  facebook: FacebookIdea[];
}

/** One line of the NDJSON stream the API sends. */
export type StreamEvent =
  | { type: 'log'; text: string }
  | { type: 'channel'; channel: Channel; videos: Video[] }
  | { type: 'profile'; profile: Profile }
  | { type: 'sources'; sources: Source[] }
  | { type: 'platform'; platform: PlatformId; items: PlatformIdeas[PlatformId] }
  | { type: 'platform_error'; platform: PlatformId; message: string }
  | { type: 'done'; cached: boolean }
  | { type: 'error'; message: string };
