import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext } from '../_shared/supabase.ts';
import { requireObject, requireString, requireUuid } from '../_shared/validation.ts';

type AdminClient = Awaited<ReturnType<typeof createRequestContext>>['admin'];

async function activeSquadId(admin: AdminClient, actorId: string): Promise<string | null> {
  const { data, error } = await admin.from('squad_members').select('squad_id').eq('profile_id', actorId).eq('status', 'active').maybeSingle();
  if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load your crew.', { cause: error });
  return data?.squad_id ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    const body = requireObject(await request.json());
    const action = requireString(body, 'action', 3, 20);
    if (action === 'queue' || action === 'cancel') {
      const squadId = requireUuid(body, 'squadId');
      const rpcName = action === 'queue' ? 'queue_squad_for_league' : 'cancel_squad_league_queue';
      const { data, error } = await context.admin.rpc(rpcName, {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
      });
      if (error) {
        const code = error.message.match(/(SQUAD_OWNER_REQUIRED|LEAGUE_MINIMUM_MEMBERS|ALREADY_IN_LEAGUE)/)?.[1];
        throw new ApiError(code === 'SQUAD_OWNER_REQUIRED' ? 403 : 409, code ?? 'LEAGUE_UPDATE_FAILED', code?.toLowerCase().replaceAll('_', ' ') ?? 'Unable to update league queue.', { cause: error });
      }
      return jsonResponse(action === 'queue' ? data : { squadId, status: 'cancelled' });
    }

    if (action === 'leaderboard') {
      const squadId = requireUuid(body, 'squadId');
      const { data, error } = await context.admin.rpc('get_crew_member_leaderboard', {
        p_actor_id: context.user.id,
        p_squad_id: squadId,
      });
      if (error) throw new ApiError(403, 'LEADERBOARD_UNAVAILABLE', 'Unable to load the crew leaderboard.', { cause: error });
      return jsonResponse({ rows: data ?? [] });
    }

    const squadId = await activeSquadId(context.admin, context.user.id);
    if (action === 'contacts') {
      const { data, error } = await context.admin.rpc('get_contact_leaderboard', { p_actor_id: context.user.id });
      if (error) throw new ApiError(500, 'LEADERBOARD_UNAVAILABLE', 'Unable to load the contact leaderboard.', { cause: error });
      return jsonResponse({ rows: data ?? [] });
    }
    if (action === 'list') {
      const { data, error } = await context.admin
        .from('leagues')
        .select('id, name, starts_at, ends_at, status, max_squads, league_entries(squad_id, score, final_rank, streak_days, streak_multiplier, squads(name))')
        .in('status', ['active', 'scheduled', 'closed'])
        .order('starts_at', { ascending: false });
      if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load leagues.', { cause: error });
      return jsonResponse({ leagues: data ?? [] });
    }
    if (action === 'current') {
      if (!squadId) return jsonResponse({ squadId: null, queue: null, league: null });
      const [
        { data: queue },
        { data: entry },
        { data: progression },
        { data: crewStreak },
        { data: squadStreak },
      ] = await Promise.all([
        context.admin.from('league_queue').select('*').eq('squad_id', squadId).eq('status', 'queued').maybeSingle(),
        context.admin.from('league_entries').select('league_id, score, final_rank, streak_days, streak_multiplier, leagues(*)').eq('squad_id', squadId).order('league_id', { ascending: false }).limit(1).maybeSingle(),
        context.admin.from('crew_progression').select('*').eq('squad_id', squadId).maybeSingle(),
        context.admin.from('crew_daily_streaks').select('streak_day, total_members, completed_members, required_members, qualified').eq('squad_id', squadId).order('streak_day', { ascending: false }).limit(1).maybeSingle(),
        context.admin.from('squad_streaks').select('current_streak, repair_tokens, last_completed_day').eq('squad_id', squadId).maybeSingle(),
      ]);
      return jsonResponse({ squadId, queue, league: entry, progression, crewStreak, squadStreak });
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported league action.');
  } catch (error) {
    return errorResponse(error);
  }
});
