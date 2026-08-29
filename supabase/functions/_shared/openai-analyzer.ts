import { normalizeClassification, type ClassResult } from './validation.ts';
import { withRetry } from './retry.ts';

export class ModelUnavailableError extends Error {
  constructor() {
    super('MODEL_UNAVAILABLE');
    this.name = 'ModelUnavailableError';
  }
}

export async function analyzeImage(imageUrl: string, locale: string): Promise<ClassResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    return normalizeClassification({
      recommended_bin: 'unknown',
      confidence: 0,
      explanation: 'AI guidance is temporarily unavailable.',
    });
  }

  const response = await withRetry(() => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Classify household disposal for locale ${locale}. Return JSON only with item_name, material, recommended_bin, preparation_tip, confidence, locale_rule_version, and explanation. recommended_bin must be recycle, compost, reuse_return, landfill, or unknown. Use unknown when unclear.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify this item and recommend its disposal bin.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  }), 3);

  if (!response.ok) throw new ModelUnavailableError();

  try {
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '{}';
    return normalizeClassification(JSON.parse(content));
  } catch {
    throw new ModelUnavailableError();
  }
}
