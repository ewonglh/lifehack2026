import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }, 401);

  const { crewId, memberId } = await request.json();
  if (typeof crewId !== 'string' || typeof memberId !== 'string') {
    return json({ code: 'INVALID_REQUEST', message: 'Crew ID and member ID are required.' }, 400);
  }

  const result = await supabase.rpc('kick_crew_member', {
    target_crew: crewId,
    target_member: memberId,
  });
  if (result.error) return json({ code: 'FORBIDDEN', message: 'Only the crew leader can remove members.' }, 403);

  return json({ crewId, memberId, removed: true });
});
