import {
  type ClassificationResult,
  type PhotoInput,
  validateClassification,
} from './photo-analyzer.ts';

const classificationSchema = {
  type: 'object',
  properties: {
    itemName: { type: 'string' },
    material: { type: ['string', 'null'] },
    recommendedBin: {
      type: 'string',
      enum: ['recycle', 'compost', 'reuse_return', 'landfill', 'unknown'],
    },
    preparationTip: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    localeRuleVersion: { type: 'string' },
    explanation: { type: ['string', 'null'] },
  },
  required: [
    'itemName',
    'material',
    'recommendedBin',
    'preparationTip',
    'confidence',
    'localeRuleVersion',
    'explanation',
  ],
  additionalProperties: false,
};

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function extractOutputText(payload: Record<string, unknown>): string {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const candidate = part as Record<string, unknown>;
      if (candidate.type === 'output_text' && typeof candidate.text === 'string')
        return candidate.text;
      if (candidate.type === 'refusal' && typeof candidate.refusal === 'string') {
        throw new Error(`Model refused the image: ${candidate.refusal}`);
      }
    }
  }
  throw new Error('The model response did not contain output text.');
}

export async function analyzeWithOpenAI(input: PhotoInput): Promise<ClassificationResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
      store: false,
      instructions:
        'Classify one household item for disposal. Be conservative: use unknown when the image or local rule is unclear. Never infer certainty from the user-selected bin.',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Locale: ${input.locale}. Rule version: ${input.localeRuleVersion}. Analyze this item.`,
            },
            {
              type: 'input_image',
              image_url: `data:${input.contentType};base64,${encodeBase64(input.bytes)}`,
              detail: 'high',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'disposal_classification',
          strict: true,
          schema: classificationSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI returned ${response.status}: ${message.slice(0, 500)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return validateClassification(JSON.parse(extractOutputText(payload)));
}
