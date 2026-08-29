import { createClient } from 'npm:@supabase/supabase-js@2.97.0';
import { errorResponse, jsonResponse } from '../_shared/errors.ts';

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);
    const expectedSecret = requireEnvironment('CRON_SECRET');
    if (request.headers.get('x-cron-secret') !== expectedSecret) return jsonResponse({ code: 'UNAUTHENTICATED' }, 401);
    const admin = createClient(requireEnvironment('SUPABASE_URL'), requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: matched, error: matchError } = await admin.rpc('run_league_matchmaking');
    if (matchError) throw matchError;
    const { data: ended, error: endedError } = await admin.from('leagues').select('id').eq('status', 'active').lte('ends_at', new Date().toISOString());
    if (endedError) throw endedError;
    const finalized = [];
    for (const league of ended ?? []) {
      const { data, error } = await admin.rpc('finalize_league', { p_league_id: league.id });
      if (error) throw error;
      finalized.push(data);
    }
    return jsonResponse({ matched, finalized: finalized.length });
  } catch (error) {
    return errorResponse(error);
  }
});
