import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import {
  optionalNullableBoolean,
  optionalNullableNumber,
  requireBin,
  requireBoolean,
  requireObject,
  requireString,
  requireUuid,
} from '../_shared/validation.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'manage-mission', 30, 60);
    const body = requireObject(await request.json().catch(() => null));
    const action = requireString(body, 'action', 3, 30);
    if (action === 'getMeasurement') {
      const { data, error } = await context.admin.rpc('get_measurement_summary', {
        p_actor_id: context.user.id,
      });
      if (error || !data)
        throw new ApiError(500, 'MEASUREMENT_UNAVAILABLE', 'Measurement data is unavailable.', {
          cause: error,
        });
      return jsonResponse({ summary: data });
    }
    if (action === 'recordMeasurement') {
      const phase = requireString(body, 'phase', 1, 30);
      if (!['baseline', 'follow_up'].includes(phase)) {
        throw new ApiError(400, 'INVALID_REQUEST', 'phase is invalid.');
      }
      const scenarioId = requireString(body, 'scenarioId', 1, 80);
      const selectedBin =
        body.selectedBin === undefined || body.selectedBin === null
          ? null
          : requireBin(body, 'selectedBin');
      const { data, error } = await context.admin.rpc('record_measurement_check', {
        p_actor_id: context.user.id,
        p_phase: phase,
        p_scenario_id: scenarioId,
        p_selected_bin: selectedBin,
        p_prep_confirmed: optionalNullableBoolean(body, 'prepConfirmed'),
        p_validated: requireBoolean(body, 'validated'),
        p_prompt_similarity: optionalNullableNumber(body, 'promptSimilarity'),
        p_self_reported:
          body.actionConfirmed === undefined
            ? (optionalNullableBoolean(body, 'selfReported') ?? false)
            : requireBoolean(body, 'actionConfirmed'),
      });
      if (error || !data)
        throw new ApiError(400, 'MEASUREMENT_SAVE_FAILED', 'We could not save that check.', {
          cause: error,
        });
      return jsonResponse({ check: data });
    }
    if (action === 'getCrew') {
      let squadId =
        body.squadId === undefined || body.squadId === null
          ? undefined
          : requireUuid(body, 'squadId');
      if (!squadId) {
        const { data: membership, error: membershipError } = await context.admin
          .from('squad_members')
          .select('squad_id')
          .eq('profile_id', context.user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (membershipError)
          throw new ApiError(500, 'CREW_UNAVAILABLE', 'Crew data is unavailable.', {
            cause: membershipError,
          });
        squadId = membership?.squad_id;
      }
      if (!squadId) return jsonResponse({ mission: null });
      const { data, error } = await context.admin.rpc('get_squad_daily_mission_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
      });
      if (error || !data) {
        const code = error?.message?.match(
          /(MISSION_UNAVAILABLE|SQUAD_MEMBERSHIP_REQUIRED|SQUAD_NOT_FOUND)/,
        )?.[1];
        const status =
          code === 'SQUAD_MEMBERSHIP_REQUIRED' ? 403 : code === 'SQUAD_NOT_FOUND' ? 404 : 503;
        throw new ApiError(
          status,
          code ?? 'MISSION_UNAVAILABLE',
          code === 'SQUAD_MEMBERSHIP_REQUIRED'
            ? 'You are not an active member of this crew.'
            : 'The crew mission is unavailable.',
          { cause: error },
        );
      }
      const { data: catalog, error: catalogError } = await context.admin
        .from('mission_catalog')
        .select('id, title, theme, target')
        .eq('id', data.mission_id)
        .maybeSingle();
      if (catalogError || !catalog) {
        throw new ApiError(503, 'MISSION_UNAVAILABLE', 'The crew mission is unavailable.', {
          cause: catalogError,
        });
      }
      return jsonResponse({
        mission: {
          ...data,
          title: catalog.title,
          theme: catalog.theme,
          target: catalog.target,
        },
      });
    }
    if (action !== 'getDaily')
      throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported task action.');
    const { data, error } = await context.admin.rpc('get_or_assign_daily_task', {
      p_actor_id: context.user.id,
    });
    if (error || !data)
      throw new ApiError(404, 'DAILY_TASK_NOT_AVAILABLE', 'Today’s task is not available.', {
        cause: error,
      });
    return jsonResponse({ task: data });
  } catch (error) {
    return errorResponse(error);
  }
});
