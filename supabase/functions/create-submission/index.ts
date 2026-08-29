import { analyzePhoto } from '../_shared/photo-analyzer.ts';
import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { parseTaskImageForm } from '../_shared/multipart.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';

type DailyTask = {
  taskId: string;
  taskDay: string;
  title: string;
  instruction: string;
  prompt: string;
  locale: string;
  localeRuleVersion: string;
  targetObject: string;
  targetMaterial: string | null;
  targetAction: string;
  validationMetadata?: Record<string, unknown>;
};

type AdminClient = Awaited<ReturnType<typeof createRequestContext>>['admin'];

async function getDailyTask(admin: AdminClient, actorId: string): Promise<DailyTask> {
  const { data, error } = await admin.rpc('get_or_assign_daily_task', { p_actor_id: actorId });
  if (error || !data) {
    throw new ApiError(404, 'DAILY_TASK_NOT_AVAILABLE', 'Today’s task is not available.', {
      cause: error,
    });
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
  if (error)
    throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load squad membership.', { cause: error });
  return data?.squad_id ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'create-submission', 10, 60);
    const form = await parseTaskImageForm(request);
    const task = await getDailyTask(context.admin, context.user.id);
    if (form.taskId && form.taskId !== task.taskId) {
      throw new ApiError(409, 'DAILY_TASK_MISMATCH', 'This is not your assigned task.');
    }

    const classification = await analyzePhoto({
      bytes: new Uint8Array(await form.image.arrayBuffer()),
      contentType: form.image.type,
      locale: task.locale || form.locale,
      localeRuleVersion: task.localeRuleVersion,
      task,
      demoFixture: Deno.env.get('MOCK_VLM') === 'true' ? form.demoFixture : undefined,
    });
    const squadId = await getActiveSquadId(context.admin, context.user.id);
    const taskSatisfied = classification.taskSatisfied;
    const confident =
      classification.confidence >= 0.7 && classification.recommendedBin !== 'unknown';
    const rawFailureReason = classification.failureReason;
    const failureReason =
      rawFailureReason ??
      (!taskSatisfied
        ? 'recycling_context_missing'
        : !confident ||
            classification.promptSimilarity < 0.75 ||
            classification.taskConfidence < 0.75
          ? 'low_confidence'
          : null);
    const matchesTask =
      !failureReason &&
      taskSatisfied &&
      confident &&
      classification.promptSimilarity >= 0.75 &&
      classification.taskConfidence >= 0.75;
    const modelResult = {
      ...classification,
      taskPrompt: task.prompt,
      localeRuleVersion: task.localeRuleVersion,
      promptSimilarity: classification.promptSimilarity,
      taskSatisfied,
      matchesTask,
      failureReason,
      failure_reason: failureReason,
    };
    const { data, error } = await context.admin.rpc('record_pending_task_submission', {
      p_actor_id: context.user.id,
      p_task_id: task.taskId,
      p_task_day: task.taskDay,
      p_idempotency_key: form.idempotencyKey,
      p_model_result: modelResult,
      p_matches_task: matchesTask,
      p_confidence: classification.confidence,
      p_prompt_similarity: classification.promptSimilarity,
      p_validation_reason: classification.taskReason ?? classification.explanation,
      p_item_name: classification.itemName,
      p_material: classification.material,
      p_recommended_bin: classification.recommendedBin,
      p_squad_id: squadId,
    });
    if (error || !data) {
      const code = error?.message?.match(
        /(DAILY_TASK_MISMATCH|DAILY_TASK_EXPIRED|DAILY_TASK_ALREADY_SUBMITTED|ACTION_CHECK_IN_PENDING|SQUAD_MEMBERSHIP_REQUIRED|INVALID_BIN|INVALID_CLASSIFICATION|INVALID_IDEMPOTENCY_KEY)/,
      )?.[1];
      const messages: Record<string, string> = {
        DAILY_TASK_MISMATCH: 'This is not your assigned task.',
        DAILY_TASK_EXPIRED: 'Today’s task has expired. Refresh to load the current task.',
        DAILY_TASK_ALREADY_SUBMITTED: 'Today’s task is already complete.',
        ACTION_CHECK_IN_PENDING: 'Finish your recycling check-in before trying another photo.',
        SQUAD_MEMBERSHIP_REQUIRED: 'You are no longer in that crew.',
        INVALID_BIN: 'The photo analysis returned an invalid disposal result.',
        INVALID_CLASSIFICATION: 'The photo analysis returned an invalid result.',
        INVALID_IDEMPOTENCY_KEY: 'A valid submission key is required.',
      };
      const status =
        code === 'SQUAD_MEMBERSHIP_REQUIRED'
          ? 403
          : code === 'INVALID_IDEMPOTENCY_KEY' ||
              code === 'INVALID_CLASSIFICATION' ||
              code === 'INVALID_BIN'
            ? 400
            : 409;
      throw new ApiError(
        status,
        code ?? 'SUBMISSION_FAILED',
        (code && messages[code]) || 'Unable to save this task attempt.',
        { cause: error },
      );
    }
    return jsonResponse({ ...data, task, classification: modelResult, failureReason });
  } catch (error) {
    return errorResponse(error);
  }
});
