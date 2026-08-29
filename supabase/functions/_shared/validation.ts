export const DISPOSAL_BINS = [
  'recycle',
  'compost',
  'reuse_return',
  'landfill',
  'unknown',
] as const;

export type DisposalBin = typeof DISPOSAL_BINS[number];

export type ClassResult = {
  itemName: string;
  material: string | null;
  recommendedBin: DisposalBin;
  preparationTip: string | null;
  confidence: number;
  localeRuleVersion: string;
  explanation: string | null;
};

export function isDisposalBin(value: unknown): value is DisposalBin {
  return typeof value === 'string' && DISPOSAL_BINS.includes(value as DisposalBin);
}

export function normalizeClassification(raw: Record<string, unknown>): ClassResult {
  const confidence = Number(raw.confidence);

  return {
    itemName: String(raw.item_name || 'Unknown item').slice(0, 120),
    material: raw.material ? String(raw.material).slice(0, 120) : null,
    recommendedBin: isDisposalBin(raw.recommended_bin) ? raw.recommended_bin : 'unknown',
    preparationTip: raw.preparation_tip ? String(raw.preparation_tip).slice(0, 240) : null,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    localeRuleVersion: String(raw.locale_rule_version || 'demo-2026-08'),
    explanation: raw.explanation ? String(raw.explanation).slice(0, 300) : null,
  };
}

export function validateSubmissionInput(input: Record<string, unknown>) {
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128) {
    return 'A valid idempotency key is required.';
  }
  if (typeof input.locale !== 'string' || input.locale.length < 2 || input.locale.length > 32) {
    return 'A valid locale is required.';
  }
  if (input.crewId !== undefined && typeof input.crewId !== 'string') {
    return 'The crew ID is invalid.';
  }
  return null;
}

export function validateAnalysisInput(input: Record<string, unknown>) {
  if (typeof input.submissionId !== 'string') return 'A submission ID is required.';
  if (!isDisposalBin(input.userSelectedBin) || input.userSelectedBin === 'unknown') return 'A valid disposal bin is required.';
  return null;
}
