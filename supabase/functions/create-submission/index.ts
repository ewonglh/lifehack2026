import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ code: 'UNAUTHENTICATED', message: 'Please sign in again.' }, 401);

  let input: { idempotencyKey?: string; locale?: string; crewId?: string };
  try { input = await request.json(); } catch { return json({ code: 'INTERNAL_ERROR', message: 'Invalid request.' }, 400); }
  if (!input.idempotencyKey || !input.locale) return json({ code: 'INVALID_IMAGE', message: 'A locale and request key are required.' }, 400);

  const existing = await supabase.from('submissions').select('id,status').eq('idempotency_key', input.idempotencyKey).maybeSingle();
  if (existing.data) return json({ submissionId: existing.data.id, status: existing.data.status, duplicate: true });

  const quota = await supabase.rpc('reserve_daily_quota', { player: user.id });
  if (quota.error) return json({ code: 'INTERNAL_ERROR', message: 'Could not reserve your daily quota.' }, 500);
  if (!quota.data) return json({ code: 'RATE_LIMITED', message: 'You have reached today’s scan limit.' }, 429);

  const imagePath = `${user.id}/${crypto.randomUUID()}`;
  const submission = await supabase.from('submissions').insert({
    profile_id: user.id,
    crew_id: input.crewId ?? null,
    image_path: imagePath,
    status: 'awaiting_upload',
    idempotency_key: input.idempotencyKey,
    locale: input.locale,
  }).select('id').single();
  if (submission.error) return json({ code: 'INTERNAL_ERROR', message: 'Could not create submission.' }, 500);

  const upload = await supabase.storage.from('item-images').createSignedUploadUrl(imagePath);
  if (upload.error) return json({ code: 'INTERNAL_ERROR', message: 'Could not prepare image upload.' }, 500);

  return json({
    submissionId: submission.data.id,
    status: 'awaiting_upload',
    signedUpload: { path: imagePath, token: upload.data.token, expiresIn: 3600 },
    remainingDailyQuota: 4,
  });
});
