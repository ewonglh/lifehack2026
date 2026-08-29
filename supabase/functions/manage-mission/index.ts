import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext } from '../_shared/supabase.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'getDaily') throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported task action.');
    const { data, error } = await context.admin.rpc('get_or_assign_daily_task', {
      p_actor_id: context.user.id,
    });
    if (error || !data) throw new ApiError(404, 'DAILY_TASK_NOT_AVAILABLE', 'Today’s task is not available.', { cause: error });
    return jsonResponse({ task: data });
  } catch (error) {
    return errorResponse(error);
  }
});
