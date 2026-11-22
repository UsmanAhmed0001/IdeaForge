import { ImageResponse } from 'next/og';

export const alt = 'IdeaForge: what should you post this week?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#eceef1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 800, color: '#000' }}>IdeaForge</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 92, fontWeight: 800, color: '#000', lineHeight: 1, letterSpacing: -3 }}>
            What should you post
          </div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, lineHeight: 1.1, letterSpacing: -3 }}>
            <span style={{ background: '#ffe14d', padding: '0 12px' }}>this week?</span>
          </div>
        </div>
        <div style={{ fontSize: 30, color: '#5a5f68' }}>
          YouTube, Instagram, TikTok, LinkedIn and Facebook drafts from one channel.
        </div>
      </div>
    ),
    size,
  );
}
