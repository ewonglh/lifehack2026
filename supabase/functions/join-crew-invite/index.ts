import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashInviteToken } from '../_shared/invite.ts';

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

  const { token } = await request.json();
  if (typeof token !== 'string' || token.length < 20) {
    return new Response(JSON.stringify({ code: 'INVITE_INVALID', message: 'This invite link is invalid or expired.' }), { status: 400 });
  }

  const result = await supabase.rpc('join_crew_with_invite', {
    token_digest: await hashInviteToken(token),
  });

  if (result.error) {
    const code = result.error.message.includes('CREW_FULL') ? 'CREW_FULL' : 'INVITE_INVALID';
    return new Response(JSON.stringify({ code, message: code === 'CREW_FULL' ? 'This crew is full.' : 'This invite link is invalid or expired.' }), { status: 400 });
  }

  return new Response(JSON.stringify({ crewId: result.data, joined: true }), { headers: { 'Content-Type': 'application/json' } });
});
