import { analyzeWithOpenAI } from './openai-analyzer.ts';

const validClassification = {
  itemName: 'empty plastic bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty the bottle before recycling.',
  confidence: 0.96,
  localeRuleVersion: 'sg-demo-v1',
  explanation: 'The image matches the assigned task.',
  taskPrompt: 'Recycle an empty single-use plastic bottle.',
  promptSimilarity: 0.96,
  taskSatisfied: true,
  failureReason: null,
  matchesTask: true,
  taskConfidence: 0.96,
  taskReason: 'The bottle is empty and ready for recycling.',
};

const input = {
  bytes: new Uint8Array([0]),
  contentType: 'image/png',
  locale: 'en-SG',
  localeRuleVersion: 'sg-demo-v1',
  task: {
    prompt: 'Recycle an empty single-use plastic bottle.',
    targetObject: 'single-use plastic bottle',
    targetMaterial: 'plastic',
    targetAction: 'recycle',
  },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) Deno.env.delete(name);
  else Deno.env.set(name, value);
}

Deno.test('sends the OpenAI Responses image request with strict structured output', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = Deno.env.get('OPENAI_API_KEY');
  const originalModel = Deno.env.get('OPENAI_MODEL');
  let requestBody: Record<string, any> | null = null;

  Deno.env.set('OPENAI_API_KEY', 'test-key');
  Deno.env.delete('OPENAI_MODEL');
  globalThis.fetch = async (request, init) => {
    assert(request === 'https://api.openai.com/v1/responses', 'unexpected API URL');
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: 'gpt-4o-mini',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(validClassification) }],
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const result = await analyzeWithOpenAI(input);
    assert(result.matchesTask, 'expected the valid fixture to pass validation');
    assert(requestBody?.model === 'gpt-4o-mini', 'expected the default OpenAI model');
    assert(requestBody?.store === false, 'expected response storage to be disabled');
    assert(requestBody?.text?.format?.type === 'json_schema', 'expected JSON Schema output');
    assert(requestBody?.text?.format?.strict === true, 'expected strict schema output');
    assert(
      requestBody?.text?.format?.schema?.additionalProperties === false,
      'expected additional properties to be rejected',
    );
    assert(
      requestBody?.text?.format?.schema?.required?.length === 14,
      'expected every classification field to be required',
    );
    assert(
      requestBody?.input?.[0]?.content?.[1]?.type === 'input_image',
      'expected an input image content block',
    );
    assert(
      requestBody?.input?.[0]?.content?.[1]?.image_url === 'data:image/png;base64,AA==',
      'expected the image to be sent as a base64 data URL',
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
    restoreEnvironment('OPENAI_MODEL', originalModel);
  }
});
