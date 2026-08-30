import type { DisposalBin } from './validation.ts';
import { analyzeWithOpenAI } from './openai-analyzer.ts';

export type ClassificationResult = {
  itemName: string;
  material: string | null;
  recommendedBin: DisposalBin;
  preparationTip: string | null;
  confidence: number;
  localeRuleVersion: string;
  explanation: string | null;
  taskPrompt: string;
  promptSimilarity: number;
  taskSatisfied: boolean;
  failureReason:
    | 'liquid_present'
    | 'unrelated_item'
    | 'recycling_context_missing'
    | 'low_confidence'
    | 'upload_failure'
    | 'ai_failure'
    | null;
  matchesTask: boolean;
  taskConfidence: number;
  taskReason: string | null;
};

export type PhotoInput = {
  bytes: Uint8Array;
  contentType: string;
  locale: string;
  localeRuleVersion: string;
  imagePath?: string;
  task: {
    prompt: string;
    targetObject: string;
    targetMaterial: string | null;
    targetAction: string;
    validationMetadata?: Record<string, unknown>;
  };
  demoFixture?: 'liquid_bottle' | 'empty_bottle' | 'unrelated_item';
};

const demoClassification: ClassificationResult = {
  itemName: 'plastic drink bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty and rinse the bottle, then replace the cap before recycling.',
  confidence: 0.86,
  localeRuleVersion: 'sg-demo-v1',
  explanation: 'The image appears to show a PET beverage bottle.',
  taskPrompt: '',
  promptSimilarity: 0,
  taskSatisfied: false,
  failureReason: 'low_confidence',
  matchesTask: false,
  taskConfidence: 0,
  taskReason: 'We could not verify the supplied image against today’s mission.',
};

function aiFailureClassification(input: PhotoInput, taskReason: string): ClassificationResult {
  return {
    itemName: 'unknown item',
    material: null,
    recommendedBin: 'unknown',
    preparationTip: null,
    confidence: 0,
    localeRuleVersion: input.localeRuleVersion,
    explanation: 'The image could not be analyzed.',
    taskPrompt: input.task.prompt,
    promptSimilarity: 0,
    taskSatisfied: false,
    failureReason: 'ai_failure',
    matchesTask: false,
    taskConfidence: 0,
    taskReason,
  };
}

export function demoFixtureClassification(input: PhotoInput): ClassificationResult {
  const taskPrompt = input.task?.prompt ?? '';
  const common = {
    localeRuleVersion: input.localeRuleVersion,
    taskPrompt: taskPrompt ?? '',
    promptSimilarity: input.task ? 0.96 : 0,
    taskConfidence: input.task ? 0.96 : 0,
  };

  if (input.demoFixture === 'liquid_bottle') {
    return {
      ...common,
      itemName: 'plastic drink bottle with liquid',
      material: 'PET plastic',
      recommendedBin: 'recycle',
      preparationTip: 'Empty the bottle before recycling.',
      confidence: 0.96,
      explanation: 'The bottle matches the mission, but visible liquid is still inside.',
      taskSatisfied: false,
      failureReason: 'liquid_present',
      matchesTask: false,
      taskReason: 'Empty the bottle first.',
    };
  }

  if (input.demoFixture === 'unrelated_item') {
    return {
      ...common,
      itemName: 'unrelated household item',
      material: 'unknown',
      recommendedBin: 'landfill',
      preparationTip: null,
      confidence: 0.94,
      explanation:
        'The image does not show the single-use plastic bottle required by today’s mission.',
      taskSatisfied: false,
      failureReason: 'unrelated_item',
      matchesTask: false,
      taskReason: 'That item does not match today’s mission.',
    };
  }

  return {
    ...common,
    itemName: 'empty plastic drink bottle',
    material: 'PET plastic',
    recommendedBin: 'recycle',
    preparationTip: 'Empty the bottle before recycling.',
    confidence: 0.96,
    explanation: 'The image matches an empty single-use plastic bottle ready for recycling.',
    taskSatisfied: Boolean(input.task),
    failureReason: input.task ? null : 'low_confidence',
    matchesTask: Boolean(input.task),
    taskReason: input.task ? 'The bottle and preparation state match today’s action.' : null,
  };
}

export async function analyzePhoto(input: PhotoInput): Promise<ClassificationResult> {
  const isMocked = Deno.env.get('MOCK_VLM') === 'true';
  if (isMocked) {
    if (input.demoFixture) return demoFixtureClassification(input);
    return {
      ...demoClassification,
      localeRuleVersion: input.localeRuleVersion,
      taskPrompt: input.task.prompt,
      promptSimilarity: 0,
      matchesTask: false,
      taskConfidence: 0,
      taskSatisfied: false,
      taskReason: 'We could not verify the supplied image against today’s mission.',
    };
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return aiFailureClassification(
      input,
      'Photo analysis is not configured. Try again or use the manual guidance.',
    );
  }

  try {
    return await analyzeWithOpenAI(input);
  } catch (error) {
    console.warn('Live photo analysis failed.', error);
    return aiFailureClassification(
      input,
      'Photo analysis is temporarily unavailable. Try again or use the manual guidance.',
    );
  }
}

export function validateClassification(value: unknown): ClassificationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The model returned an invalid classification.');
  }
  const candidate = value as Record<string, unknown>;
  const bins: DisposalBin[] = ['recycle', 'compost', 'reuse_return', 'landfill', 'unknown'];
  if (
    typeof candidate.itemName !== 'string' ||
    !(candidate.material === null || typeof candidate.material === 'string') ||
    !bins.includes(candidate.recommendedBin as DisposalBin) ||
    !(candidate.preparationTip === null || typeof candidate.preparationTip === 'string') ||
    typeof candidate.confidence !== 'number' ||
    candidate.confidence < 0 ||
    candidate.confidence > 1 ||
    typeof candidate.localeRuleVersion !== 'string' ||
    !(candidate.explanation === null || typeof candidate.explanation === 'string') ||
    typeof candidate.taskPrompt !== 'string' ||
    typeof candidate.promptSimilarity !== 'number' ||
    candidate.promptSimilarity < 0 ||
    candidate.promptSimilarity > 1 ||
    typeof candidate.taskSatisfied !== 'boolean' ||
    !(
      candidate.failureReason === null ||
      [
        'liquid_present',
        'unrelated_item',
        'recycling_context_missing',
        'low_confidence',
        'upload_failure',
        'ai_failure',
      ].includes(candidate.failureReason as string)
    ) ||
    typeof candidate.matchesTask !== 'boolean' ||
    typeof candidate.taskConfidence !== 'number' ||
    candidate.taskConfidence < 0 ||
    candidate.taskConfidence > 1 ||
    !(candidate.taskReason === null || typeof candidate.taskReason === 'string')
  ) {
    throw new Error('The model returned an invalid classification.');
  }
  return candidate as ClassificationResult;
}
