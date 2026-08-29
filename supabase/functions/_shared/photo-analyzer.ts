import type { DisposalBin } from './validation.ts';
import { ApiError } from './errors.ts';
import { analyzeWithOpenAI } from './openai-analyzer.ts';

export type ClassificationResult = {
  itemName: string;
  material: string | null;
  recommendedBin: DisposalBin;
  preparationTip: string | null;
  confidence: number;
  localeRuleVersion: string;
  explanation: string | null;
  matchesTask?: boolean;
  taskConfidence?: number;
  taskReason?: string | null;
};

export type PhotoInput = {
  bytes: Uint8Array;
  contentType: string;
  locale: string;
  localeRuleVersion: string;
  imagePath?: string;
  task?: {
    prompt: string;
    targetObject: string;
    targetMaterial: string | null;
    targetAction: string;
    validationMetadata?: Record<string, unknown>;
  };
};

const demoClassification: ClassificationResult = {
  itemName: 'plastic drink bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty and rinse the bottle, then replace the cap before recycling.',
  confidence: 0.86,
  localeRuleVersion: 'sg-demo-v1',
  explanation: 'The image appears to show a PET beverage bottle.',
};

export async function analyzePhoto(input: PhotoInput): Promise<ClassificationResult> {
  const isMocked = Deno.env.get('MOCK_VLM') === 'true' || !Deno.env.get('OPENAI_API_KEY');
  if (isMocked) {
    const task = input.task;
    return {
      ...demoClassification,
      itemName: task?.targetObject ?? demoClassification.itemName,
      material: task?.targetMaterial ?? demoClassification.material,
      recommendedBin: (task?.targetAction as ClassificationResult['recommendedBin']) ?? demoClassification.recommendedBin,
      localeRuleVersion: input.localeRuleVersion,
      matchesTask: Boolean(task),
      taskConfidence: task ? 0.95 : 0,
      taskReason: task ? `Demo classifier matched ${task.prompt}.` : null,
    };
  }

  try {
    return await analyzeWithOpenAI(input);
  } catch (error) {
    if (Deno.env.get('ALLOW_VLM_FALLBACK') === 'true') {
      console.warn('Using deterministic VLM fallback.', error);
      return { ...demoClassification, localeRuleVersion: input.localeRuleVersion };
    }
    throw new ApiError(503, 'MODEL_UNAVAILABLE', 'Photo analysis is temporarily unavailable.', {
      cause: error,
    });
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
    !(candidate.explanation === null || typeof candidate.explanation === 'string')
  ) {
    throw new Error('The model returned an invalid classification.');
  }
  if (
    candidate.matchesTask !== undefined &&
    (typeof candidate.matchesTask !== 'boolean' ||
      typeof candidate.taskConfidence !== 'number' ||
      candidate.taskConfidence < 0 ||
      candidate.taskConfidence > 1 ||
      !(candidate.taskReason === null || typeof candidate.taskReason === 'string'))
  ) {
    throw new Error('The model returned invalid task validation.');
  }
  return candidate as ClassificationResult;
}
