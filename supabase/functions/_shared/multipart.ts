import { ApiError } from './errors.ts';

const maximumTaskImageBytes = 10 * 1024 * 1024;
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type TaskImageForm = {
  image: File;
  taskId?: string;
  idempotencyKey: string;
  locale: string;
  demoFixture?: 'liquid_bottle' | 'empty_bottle' | 'unrelated_item';
};

export async function parseTaskImageForm(
  request: Request,
  requireIdempotencyKey = true,
): Promise<TaskImageForm> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError(
      415,
      'INVALID_IMAGE_REQUEST',
      'Upload the task image as multipart form data.',
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, 'INVALID_IMAGE_REQUEST', 'The multipart upload could not be read.');
  }
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
  if (
    requireIdempotencyKey &&
    (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128)
  ) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid submission key is required.');
  }
  const taskId = form.get('taskId');
  const locale = form.get('locale');
  // Older clients may still send userSelectedBin. It is intentionally accepted
  // at the transport boundary and ignored; the server task/model result owns scoring.
  form.get('userSelectedBin');
  const demoFixtureValue = form.get('demoFixture');
  const demoFixture =
    demoFixtureValue === 'liquid_bottle' ||
    demoFixtureValue === 'empty_bottle' ||
    demoFixtureValue === 'unrelated_item'
      ? demoFixtureValue
      : undefined;
  return {
    image,
    taskId: typeof taskId === 'string' && taskId ? taskId : undefined,
    idempotencyKey:
      typeof idempotencyKey === 'string' && idempotencyKey
        ? idempotencyKey
        : `preview-${crypto.randomUUID()}`,
    locale: typeof locale === 'string' && locale ? locale : 'en-SG',
    demoFixture,
  };
}
