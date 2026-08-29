import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createInviteToken, hashInviteToken } from '../_shared/invite.ts';

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }), { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }), { status: 401 });

  const { crewId } = await request.json();
  const token = createInviteToken();
  const tokenHash = await hashInviteToken(token);
  const result = await supabase.rpc('create_crew_invite', {
    target_crew: crewId,
    token_digest: tokenHash,
  });

  if (result.error) {
    const code = result.error.message.includes('CREW_FULL') ? 'CREW_FULL' : 'FORBIDDEN';
    return new Response(JSON.stringify({ code, message: code === 'CREW_FULL' ? 'This crew is full.' : 'You cannot invite members to this crew.' }), { status: 403 });
  }

  return new Response(JSON.stringify({
    inviteId: result.data.id,
    token,
    expiresAt: result.data.expires_at,
  }), { headers: { 'Content-Type': 'application/json' } });
});
