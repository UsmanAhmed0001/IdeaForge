// Talks to Gemini directly when GEMINI_API_KEY is set, otherwise to OpenRouter.
// Both use the OpenAI-compatible chat format, JSON output, and one retry on a bad reply.

interface Provider { url: string; key: string; models: string[]; headers: Record<string, string> }

function provider(): Provider {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) {
    const primary = process.env.AI_MODEL?.trim().replace(/^google\//, '') || 'gemini-3.5-flash';
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: gemini,
      models: [...new Set([primary, 'gemini-3.5-flash-lite'])],
      headers: {},
    };
  }
  const primary = process.env.AI_MODEL?.trim() || 'google/gemini-2.5-flash';
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY || '',
    models: primary === 'openrouter/free' ? [primary] : [primary, 'openrouter/free'],
    headers: {
      'HTTP-Referer': process.env.SITE_URL || 'https://idea-forge-liart.vercel.app',
      'X-Title': 'IdeaForge',
    },
  };
}

export const hasAIKey = () => !!(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);

async function complete(p: Provider, model: string, system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}`, ...p.headers },
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
  const err = Array.isArray(data) ? data[0]?.error : data?.error;
  if (!res.ok) throw new Error(err?.message || `AI request failed (${res.status})`);
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
  const p = provider();
  const attempts = p.models.flatMap((m, i) => (i === 0 ? [m, m] : [m]));

  for (const model of attempts) {
    try {
      const out = validate(parseJSON(await complete(p, model, system, user, temperature)));
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