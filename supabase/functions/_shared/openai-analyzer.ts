import {
  type ClassificationResult,
  type PhotoInput,
  validateClassification,
} from './photo-analyzer.ts';

type JsonObject = Record<string, unknown>;

type OpenAIResponse = {
  model?: string;
  output?: Array<{
    type?: unknown;
    content?: unknown;
  }>;
  error?: {
    message?: unknown;
  };
  incomplete_details?: {
    reason?: unknown;
  };
};

const classificationSchema = {
  type: 'object',
  properties: {
    itemName: {
      type: 'string',
      description: 'The household item identified in the image.',
    },
    material: {
      type: ['string', 'null'],
      description: 'The material identified, or null when it cannot be determined.',
    },
    recommendedBin: {
      type: 'string',
      enum: ['recycle', 'compost', 'reuse_return', 'landfill', 'unknown'],
      description: 'The recommended disposal route.',
    },
    preparationTip: {
      type: ['string', 'null'],
      description: 'A preparation instruction, or null when none is needed.',
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the item and disposal classification.',
    },
    localeRuleVersion: {
      type: 'string',
      description: 'The local recycling-rule version used for the classification.',
    },
    explanation: {
      type: ['string', 'null'],
      description: 'A concise explanation of the classification, or null when unavailable.',
    },
    taskPrompt: {
      type: 'string',
      description: 'The supplied daily-task prompt.',
    },
    promptSimilarity: {
      type: 'number',
      description: 'How closely the image matches the supplied task prompt.',
    },
    taskSatisfied: {
      type: 'boolean',
      description: 'Whether all required task conditions are visible.',
    },
    failureReason: {
      type: ['string', 'null'],
      enum: [
        null,
        'liquid_present',
        'unrelated_item',
        'recycling_context_missing',
        'low_confidence',
        'upload_failure',
        'ai_failure',
      ],
      description: 'The task failure category, or null when the task is not failed.',
    },
    matchesTask: {
      type: 'boolean',
      description: 'Whether the image satisfies the complete daily task.',
    },
    taskConfidence: {
      type: 'number',
      description: 'Confidence in the task-match decision.',
    },
    taskReason: {
      type: ['string', 'null'],
      description: 'The reason for the task-match decision, or null when unavailable.',
    },
  },
  required: [
    'itemName',
    'material',
    'recommendedBin',
    'preparationTip',
    'confidence',
    'localeRuleVersion',
    'explanation',
    'taskPrompt',
    'promptSimilarity',
    'taskSatisfied',
    'failureReason',
    'matchesTask',
    'taskConfidence',
    'taskReason',
  ],
  additionalProperties: false,
} as const;

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

function extractOutputText(payload: OpenAIResponse): string {
  const providerError = asObject(payload.error);
  const providerMessage = providerError?.message;
  if (typeof providerMessage === 'string') {
    throw new Error(`OpenAI did not return a response: ${providerMessage}`);
  }

  for (const outputItem of payload.output ?? []) {
    if (!Array.isArray(outputItem.content)) continue;

    for (const part of outputItem.content) {
      const object = asObject(part);
      if (object?.type === 'refusal' && typeof object.refusal === 'string') {
        throw new Error(`Model refused the image: ${object.refusal}`);
      }
      if (object?.type === 'output_text' && typeof object.text === 'string') {
        return object.text;
      }
    }
  }

  const incompleteReason = payload.incomplete_details?.reason;
  if (typeof incompleteReason === 'string') {
    throw new Error(`OpenAI response was incomplete: ${incompleteReason}`);
  }

  throw new Error('OpenAI response did not contain output text.');
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
      `OpenAI returned invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
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
    'Follow the supplied response schema exactly and return no Markdown or additional fields. Use null for optional string fields.',
    'Use null for optional string fields. recommendedBin must be one of recycle, compost, reuse_return, landfill, unknown. failureReason must be null or one of liquid_present, unrelated_item, recycling_context_missing, low_confidence, upload_failure, ai_failure.',
  ].join('. ');
}

export async function analyzeWithOpenAI(input: PhotoInput): Promise<ClassificationResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        'Classify one household item for disposal and validate it against the supplied task. Evaluate the object, material, preparation state, and recycling context. Be strict: taskSatisfied and matchesTask are true only when every required part is visible. Use unknown and low_confidence when the image or local rule is unclear.',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: buildTaskPrompt(input) },
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
          name: 'ecocrew_classification',
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

  const payload = (await response.json()) as OpenAIResponse;
  const content = extractOutputText(payload);
  try {
    const result = validateClassification(parseJsonContent(content));
    console.info('OpenAI photo analysis completed.', {
      requestedModel: model,
      selectedModel: payload.model ?? null,
    });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'validation error';
    throw new Error(
      `OpenAI model ${payload.model ?? model} returned an invalid classification: ${reason}`,
    );
  }
}
