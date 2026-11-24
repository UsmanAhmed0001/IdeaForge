// Thumbnail backgrounds from Gemini's image models.
// The image has no text on purpose: the headline is laid over it in the UI,
// because image models often misspell words.

const MODELS = () => [...new Set([
  process.env.IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
])];

export interface ThumbBrief {
  title: string;
  thumbnailText: string;
  concept: string;
  channelFormat?: string;
}

export function imagePrompt(b: ThumbBrief): string {
  return `A YouTube thumbnail image, 16:9, for a video titled "${b.title}".
What the video is about: ${b.concept}
${b.channelFormat ? `The channel's usual format: ${b.channelFormat}\n` : ''}
Make it look like a real, high-performing YouTube thumbnail: one bold, instantly readable focal subject, strong contrast, saturated colour, dramatic lighting, shallow depth of field, shot like a photo.
Keep the left third of the frame darker and uncluttered, because a large headline will be placed there.
Do not include any text, letters, numbers, logos, watermarks or captions anywhere in the image.
Do not depict any real, identifiable person. If a person fits the idea, show an anonymous one or show only their hands.`;
}

export async function generateThumbnail(b: ThumbBrief): Promise<{ data: Buffer; mime: string; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set, so thumbnails can\'t be generated.');

  let lastError = 'No image returned';
  for (const model of MODELS()) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: imagePrompt(b) }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = data?.error?.message || `Image request failed (${res.status})`;
        continue;
      }
      type Part = { inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } };
      const parts: Part[] = data?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        const inline = p.inlineData
          ? { data: p.inlineData.data, mime: p.inlineData.mimeType }
          : p.inline_data ? { data: p.inline_data.data, mime: p.inline_data.mime_type } : null;
        if (inline?.data) return { data: Buffer.from(inline.data, 'base64'), mime: inline.mime || 'image/png', model };
      }
      lastError = data?.candidates?.[0]?.finishReason
        ? `The model declined this image (${data.candidates[0].finishReason}).`
        : 'The model returned no image.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}
