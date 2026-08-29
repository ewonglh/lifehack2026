-- Behaviour-first action flow: photo validation is pending until the user
-- self-reports that the bottle was recycled.

alter table public.task_catalog
  add column if not exists title text,
  add column if not exists instruction text;

alter table public.submissions
  add column if not exists failure_reason text;

insert into public.scoring_rules (version, active, config)
values (
  'mvp-v1',
  true,
  '{"confidenceThreshold":0.70,"actionCompleted":10,"preparation":5,"dailyFirst":10,"dailyActionCap":3,"dailyPointsCap":75}'::jsonb
)
on conflict (version) do nothing;

update public.task_catalog
set
  title = 'Clean Bottle Check',
  instruction = 'Empty a single-use plastic bottle, take a photo of it ready for recycling, then place it in recycling.',
  prompt = 'The image shows a single use plastic bottle without any liquid inside with recycling context.'
where id = 'recycle-plastic-bottle';

update public.task_catalog
set active = (id = 'recycle-plastic-bottle')
where locale = 'en-SG';

alter table public.submissions
  add column if not exists behavior_status text not null default 'not_applicable',
  add column if not exists behavior_confirmed_at timestamptz;

update public.submissions
set failure_reason = 'recycling_context_missing'
where failure_reason = 'wrong_bin';

alter table public.submissions
  drop constraint if exists submissions_verification_status_check;

alter table public.submissions
  add constraint submissions_verification_status_check check (
    verification_status in ('verified', 'pending_action', 'low_confidence', 'manual', 'failed')
  );

alter table public.submissions
  drop constraint if exists submissions_failure_reason_check;

alter table public.submissions
  add constraint submissions_failure_reason_check check (
    failure_reason is null or failure_reason in (
      'liquid_present',
      'unrelated_item',
      'recycling_context_missing',
      'low_confidence',
      'upload_failure',
      'ai_failure'
    )
  );

alter table public.submissions
  drop constraint if exists submissions_behavior_status_check;

alter table public.submissions
  add constraint submissions_behavior_status_check check (
    behavior_status in ('not_applicable', 'pending', 'confirmed')
    and (behavior_status <> 'confirmed' or behavior_confirmed_at is not null)
  );

create index if not exists submissions_profile_task_behavior_idx
  on public.submissions (profile_id, task_day, behavior_status, submitted_at desc);

alter table public.score_events
  drop constraint if exists score_events_action_type_check;

alter table public.score_events
  add constraint score_events_action_type_check check (
    action_type in (
      'correct_sort',
      'action_completed',
      'prep_step',
      'daily_first',
      'mission',
      'streak_bonus',
      'participation'
    )
  );

create or replace function private.derive_submission_failure_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.verification_status in ('verified', 'pending_action') then
    new.failure_reason := null;
    return new;
  end if;

  v_reason := coalesce(
    new.model_result ->> 'failureReason',
    new.model_result ->> 'failure_reason'
  );
  if v_reason = 'wrong_bin' then v_reason := 'recycling_context_missing'; end if;

  if v_reason in ('liquid_present', 'unrelated_item', 'recycling_context_missing', 'low_confidence', 'upload_failure', 'ai_failure') then
    new.failure_reason := v_reason;
  elsif new.verification_status = 'low_confidence' then
    new.failure_reason := 'low_confidence';
  else
    new.failure_reason := 'recycling_context_missing';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_failure_reason on public.submissions;
create trigger submissions_failure_reason
before insert or update of verification_status, model_result, user_bin, final_bin
on public.submissions
for each row execute function private.derive_submission_failure_reason();

create or replace function public.record_pending_task_submission(
  p_actor_id uuid,
  p_task_id text,
  p_task_day date,
  p_idempotency_key text,
  p_model_result jsonb,
  p_matches_task boolean,
  p_confidence numeric,
  p_validation_reason text,
  p_item_name text,
  p_material text,
  p_recommended_bin text,
  p_squad_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment public.user_daily_tasks;
  v_submission public.submissions;
  v_rule jsonb := '{"confidenceThreshold":0.70,"dailyPointsCap":75}'::jsonb;
  v_threshold numeric := 0.70;
  v_task_valid boolean;
  v_failure_reason text;
  v_status text;
  v_behavior_status text;
  v_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;
  if p_recommended_bin not in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown') then
    raise exception 'INVALID_CLASSIFICATION' using errcode = '22023';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'INVALID_CLASSIFICATION' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key, 0)
  );

  select * into v_submission
  from public.submissions
  where profile_id = p_actor_id and idempotency_key = p_idempotency_key;
  if found then
    return coalesce(v_submission.result_payload, jsonb_build_object('submissionId', v_submission.id))
      || jsonb_build_object('duplicate', true);
  end if;

  select * into v_assignment
  from public.user_daily_tasks
  where profile_id = p_actor_id and task_day = p_task_day and task_id = p_task_id
  for update;
  if not found then raise exception 'DAILY_TASK_MISMATCH' using errcode = 'P0001'; end if;
  if p_task_day <> private.profile_local_day(p_actor_id) then
    raise exception 'DAILY_TASK_EXPIRED' using errcode = 'P0001';
  end if;

  if p_squad_id is not null and not exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id and profile_id = p_actor_id and status = 'active'
  ) then
    raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.submissions
    where profile_id = p_actor_id and task_day = p_task_day and verification_status = 'verified'
  ) then
    raise exception 'DAILY_TASK_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.submissions
    where profile_id = p_actor_id and task_day = p_task_day and behavior_status = 'pending'
  ) then
    raise exception 'ACTION_CHECK_IN_PENDING' using errcode = 'P0001';
  end if;

  select config into v_rule from public.scoring_rules where active limit 1;
  v_threshold := coalesce((v_rule ->> 'confidenceThreshold')::numeric, 0.70);
  v_task_valid := coalesce(p_matches_task, false)
    and p_confidence >= v_threshold
    and p_recommended_bin <> 'unknown';

  v_failure_reason := coalesce(p_model_result ->> 'failureReason', p_model_result ->> 'failure_reason');
  if v_failure_reason = 'wrong_bin' then v_failure_reason := 'recycling_context_missing'; end if;
  if v_failure_reason not in ('liquid_present', 'unrelated_item', 'recycling_context_missing', 'low_confidence', 'upload_failure', 'ai_failure') then
    v_failure_reason := null;
  end if;
  if v_failure_reason is null and not v_task_valid then
    v_failure_reason := case when not coalesce(p_matches_task, false) then 'recycling_context_missing' else 'low_confidence' end;
  end if;

  v_status := case
    when v_task_valid and v_failure_reason is null then 'pending_action'
    when v_failure_reason in ('liquid_present', 'unrelated_item', 'recycling_context_missing') then 'failed'
    else 'low_confidence'
  end;
  v_behavior_status := case when v_status = 'pending_action' then 'pending' else 'not_applicable' end;

  insert into public.submissions (
    profile_id, squad_id, challenge_id, image_path, task_id, task_day, model_result,
    user_bin, final_bin, confidence, verification_status, behavior_status, points,
    result_payload, idempotency_key, matches_task, validation_reason, league_id, submitted_at
  ) values (
    p_actor_id, p_squad_id, null, null, p_task_id, p_task_day, coalesce(p_model_result, '{}'::jsonb),
    p_recommended_bin, p_recommended_bin, p_confidence, v_status, v_behavior_status, 0,
    null, p_idempotency_key, coalesce(p_matches_task, false), p_validation_reason, null, now()
  ) returning * into v_submission;

  v_result := jsonb_build_object(
    'submissionId', v_submission.id,
    'scanEventId', v_submission.id,
    'taskId', p_task_id,
    'taskDay', p_task_day,
    'classification', coalesce(p_model_result, '{}'::jsonb),
    'outcome', case when v_status = 'pending_action' then 'awaiting_check_in' when v_status = 'low_confidence' then 'unknown' else 'failed' end,
    'validated', false,
    'photoValidated', v_status = 'pending_action',
    'failureReason', case when v_status = 'pending_action' then null else v_failure_reason end,
    'behaviorCheckIn', case when v_status = 'pending_action' then jsonb_build_object(
      'action', 'recycle_bottle', 'status', 'pending', 'selfReported', false, 'confirmedAt', null
    ) else null end,
    'awarded', '[]'::jsonb,
    'points', jsonb_build_object('actionCompletion', 0, 'preparation', 0, 'dailyBonus', 0, 'total', 0),
    'dailyPointsRemaining', coalesce((v_rule ->> 'dailyPointsCap')::integer, 75),
    'validationReason', p_validation_reason,
    'itemName', p_item_name,
    'material', p_material,
    'recommendedBin', p_recommended_bin,
    'post', null,
    'crewUpdate', null,
    'duplicate', false
  );
  update public.submissions set result_payload = v_result where id = v_submission.id;
  return v_result;
end;
$$;

create or replace function public.confirm_recycling_action(
  p_actor_id uuid,
  p_submission_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_submission public.submissions;
  v_rule jsonb := '{"actionCompleted":10,"preparation":5,"dailyFirst":10,"dailyActionCap":3,"dailyPointsCap":75}'::jsonb;
  v_rule_version text := 'mvp-v1';
  v_day date;
  v_daily_actions integer := 0;
  v_daily_points integer := 0;
  v_action_points integer := 0;
  v_preparation_points integer := 0;
  v_daily_first_points integer := 0;
  v_points integer := 0;
  v_award integer;
  v_awards jsonb := '[]'::jsonb;
  v_crew_update jsonb;
  v_weekly_points numeric := 0;
  v_lifetime_xp integer := 0;
  v_post jsonb;
  v_reward jsonb;
  v_streak_status text := 'not_qualified';
  v_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_submission_id::text, 0)
  );
  select * into v_submission
  from public.submissions
  where id = p_submission_id and profile_id = p_actor_id
  for update;
  if not found then raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_submission.verification_status = 'verified' or v_submission.behavior_status = 'confirmed' then
    return coalesce(v_submission.result_payload, jsonb_build_object('submissionId', v_submission.id))
      || jsonb_build_object('duplicate', true);
  end if;
  if v_submission.behavior_status <> 'pending' or v_submission.verification_status <> 'pending_action' then
    raise exception 'SUBMISSION_NOT_PENDING' using errcode = 'P0001';
  end if;

  select config, version into v_rule, v_rule_version
  from public.scoring_rules where active limit 1;
  v_day := v_submission.task_day;
  select coalesce(sum(points), 0), count(*) filter (where verification_status = 'verified')
  into v_daily_points, v_daily_actions
  from public.submissions
  where profile_id = p_actor_id and task_day = v_day;

  if v_daily_actions < coalesce((v_rule ->> 'dailyActionCap')::integer, 3) then
    v_award := least(
      coalesce((v_rule ->> 'actionCompleted')::integer, 10),
      greatest(0, coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points)
    );
    if v_award > 0 then
      v_action_points := v_award;
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'action_completed', 'points', v_award));
    end if;

    if nullif(v_submission.model_result ->> 'preparationTip', '') is not null then
      v_award := least(
        coalesce((v_rule ->> 'preparation')::integer, 5),
        greatest(0, coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points)
      );
      if v_award > 0 then
        v_preparation_points := v_award;
        v_points := v_points + v_award;
        v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'prep_step', 'points', v_award));
      end if;
    end if;

    if v_daily_actions = 0 then
      v_award := least(
        coalesce((v_rule ->> 'dailyFirst')::integer, 10),
        greatest(0, coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points)
      );
      if v_award > 0 then
        v_daily_first_points := v_award;
        v_points := v_points + v_award;
        v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'daily_first', 'points', v_award));
      end if;
    end if;
  end if;

  update public.submissions
  set verification_status = 'verified',
      behavior_status = 'confirmed',
      behavior_confirmed_at = now(),
      points = v_points,
      matches_task = true,
      failure_reason = null
  where id = v_submission.id;

  if v_submission.squad_id is not null then
    if v_action_points > 0 then
      insert into public.score_events(profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version)
      values (v_submission.profile_id, v_submission.squad_id, null, v_submission.id, 'action_completed', v_action_points, v_rule_version);
    end if;
    if v_preparation_points > 0 then
      insert into public.score_events(profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version)
      values (v_submission.profile_id, v_submission.squad_id, null, v_submission.id, 'prep_step', v_preparation_points, v_rule_version);
    end if;
    if v_daily_first_points > 0 then
      insert into public.score_events(profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version)
      values (v_submission.profile_id, v_submission.squad_id, null, v_submission.id, 'daily_first', v_daily_first_points, v_rule_version);
    end if;
    insert into public.daily_progress(profile_id, squad_id, progress_day, verified_actions, points, first_completed_at)
    values (v_submission.profile_id, v_submission.squad_id, v_day, 1, v_points, now())
    on conflict (profile_id, squad_id, progress_day) do update set
      verified_actions = public.daily_progress.verified_actions + 1,
      points = public.daily_progress.points + excluded.points,
      first_completed_at = coalesce(public.daily_progress.first_completed_at, excluded.first_completed_at),
      updated_at = now();
    perform private.update_user_streak(v_submission.profile_id, v_day);
    perform private.refresh_crew_daily_streak(v_submission.squad_id, v_day);
    select case when qualified then 'advanced' else 'not_qualified' end into v_streak_status
    from public.crew_daily_streaks where squad_id = v_submission.squad_id and streak_day = v_day;
    v_crew_update := public.apply_submission_progress_for_actor(v_submission.profile_id, v_submission.squad_id, v_submission.id);
    select coalesce(le.score, 0) into v_weekly_points
    from public.league_entries le
    join public.leagues l on l.id = le.league_id
    where le.squad_id = v_submission.squad_id and l.status = 'active'
    order by l.ends_at desc limit 1;
  else
    perform private.update_user_streak(v_submission.profile_id, v_day);
    insert into public.profile_progress(profile_id, lifetime_xp)
    values (v_submission.profile_id, v_points)
    on conflict (profile_id) do update
      set lifetime_xp = public.profile_progress.lifetime_xp + excluded.lifetime_xp,
          updated_at = now()
    returning lifetime_xp into v_lifetime_xp;
    insert into public.profile_inventory(profile_id, cosmetic_id)
    select v_submission.profile_id, id from public.cosmetic_catalog
    where active and unlock_xp <= v_lifetime_xp on conflict do nothing;
    insert into public.profile_posts(submission_id, profile_id, squad_id)
    values (v_submission.id, v_submission.profile_id, null)
    on conflict (submission_id) do nothing;
  end if;

  select jsonb_build_object(
    'id', pp.id,
    'scanEventId', pp.submission_id,
    'itemName', v_submission.model_result ->> 'itemName',
    'finalBin', v_submission.final_bin,
    'isCorrect', true,
    'points', v_points,
    'createdAt', pp.created_at,
    'visibility', pp.visibility,
    'imageVisible', pp.image_visible
  ) into v_post
  from public.profile_posts pp where pp.submission_id = v_submission.id;

  v_result := jsonb_build_object(
    'submissionId', v_submission.id,
    'scanEventId', v_submission.id,
    'taskId', v_submission.task_id,
    'taskDay', v_submission.task_day,
    'classification', v_submission.model_result,
    'outcome', 'completed',
    'validated', true,
    'photoValidated', true,
    'failureReason', null,
    'behaviorCheckIn', jsonb_build_object(
      'action', 'recycle_bottle', 'status', 'confirmed', 'selfReported', true, 'confirmedAt', now()
    ),
    'awarded', v_awards,
    'points', jsonb_build_object(
      'actionCompletion', v_action_points,
      'preparation', v_preparation_points,
      'dailyBonus', v_daily_first_points,
      'total', v_points
    ),
    'dailyPointsRemaining', greatest(0, coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points),
    'streak', coalesce(
      (select jsonb_build_object('current', current_streak, 'longest', longest_streak) from public.user_streaks where profile_id = v_submission.profile_id),
      jsonb_build_object('current', 0, 'longest', 0)
    ),
    'crewUpdate', case when v_submission.squad_id is null then null else coalesce(v_crew_update, '{}'::jsonb) || jsonb_build_object('weeklyPoints', coalesce(v_weekly_points, 0), 'streakStatus', v_streak_status) end,
    'post', v_post,
    'reward', v_reward,
    'unlock', v_reward,
    'duplicate', false
  );
  update public.submissions set result_payload = v_result where id = v_submission.id;
  return v_result;
end;
$$;

revoke all on function public.record_pending_task_submission(uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_pending_task_submission(uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid) to service_role;
revoke all on function public.confirm_recycling_action(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_recycling_action(uuid, uuid, text) to service_role;
