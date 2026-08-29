const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePhoto(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { valid: false, reason: 'Only JPEG, PNG, and WebP images are supported.' };
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { valid: false, reason: 'Images must be smaller than 10 MB.' };
  }

  return { valid: true, reason: null };
}

export function isOwnedImagePath(path: string, userId: string) {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}
