import { demoFixtureClassification, validateClassification } from './photo-analyzer.ts';

const validClassification = {
  itemName: 'empty plastic bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty the bottle before recycling.',
  confidence: 0.96,
  localeRuleVersion: 'sg-demo-v1',
  explanation: 'The image matches the assigned task.',
  taskPrompt:
    'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
  promptSimilarity: 0.96,
  taskSatisfied: true,
  failureReason: null,
  matchesTask: true,
  taskConfidence: 0.96,
  taskReason: 'The bottle is empty and held toward a recycling bin.',
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixtureInput = {
  bytes: new Uint8Array(),
  contentType: 'image/png',
  locale: 'en-SG',
  localeRuleVersion: 'sg-demo-v1',
  task: {
    prompt:
      'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    targetObject: 'single-use plastic bottle',
    targetMaterial: 'plastic',
    targetAction: 'recycle',
  },
} as const;

Deno.test('accepts a complete bounded task classification', () => {
  const result = validateClassification(validClassification);
  assert(result.matchesTask, 'expected task match');
  assert(result.promptSimilarity === 0.96, 'expected prompt similarity');
});

Deno.test('rejects missing strict task fields', () => {
  const incomplete = { ...validClassification };
  delete (incomplete as Record<string, unknown>).matchesTask;
  let rejected = false;
  try {
    validateClassification(incomplete);
  } catch {
    rejected = true;
  }
  assert(rejected, 'incomplete classification should be rejected');
});

Deno.test('rejects out-of-range similarity and unknown failure reasons', () => {
  for (const candidate of [
    { ...validClassification, promptSimilarity: 1.01 },
    { ...validClassification, failureReason: 'wrong_bin' },
  ]) {
    let rejected = false;
    try {
      validateClassification(candidate);
    } catch {
      rejected = true;
    }
    assert(rejected, 'invalid classification should be rejected');
  }
});

Deno.test('keeps deterministic fixtures task-specific', () => {
  const liquid = demoFixtureClassification({ ...fixtureInput, demoFixture: 'liquid_bottle' });
  const empty = demoFixtureClassification({ ...fixtureInput, demoFixture: 'empty_bottle' });
  const unrelated = demoFixtureClassification({ ...fixtureInput, demoFixture: 'unrelated_item' });
  assert(
    !liquid.matchesTask && liquid.failureReason === 'liquid_present',
    'liquid fixture should fail the task',
  );
  assert(
    empty.matchesTask && empty.taskSatisfied && empty.failureReason === null,
    'empty fixture should satisfy the task',
  );
  assert(
    !unrelated.matchesTask && unrelated.failureReason === 'unrelated_item',
    'unrelated fixture should fail the task',
  );
});
