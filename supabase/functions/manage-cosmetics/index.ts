import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import { requireObject, requireString } from '../_shared/validation.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'manage-cosmetics', 30, 60);
    const body = requireObject(await request.json().catch(() => null));
    const action = requireString(body, 'action', 3, 20);
    const { data: membership, error: membershipError } = await context.admin
      .from('squad_members')
      .select('squad_id')
      .eq('profile_id', context.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError)
      throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load crew cosmetics.', {
        cause: membershipError,
      });
    if (action === 'list') {
      const { data: personal, error: personalError } = await context.admin
        .from('profile_inventory')
        .select('cosmetic_id, unlocked_at, equipped, cosmetic_catalog(kind, name, unlock_xp)')
        .eq('profile_id', context.user.id)
        .order('unlocked_at');
      if (personalError)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load personal cosmetics.', {
          cause: personalError,
        });

      const { data: crew, error: crewError } = membership
        ? await context.admin
            .from('crew_cosmetics')
            .select('cosmetic_id, unlocked_at, cosmetic_catalog(kind, name, unlock_xp)')
            .eq('squad_id', membership.squad_id)
            .order('unlocked_at')
        : { data: [], error: null };
      if (crewError)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load crew cosmetics.', {
          cause: crewError,
        });

      const cosmetics = new Map<string, Record<string, unknown>>();
      for (const item of personal ?? []) {
        cosmetics.set(item.cosmetic_id, { ...item, scope: 'personal', scopes: ['personal'] });
      }
      for (const item of crew ?? []) {
        const existing = cosmetics.get(item.cosmetic_id);
        if (existing) {
          existing.scopes = [...(existing.scopes as string[]), 'crew'];
          existing.crewUnlockedAt = item.unlocked_at;
        } else {
          cosmetics.set(item.cosmetic_id, {
            ...item,
            equipped: false,
            scope: 'crew',
            scopes: ['crew'],
          });
        }
      }

      let equippedIds = new Set<string>();
      if (membership) {
        const { data: equipped, error: equippedError } = await context.admin
          .from('crew_cosmetic_equipment')
          .select('cosmetic_id')
          .eq('squad_id', membership.squad_id)
          .eq('profile_id', context.user.id);
        if (equippedError)
          throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load equipped crew cosmetics.', {
            cause: equippedError,
          });
        equippedIds = new Set((equipped ?? []).map((item) => item.cosmetic_id));
      }
      for (const item of cosmetics.values()) {
        const personalEquipped = Boolean(item.equipped);
        const crewEquipped = equippedIds.has(item.cosmetic_id as string);
        if (crewEquipped) item.crewEquipped = true;
        item.equipped = personalEquipped || crewEquipped;
        item.equippedScope = personalEquipped ? 'personal' : crewEquipped ? 'crew' : null;
      }
      const { data: progress, error: progressError } = await context.admin
        .from('profile_progress')
        .select('lifetime_xp')
        .eq('profile_id', context.user.id)
        .maybeSingle();
      if (progressError)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load cosmetic progress.', {
          cause: progressError,
        });
      const lifetimeXp = Number(progress?.lifetime_xp ?? 0);
      const { data: nextUnlock, error: nextUnlockError } = await context.admin
        .from('cosmetic_catalog')
        .select('id, kind, name, unlock_xp')
        .eq('active', true)
        .gt('unlock_xp', lifetimeXp)
        .order('unlock_xp')
        .limit(1)
        .maybeSingle();
      if (nextUnlockError)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load the next cosmetic unlock.', {
          cause: nextUnlockError,
        });
      const personalCosmetics = [...cosmetics.values()].filter((item) => item.scope === 'personal');
      const latestUnlock = personalCosmetics[personalCosmetics.length - 1];
      const latestCatalog = (latestUnlock?.cosmetic_catalog ?? {}) as Record<string, unknown>;
      return jsonResponse({
        squadId: membership?.squad_id ?? null,
        cosmetics: [...cosmetics.values()],
        unlock: latestUnlock
          ? {
              cosmeticId: latestUnlock.cosmetic_id,
              kind: latestCatalog.kind,
              name: latestCatalog.name,
              unlockXp: latestCatalog.unlock_xp,
              unlockedAt: latestUnlock.unlocked_at,
            }
          : null,
        nextUnlock: nextUnlock
          ? {
              cosmeticId: nextUnlock.id,
              kind: nextUnlock.kind,
              name: nextUnlock.name,
              unlockXp: nextUnlock.unlock_xp,
            }
          : null,
      });
    }
    if (action === 'equip') {
      const cosmeticId = requireString(body, 'cosmeticId', 2, 80);
      const { data: personalCosmetic, error: personalError } = await context.admin
        .from('profile_inventory')
        .select('cosmetic_id')
        .eq('profile_id', context.user.id)
        .eq('cosmetic_id', cosmeticId)
        .maybeSingle();
      if (personalError)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load personal cosmetics.', {
          cause: personalError,
        });
      if (personalCosmetic) {
        const { error } = await context.admin.rpc('equip_cosmetic_for_actor', {
          p_actor_id: context.user.id,
          p_cosmetic_id: cosmeticId,
        });
        if (error)
          throw new ApiError(400, 'COSMETIC_NOT_OWNED', 'That cosmetic is not available to you.', {
            cause: error,
          });
        return jsonResponse({
          squadId: membership?.squad_id ?? null,
          equipped: cosmeticId,
          scope: 'personal',
        });
      }
      if (!membership)
        throw new ApiError(403, 'COSMETIC_NOT_OWNED', 'That cosmetic is not available to you.');
      const { error } = await context.admin.rpc('equip_crew_cosmetic_for_actor', {
        p_actor_id: context.user.id,
        p_cosmetic_id: cosmeticId,
      });
      if (error)
        throw new ApiError(400, 'COSMETIC_NOT_OWNED', 'That cosmetic is not available to you.', {
          cause: error,
        });
      return jsonResponse({ squadId: membership.squad_id, equipped: cosmeticId, scope: 'crew' });
    }
    if (action === 'unequip') {
      const cosmeticId = requireString(body, 'cosmeticId', 2, 80);
      const { error } = await context.admin.rpc('unequip_cosmetic_for_actor', {
        p_actor_id: context.user.id,
        p_cosmetic_id: cosmeticId,
      });
      if (error)
        throw new ApiError(400, 'COSMETIC_NOT_OWNED', 'That cosmetic is not available to you.', {
          cause: error,
        });
      return jsonResponse({
        squadId: membership?.squad_id ?? null,
        unequipped: cosmeticId,
        scope: 'all',
      });
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported cosmetics action.');
  } catch (error) {
    return errorResponse(error);
  }
});
