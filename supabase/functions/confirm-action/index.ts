import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import { requireObject, requireString, requireUuid } from '../_shared/validation.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'confirm-action', 10, 60);
    const body = requireObject(await request.json().catch(() => ({})));
    const submissionId = requireUuid(body, 'submissionId');
    const idempotencyKey = requireString(body, 'idempotencyKey', 8, 128);
    const action = requireString(body, 'action', 1, 40);
    if (action !== 'recycle_bottle') {
      throw new ApiError(400, 'INVALID_ACTION', 'This action is not supported.');
    }

    const { data, error } = await context.admin.rpc('confirm_recycling_action', {
      p_actor_id: context.user.id,
      p_submission_id: submissionId,
      p_idempotency_key: idempotencyKey,
    });
    if (error || !data) {
      const code = error?.message?.match(
        /(SUBMISSION_NOT_FOUND|SUBMISSION_NOT_PENDING|DAILY_TASK_EXPIRED|INVALID_IDEMPOTENCY_KEY)/,
      )?.[1];
      const messages: Record<string, string> = {
        SUBMISSION_NOT_FOUND: 'That task attempt is not available.',
        SUBMISSION_NOT_PENDING: 'This action is no longer waiting for check-in.',
        DAILY_TASK_EXPIRED: 'Today’s task has expired. Refresh to load the current task.',
        INVALID_IDEMPOTENCY_KEY: 'A valid confirmation key is required.',
      };
      throw new ApiError(
        code === 'SUBMISSION_NOT_FOUND' ? 404 : code === 'INVALID_IDEMPOTENCY_KEY' ? 400 : 409,
        code ?? 'CONFIRMATION_FAILED',
        messages[code ?? ''] ?? 'We could not save your check-in. Please try again.',
        { cause: error },
      );
    }
    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
});
