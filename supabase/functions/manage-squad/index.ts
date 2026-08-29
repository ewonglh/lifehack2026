import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import {
  optionalString,
  requireInteger,
  requireObject,
  requireString,
  requireUuid,
  sha256Hex,
} from '../_shared/validation.ts';

function inviteCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => letters[byte % letters.length]).join('');
}

function knownError(error: { message: string }): ApiError {
  const code = error.message.match(
    /(ALREADY_IN_SQUAD|SQUAD_FULL|INVALID_INVITE|SQUAD_OWNER_REQUIRED|SQUAD_MEMBERSHIP_REQUIRED|MEMBER_NOT_FOUND|OWNER_TRANSFER_REQUIRED|INVALID_TIMEZONE|INVALID_SQUAD_NAME)/,
  )?.[1];
  const statuses: Record<string, number> = {
    ALREADY_IN_SQUAD: 409,
    SQUAD_FULL: 409,
    INVALID_INVITE: 400,
    SQUAD_OWNER_REQUIRED: 403,
    SQUAD_MEMBERSHIP_REQUIRED: 403,
    MEMBER_NOT_FOUND: 404,
    OWNER_TRANSFER_REQUIRED: 409,
  };
  return new ApiError(
    code ? (statuses[code] ?? 400) : 500,
    code ?? 'INTERNAL_ERROR',
    code?.toLowerCase().replaceAll('_', ' ') ?? 'Unable to update the squad.',
    { cause: error },
  );
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'manage-squad', 20, 60);
    const body = requireObject(await request.json());
    const action = requireString(body, 'action', 2, 30);
    if (action === 'create') {
      const { data, error } = await context.admin.rpc('create_squad_for_actor', {
        p_actor_id: context.user.id,
        p_name: requireString(body, 'name', 2, 60),
        p_timezone: optionalString(body, 'timezone', 80) ?? 'Asia/Singapore',
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId: data }, 201);
    }
    if (action === 'createInvite') {
      const code = inviteCode();
      const expiresInHours =
        body.expiresInHours === undefined ? 72 : requireInteger(body, 'expiresInHours', 1, 720);
      const { data, error } = await context.admin.rpc('create_squad_invite_code_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: requireUuid(body, 'squadId'),
        p_code_hash: await sha256Hex(code),
        p_expires_at: new Date(Date.now() + expiresInHours * 3_600_000).toISOString(),
        p_max_uses: body.maxUses === undefined ? 1 : requireInteger(body, 'maxUses', 1, 8),
      });
      if (error) throw knownError(error);
      return jsonResponse({ inviteId: data, inviteCode: code }, 201);
    }
    if (action === 'join') {
      const { data, error } = await context.admin.rpc('join_squad_for_actor', {
        p_actor_id: context.user.id,
        p_token_hash: await sha256Hex(requireString(body, 'inviteCode', 6, 6).toUpperCase()),
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId: data });
    }
    const squadId = requireUuid(body, 'squadId');
    if (action === 'configure') {
      const { error } = await context.admin.rpc('configure_squad_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
        p_join_enabled: Boolean(body.joinEnabled),
        p_min_daily_members: requireInteger(body, 'minDailyMembers', 1, 8),
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId });
    }
    if (action === 'removeMember') {
      const { error } = await context.admin.rpc('remove_squad_member_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
        p_profile_id: requireUuid(body, 'profileId'),
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId });
    }
    if (action === 'leave') {
      const { error } = await context.admin.rpc('leave_squad_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId });
    }
    if (action === 'transferOwnership') {
      const { error } = await context.admin.rpc('transfer_squad_ownership_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
        p_new_owner_id: requireUuid(body, 'newOwnerId'),
      });
      if (error) throw knownError(error);
      return jsonResponse({ squadId });
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'The requested squad action is not supported.');
  } catch (error) {
    return errorResponse(error);
  }
});
