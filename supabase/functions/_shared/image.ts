import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.97.0';
import { ApiError } from './errors.ts';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumImageBytes = 10 * 1024 * 1024;

export async function downloadOwnedImage(
  userClient: SupabaseClient,
  userId: string,
  imagePath: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!imagePath.startsWith(`${userId}/`) || imagePath.includes('..')) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to that image.');
  }

  const { data, error } = await userClient.storage.from('scan-images').download(imagePath);
  if (error || !data) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Upload a valid image before submitting.', {
      cause: error,
    });
  }

  const contentType = data.type.toLowerCase();
  if (!allowedImageTypes.has(contentType) || data.size <= 0 || data.size > maximumImageBytes) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Use a JPEG, PNG, or WebP image up to 10 MB.');
  }

  return { bytes: new Uint8Array(await data.arrayBuffer()), contentType };
}

export function dateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
