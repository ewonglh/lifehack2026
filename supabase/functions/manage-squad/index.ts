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

function randomInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function mapRpcError(error: { message: string }): ApiError {
  const code = error.message.match(
    /(PROFILE_NOT_FOUND|INVALID_SQUAD_NAME|INVALID_TIMEZONE|ALREADY_IN_SQUAD|SQUAD_OWNER_REQUIRED|INVITE_INVALID_OR_EXPIRED|SQUAD_FULL|CONTEST_NOT_OPEN)/,
  )?.[1];
  return new ApiError(
    code ? 409 : 500,
    code ?? 'INTERNAL_ERROR',
    code ? code.toLowerCase().replaceAll('_', ' ') : 'Unable to update the squad.',
    { cause: error },
  );
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'manage-squad', 20, 60);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Send a valid JSON request body.', {
        cause: error,
      });
    }
    const body = requireObject(rawBody);
    const action = requireString(body, 'action', 2, 30);

    if (action === 'create') {
      const name = requireString(body, 'name', 2, 60);
      const timezone = optionalString(body, 'timezone', 80) ?? 'Asia/Singapore';
      const { data, error } = await context.admin.rpc('create_squad_for_actor', {
        p_actor_id: context.user.id,
        p_name: name,
        p_timezone: timezone,
      });
      if (error) throw mapRpcError(error);
      return jsonResponse({ squadId: data }, 201);
    }

    if (action === 'createInvite') {
      const squadId = requireUuid(body, 'squadId');
      const expiresInHours =
        body.expiresInHours === undefined ? 72 : requireInteger(body, 'expiresInHours', 1, 720);
      const maxUses = body.maxUses === undefined ? 1 : requireInteger(body, 'maxUses', 1, 8);
      const inviteToken = randomInviteToken();
      const tokenHash = await sha256Hex(inviteToken);
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await context.admin.rpc('create_squad_invite_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_max_uses: maxUses,
      });
      if (error) throw mapRpcError(error);
      return jsonResponse({ inviteId: data, inviteToken, expiresAt }, 201);
    }

    if (action === 'join') {
      const inviteToken = requireString(body, 'inviteToken', 20, 200);
      const { data, error } = await context.admin.rpc('join_squad_for_actor', {
        p_actor_id: context.user.id,
        p_token_hash: await sha256Hex(inviteToken),
      });
      if (error) throw mapRpcError(error);
      return jsonResponse({ squadId: data });
    }

    if (action === 'enterContest') {
      const squadId = requireUuid(body, 'squadId');
      const contestId = requireUuid(body, 'contestId');
      const { error } = await context.admin.rpc('enter_contest_for_actor', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
        p_contest_id: contestId,
      });
      if (error) throw mapRpcError(error);
      return jsonResponse({ squadId, contestId });
    }

    throw new ApiError(400, 'INVALID_REQUEST', 'The requested squad action is not supported.');
  } catch (error) {
    return errorResponse(error);
  }
});
