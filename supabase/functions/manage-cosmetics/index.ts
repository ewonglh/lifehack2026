import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext } from '../_shared/supabase.ts';
import { requireObject, requireString } from '../_shared/validation.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    const body = requireObject(await request.json());
    const action = requireString(body, 'action', 3, 20);
    const { data: membership, error: membershipError } = await context.admin
      .from('squad_members')
      .select('squad_id')
      .eq('profile_id', context.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load crew cosmetics.', { cause: membershipError });
    if (!membership) return jsonResponse({ cosmetics: [], squadId: null });

    if (action === 'list') {
      const { data, error } = await context.admin
        .from('crew_cosmetics')
        .select('cosmetic_id, unlocked_at, cosmetic_catalog(kind, name, unlock_xp)')
        .eq('squad_id', membership.squad_id)
        .order('unlocked_at');
      if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load crew cosmetics.', { cause: error });
      const { data: equipped, error: equippedError } = await context.admin
        .from('crew_cosmetic_equipment')
        .select('cosmetic_id')
        .eq('squad_id', membership.squad_id)
        .eq('profile_id', context.user.id);
      if (equippedError) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load equipped cosmetics.', { cause: equippedError });
      const equippedIds = new Set((equipped ?? []).map((item) => item.cosmetic_id));
      return jsonResponse({
        squadId: membership.squad_id,
        cosmetics: (data ?? []).map((item) => ({ ...item, equipped: equippedIds.has(item.cosmetic_id) })),
      });
    }
    if (action === 'equip') {
      const { error } = await context.admin.rpc('equip_crew_cosmetic_for_actor', {
        p_actor_id: context.user.id,
        p_cosmetic_id: requireString(body, 'cosmeticId', 2, 80),
      });
      if (error) throw new ApiError(400, 'COSMETIC_NOT_OWNED', 'That cosmetic is not available to you.', { cause: error });
      return jsonResponse({ squadId: membership.squad_id, equipped: body.cosmeticId });
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported cosmetics action.');
  } catch (error) {
    return errorResponse(error);
  }
});
