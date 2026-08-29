import { ApiError } from './errors.ts';

export const disposalBins = ['recycle', 'compost', 'reuse_return', 'landfill', 'unknown'] as const;

export type DisposalBin = (typeof disposalBins)[number];

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'The request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function requireString(
  source: Record<string, unknown>,
  key: string,
  minimum = 1,
  maximum = 200,
): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum) {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} is invalid.`);
  }
  return value.trim();
}

export function optionalString(
  source: Record<string, unknown>,
  key: string,
  maximum = 200,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maximum) {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} is invalid.`);
  }
  return value.trim();
}

export function optionalBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} must be a boolean.`);
  }
  return value;
}

export function requireInteger(
  source: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = source[key];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} is invalid.`);
  }
  return value as number;
}

export function requireBin(source: Record<string, unknown>, key: string): DisposalBin {
  const raw = requireString(source, key, 1, 30);
  const value = raw === 'reuse' ? 'reuse_return' : raw;
  if (!disposalBins.includes(value as DisposalBin)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} is not a supported disposal bin.`);
  }
  return value as DisposalBin;
}

export function requireUuid(source: Record<string, unknown>, key: string): string {
  const value = requireString(source, key, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${key} must be a UUID.`);
  }
  return value;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
