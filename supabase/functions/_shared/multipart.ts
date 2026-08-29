import { ApiError } from './errors.ts';

const maximumTaskImageBytes = 10 * 1024 * 1024;
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type TaskImageForm = {
  image: File;
  taskId?: string;
  idempotencyKey: string;
  locale: string;
};

export async function parseTaskImageForm(request: Request, requireIdempotencyKey = true): Promise<TaskImageForm> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError(415, 'INVALID_IMAGE_REQUEST', 'Upload the task image as multipart form data.');
  }

  const form = await request.formData();
  const image = form.get('image');
  if (!(image instanceof File) || image.size === 0) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Choose an image before submitting.');
  }
  if (!supportedImageTypes.has(image.type)) {
    throw new ApiError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Use a JPEG, PNG, or WebP image.');
  }
  if (image.size > maximumTaskImageBytes) {
    throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Task images must be 10 MB or smaller.');
  }

  const idempotencyKey = form.get('idempotencyKey');
  if (requireIdempotencyKey && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid submission key is required.');
  }
  const taskId = form.get('taskId');
  const locale = form.get('locale');
  return {
    image,
    taskId: typeof taskId === 'string' && taskId ? taskId : undefined,
    idempotencyKey: typeof idempotencyKey === 'string' && idempotencyKey ? idempotencyKey : `preview-${crypto.randomUUID()}`,
    locale: typeof locale === 'string' && locale ? locale : 'en-SG',
  };
}
