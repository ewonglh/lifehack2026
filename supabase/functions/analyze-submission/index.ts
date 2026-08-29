import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeImage } from '../_shared/openai-analyzer.ts';
import {
  corsHeaders,
  apiError,
} from '../_shared/errors.ts';
import {
  isDisposalBin,
  validateAnalysisInput,
} from '../_shared/validation.ts';

const CONFIDENCE_THRESHOLD = 0.7;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return apiError('UNAUTHENTICATED', 'Please sign in again.', 401, undefined, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return apiError('UNAUTHENTICATED', 'Please sign in again.', 401, undefined, corsHeaders);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return apiError('INTERNAL_ERROR', 'Invalid request.', 400, undefined, corsHeaders);
  }

  const validationError = validateAnalysisInput(input);
  if (validationError) {
    return apiError('INVALID_IMAGE', validationError, 400, undefined, corsHeaders);
  }

  const submission = await supabase
    .from('submissions')
    .select('*')
    .eq('id', input.submissionId)
    .eq('profile_id', user.id)
    .single();

  if (submission.error) {
    return apiError('FORBIDDEN', 'Submission unavailable.', 403, undefined, corsHeaders);
  }

  const signedImage = await supabase.storage
    .from('item-images')
    .createSignedUrl(submission.data.image_path, 300);

  if (signedImage.error || !signedImage.data?.signedUrl) {
    return apiError('INVALID_IMAGE', 'The image could not be read.', 400, undefined, corsHeaders);
  }

  let classification;
  try {
    classification = await analyzeImage(
      signedImage.data.signedUrl,
      submission.data.locale,
    );
  } catch {
    await supabase
      .from('submissions')
      .update({ status: 'failed', rejection_reason: 'Model unavailable' })
      .eq('id', submission.data.id);

    return apiError(
      'MODEL_UNAVAILABLE',
      'Guidance is temporarily unavailable. Try again.',
      503,
      undefined,
      corsHeaders,
    );
  }

  const selectedBin = input.userSelectedBin;
  const isConfirmed = isDisposalBin(selectedBin)
    && selectedBin !== 'unknown'
    && classification.recommendedBin === selectedBin
    && classification.confidence >= CONFIDENCE_THRESHOLD;
  const outcome = isConfirmed ? 'confirmed' : 'needs_confirmation';
  const points = isConfirmed ? 10 : 0;

  const update = await supabase
    .from('submissions')
    .update({
      status: isConfirmed ? 'approved' : 'pending',
      model_result: classification,
      user_bin: selectedBin,
      final_bin: isConfirmed ? selectedBin : null,
      confidence: classification.confidence,
      score: points,
      analyzed_at: new Date().toISOString(),
    })
    .eq('id', submission.data.id);

  if (update.error) {
    return apiError('INTERNAL_ERROR', 'Could not save the analysis.', 500, undefined, corsHeaders);
  }

  if (points > 0) {
    await supabase.from('score_events').insert({
      profile_id: user.id,
      crew_id: submission.data.crew_id,
      submission_id: submission.data.id,
      action_type: 'correct_sort',
      points,
      rule_version: '2026-08-01',
    });
  }

  return jsonResponse({
    submissionId: submission.data.id,
    classification,
    outcome,
    awarded: points > 0 ? [{ actionType: 'correct_sort', points }] : [],
    score: points,
    rejectionReason: null,
  });
});
