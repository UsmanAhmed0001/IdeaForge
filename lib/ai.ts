// OpenRouter client. One pinned model (AI_MODEL) with a single fallback,
// JSON-object output, and one retry when the reply doesn't parse or validate.

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openrouter/free';

function models(): string[] {
  const primary = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  return primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL];
}

async function complete(model: string, system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.SITE_URL || 'https://idea-forge-liart.vercel.app',
      'X-Title': 'IdeaForge',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter ${res.status}`);
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Empty model reply');
  return content;
}

export function parseJSON(text: string): unknown {
  const clean = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(clean); } catch { /* fall through */ }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

/**
 * Ask for a JSON object and run it through `validate`.
 * Tries the pinned model twice, then the fallback model once.
 */
export async function askJSON<T>(
  system: string,
  user: string,
  validate: (raw: unknown) => T | null,
  temperature = 0.8,
): Promise<T> {
  let lastError = 'No reply';
  const attempts = models().flatMap((m, i) => (i === 0 ? [m, m] : [m]));

  for (const model of attempts) {
    try {
      const out = validate(parseJSON(await complete(model, system, user, temperature)));
      if (out) return out;
      lastError = `Unusable reply from ${model}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

// ── Small validators (no extra dependency needed) ─────────────────────────────

export function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function strArr(v: unknown, maxItems = 12, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

export function objArr(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
}
