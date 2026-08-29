import {
  type ClassificationResult,
  type PhotoInput,
  validateClassification,
} from './photo-analyzer.ts';

type JsonObject = Record<string, unknown>;

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      refusal?: unknown;
    };
  }>;
  error?: {
    message?: unknown;
  };
};

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function extractAssistantText(payload: OpenRouterResponse): string {
  const message = payload.choices?.[0]?.message;
  if (!message) {
    const providerError = asObject(payload.error);
    const providerMessage = providerError?.message;
    if (typeof providerMessage === 'string') {
      throw new Error(`OpenRouter did not return a completion: ${providerMessage}`);
    }
    throw new Error('OpenRouter response did not contain a choice message.');
  }

  if (typeof message.refusal === 'string' && message.refusal.length > 0) {
    throw new Error(`Model refused the image: ${message.refusal}`);
  }

  if (typeof message.content === 'string') return message.content;

  // Some OpenAI-compatible providers return content as an array of parts.
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => {
        const object = asObject(part);
        return typeof object?.text === 'string' ? object.text : '';
      })
      .join('')
      .trim();

    if (text.length > 0) return text;
  }

  throw new Error('OpenRouter response did not contain message content.');
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch (error) {
    throw new Error(
      `OpenRouter returned invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
    );
  }
}

function buildTaskPrompt(input: PhotoInput): string {
  return [
    `Locale: ${input.locale}`,
    `Rule version: ${input.localeRuleVersion}`,
    `Task: ${input.task.prompt}`,
    `Target object: ${input.task.targetObject}`,
    `Target material: ${input.task.targetMaterial ?? 'not specified'}`,
    `Target action: ${input.task.targetAction}`,
    `Additional validation metadata: ${JSON.stringify(input.task.validationMetadata ?? {})}`,
    'Return a JSON object with exactly these fields: itemName, material, recommendedBin, preparationTip, confidence, localeRuleVersion, explanation, taskPrompt, promptSimilarity, taskSatisfied, failureReason, matchesTask, taskConfidence, taskReason.',
    'Use null for optional string fields. recommendedBin must be one of recycle, compost, reuse_return, landfill, unknown. failureReason must be null or one of liquid_present, unrelated_item, recycling_context_missing, low_confidence, upload_failure, ai_failure.',
  ].join('. ');
}

export async function analyzeWithOpenRouter(input: PhotoInput): Promise<ClassificationResult> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const siteUrl = Deno.env.get('OPENROUTER_SITE_URL');
  if (siteUrl) headers['HTTP-Referer'] = siteUrl;

  const appTitle = Deno.env.get('OPENROUTER_APP_TITLE');
  if (appTitle) headers['X-OpenRouter-Title'] = appTitle;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: Deno.env.get('OPENROUTER_MODEL') ?? 'minimax/minimax-m3:free',
      messages: [
        {
          role: 'system',
          content:
            'Classify one household item for disposal and validate it against the supplied task. Evaluate the object, material, preparation state, and recycling context. Be strict: taskSatisfied and matchesTask are true only when every required part is visible. Use unknown and low_confidence when the image or local rule is unclear. Return only valid JSON without Markdown fences.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildTaskPrompt(input) },
            {
              type: 'image_url',
              image_url: {
                url: `data:${input.contentType};base64,${encodeBase64(input.bytes)}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter returned ${response.status}: ${message.slice(0, 500)}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const content = extractAssistantText(payload);
  return validateClassification(parseJsonContent(content));
}
