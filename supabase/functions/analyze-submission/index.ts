import { analyzePhoto } from '../_shared/photo-analyzer.ts';
import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { parseTaskImageForm } from '../_shared/multipart.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';

type DailyTask = {
  taskId: string;
  taskDay: string;
  prompt: string;
  targetObject: string;
  targetMaterial: string | null;
  targetAction: string;
  validationMetadata?: Record<string, unknown>;
};

type AdminClient = Awaited<ReturnType<typeof createRequestContext>>['admin'];

async function getDailyTask(admin: AdminClient, actorId: string): Promise<DailyTask> {
  const { data, error } = await admin.rpc('get_or_assign_daily_task', { p_actor_id: actorId });
  if (error || !data) throw new ApiError(404, 'DAILY_TASK_NOT_AVAILABLE', 'Today’s task is not available.', { cause: error });
  return data as DailyTask;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'analyze-submission', 10, 60);
    const form = await parseTaskImageForm(request, false);
    const task = await getDailyTask(context.admin, context.user.id);
    if (form.taskId && form.taskId !== task.taskId) throw new ApiError(409, 'DAILY_TASK_MISMATCH', 'This is not your assigned task.');
    const classification = await analyzePhoto({
      bytes: new Uint8Array(await form.image.arrayBuffer()),
      contentType: form.image.type,
      locale: form.locale,
      localeRuleVersion: 'task-v1',
      imagePath: 'ephemeral',
      task,
    });
    return jsonResponse({ task, classification });
  } catch (error) {
    return errorResponse(error);
  }
});
