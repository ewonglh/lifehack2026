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
  if (error || !data) {
    throw new ApiError(404, 'DAILY_TASK_NOT_AVAILABLE', 'Today’s task is not available.', { cause: error });
  }
  return data as DailyTask;
}

async function getActiveSquadId(admin: AdminClient, actorId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('squad_members')
    .select('squad_id')
    .eq('profile_id', actorId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load squad membership.', { cause: error });
  return data?.squad_id ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'create-submission', 10, 60);
    const form = await parseTaskImageForm(request);
    if (!form.userSelectedBin) {
      throw new ApiError(400, 'BIN_SELECTION_REQUIRED', 'Choose a disposal bin before submitting.');
    }
    const task = await getDailyTask(context.admin, context.user.id);
    if (form.taskId && form.taskId !== task.taskId) {
      throw new ApiError(409, 'DAILY_TASK_MISMATCH', 'This is not your assigned task.');
    }

    const classification = await analyzePhoto({
      bytes: new Uint8Array(await form.image.arrayBuffer()),
      contentType: form.image.type,
      locale: form.locale,
      localeRuleVersion: 'task-v1',
      imagePath: 'ephemeral',
      task,
    });
    const squadId = await getActiveSquadId(context.admin, context.user.id);
    const matchesTask = classification.matchesTask === true && (classification.taskConfidence ?? 0) >= 0.75;
    const { data, error } = await context.admin.rpc('record_task_submission', {
      p_actor_id: context.user.id,
      p_task_id: task.taskId,
      p_task_day: task.taskDay,
      p_idempotency_key: form.idempotencyKey,
      p_model_result: classification,
      p_matches_task: matchesTask,
      p_confidence: classification.confidence,
      p_validation_reason: classification.taskReason ?? classification.explanation,
      p_item_name: classification.itemName,
      p_material: classification.material,
      p_recommended_bin: classification.recommendedBin,
      p_user_selected_bin: form.userSelectedBin,
      p_squad_id: squadId,
    });
    if (error || !data) {
      const code = error?.message.match(/(DAILY_TASK_MISMATCH|DAILY_TASK_EXPIRED|SQUAD_MEMBERSHIP_REQUIRED)/)?.[1];
      throw new ApiError(code === 'SQUAD_MEMBERSHIP_REQUIRED' ? 403 : 409, code ?? 'SUBMISSION_FAILED', code?.toLowerCase().replaceAll('_', ' ') ?? 'Unable to save this task attempt.', { cause: error });
    }
    return jsonResponse({ ...data, task });
  } catch (error) {
    return errorResponse(error);
  }
});
