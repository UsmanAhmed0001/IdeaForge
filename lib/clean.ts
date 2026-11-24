// Post-processing for model output. Removes the habits that make text read
// as machine-written, and any citation markers that leaked into prose.

const LEADING_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;
const CITATION = /\s*\[?\b(?:NEWS|REDDIT|N|R)\s?\d\b\]?:?/g;

export function tidy(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')        // markdown bold
    .replace(/\s+[—–]\s+/g, ', ')            // spaced em/en dash → comma
    .replace(/[—–]/g, ', ')                  // unspaced em/en dash → comma
    .replace(/,\s*,/g, ',')
    .replace(CITATION, '')                   // stray [NEWS 1] / R2 markers
    .split('\n')
    .map(line => line.replace(LEADING_EMOJI, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function tidyHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const tag = '#' + t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    const key = tag.toLowerCase();
    if (tag.length > 2 && !seen.has(key)) { seen.add(key); out.push(tag); }
  }
  return out.slice(0, 10);
}

/** Keep only source ids that actually exist. */
export function validSources(ids: string[], known: Set<string>): string[] {
  return [...new Set(ids.map(s => s.toUpperCase().replace(/[^NRY0-9]/g, '')))].filter(id => known.has(id)).slice(0, 3);
}