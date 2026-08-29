import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.97.0';
import { analyzePhoto } from '../_shared/photo-analyzer.ts';
import { dateInTimezone, downloadOwnedImage } from '../_shared/image.ts';
import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import {
  optionalBoolean,
  optionalString,
  requireBin,
  requireObject,
  requireString,
  requireUuid,
} from '../_shared/validation.ts';

type Challenge = {
  id: string;
  locale_rule_version: string;
};

async function resolveChallenge(
  admin: SupabaseClient,
  challengeId: string | undefined,
  locale: string,
  timezone: string,
): Promise<Challenge> {
  let query = admin.from('daily_challenges').select('id, locale_rule_version').eq('active', true);

  query = challengeId
    ? query.eq('id', challengeId)
    : query.eq('locale', locale).eq('challenge_day', dateInTimezone(timezone));

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new ApiError(404, 'DAILY_CHALLENGE_NOT_FOUND', 'Today’s challenge is not available.', {
      cause: error,
    });
  }
  return data as Challenge;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Send a valid JSON request body.', {
        cause: error,
      });
    }
    const body = requireObject(rawBody);
    const squadId = requireUuid(body, 'squadId');
    const challengeId = optionalString(body, 'challengeId', 36);
    const idempotencyKey = requireString(body, 'idempotencyKey', 8, 128);
    const imagePath = requireString(body, 'imageStoragePath', 3, 500);
    const userSelectedBin = requireBin(body, 'userSelectedBin');
    const preparationConfirmed = optionalBoolean(body, 'preparationConfirmed');
    const locale = optionalString(body, 'locale', 30) ?? 'en-SG';

    const { data: existing, error: existingError } = await context.admin
      .from('submissions')
      .select('result_payload')
      .eq('profile_id', context.user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existingError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to validate this submission.', {
        cause: existingError,
      });
    }
    if (existing?.result_payload) {
      return jsonResponse({ ...existing.result_payload, duplicate: true });
    }
    await enforceRateLimit(context.admin, context.user.id, 'create-submission', 10, 60);

    const { data: squad, error: squadError } = await context.admin
      .from('squads')
      .select('timezone, squad_members!inner(profile_id, status)')
      .eq('id', squadId)
      .eq('squad_members.profile_id', context.user.id)
      .eq('squad_members.status', 'active')
      .maybeSingle();
    if (squadError || !squad) {
      throw new ApiError(403, 'FORBIDDEN', 'You must be an active member of this squad.', {
        cause: squadError,
      });
    }

    const challenge = await resolveChallenge(context.admin, challengeId, locale, squad.timezone);
    const image = await downloadOwnedImage(context.userClient, context.user.id, imagePath);
    const classification = await analyzePhoto({
      ...image,
      imagePath,
      locale,
      localeRuleVersion: challenge.locale_rule_version,
    });

    const { data, error } = await context.admin.rpc('record_verified_sort', {
      p_actor_id: context.user.id,
      p_squad_id: squadId,
      p_challenge_id: challenge.id,
      p_idempotency_key: idempotencyKey,
      p_image_path: imagePath,
      p_user_bin: userSelectedBin,
      p_classification: classification,
      p_preparation_confirmed: preparationConfirmed,
    });
    if (error) {
      const knownCode = error.message.match(
        /(SQUAD_MEMBERSHIP_REQUIRED|DAILY_CHALLENGE_NOT_FOUND|DAILY_CHALLENGE_EXPIRED|INVALID_CLASSIFICATION)/,
      )?.[1];
      throw new ApiError(
        knownCode ? 409 : 500,
        knownCode ?? 'INTERNAL_ERROR',
        knownCode
          ? 'The submission can no longer be completed.'
          : 'Unable to save this submission.',
        { cause: error },
      );
    }

    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
});
