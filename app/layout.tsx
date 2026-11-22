import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE = process.env.SITE_URL || 'https://idea-forge-liart.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'IdeaForge: what to post this week',
  description:
    'Type a YouTube channel. IdeaForge reads its recent uploads, this week\'s news and Reddit, then drafts posts for YouTube, Instagram, TikTok, LinkedIn and Facebook.',
  openGraph: {
    title: 'What should you post this week?',
    description: 'Drafts for five platforms, built from a channel\'s own style and this week\'s news.',
    url: SITE,
    siteName: 'IdeaForge',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eceef1' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1f23' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}