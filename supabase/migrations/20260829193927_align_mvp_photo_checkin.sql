-- Align the MVP around the server-owned photo -> check-in -> score flow.

alter table public.task_catalog
  add column if not exists title text,
  add column if not exists instruction text;

alter table public.task_catalog
  add column if not exists locale_rule_version text not null default 'sg-demo-v1';

alter table public.task_catalog
  add constraint task_catalog_locale_rule_version_valid
  check (char_length(locale_rule_version) between 2 and 80);

update public.task_catalog
set title = 'Clean Bottle Check',
    instruction = 'Empty a single-use plastic bottle, recycle it, and take a photo to confirm the action.',
    prompt = 'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    locale = 'en-SG',
    locale_rule_version = 'sg-demo-v1',
    target_object = 'single-use plastic bottle',
    target_material = 'plastic',
    target_action = 'recycle',
    validation_metadata = '{"requiredContext":"recycling_bin","requiresEmpty":true}'::jsonb
where id = 'recycle-plastic-bottle';

update public.scoring_rules
set config = config || '{"taskSimilarityThreshold":0.75}'::jsonb
where version = 'mvp-v1';

create or replace function public.get_or_assign_daily_task(p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date;
  v_timezone text;
  v_task public.task_catalog;
begin
  select coalesce(timezone, 'Asia/Singapore') into v_timezone
  from public.profiles where id = p_actor_id;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Singapore';
  end if;
  v_day := (now() at time zone v_timezone)::date;

  insert into public.user_daily_tasks (profile_id, task_day, timezone, task_id)
  select p_actor_id, v_day, v_timezone, t.id
  from public.task_catalog t
  where t.active and t.locale = 'en-SG'
  order by md5(p_actor_id::text || ':' || v_day::text || ':' || t.id)
  limit 1
  on conflict (profile_id, task_day) do nothing;

  select t.* into v_task
  from public.user_daily_tasks a
  join public.task_catalog t on t.id = a.task_id
  where a.profile_id = p_actor_id and a.task_day = v_day;
  if not found then raise exception 'DAILY_TASK_NOT_AVAILABLE' using errcode = 'P0001'; end if;

  return jsonb_build_object(
    'taskId', v_task.id,
    'taskDay', v_day,
    'timezone', v_timezone,
    'locale', v_task.locale,
    'localeRuleVersion', v_task.locale_rule_version,
    'title', v_task.title,
    'instruction', v_task.instruction,
    'prompt', v_task.prompt,
    'targetObject', v_task.target_object,
    'targetMaterial', v_task.target_material,
    'targetAction', v_task.target_action,
    'validationMetadata', v_task.validation_metadata,
    'streak', (select jsonb_build_object('current', current_streak, 'longest', longest_streak)
               from public.user_streaks where profile_id = p_actor_id)
  );
end;
$$;

drop function if exists public.record_pending_task_submission(uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid);

create function public.record_pending_task_submission(
  p_actor_id uuid,
  p_task_id text,
  p_task_day date,
  p_idempotency_key text,
  p_model_result jsonb,
  p_matches_task boolean,
  p_confidence numeric,
  p_prompt_similarity numeric,
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
  v_task public.task_catalog;
  v_submission public.submissions;
  v_rule jsonb := '{"confidenceThreshold":0.70,"taskSimilarityThreshold":0.75,"dailyPointsCap":75}'::jsonb;
  v_threshold numeric := 0.70;
  v_similarity_threshold numeric := 0.75;
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
  if p_confidence is null or p_confidence < 0 or p_confidence > 1
    or p_prompt_similarity is null or p_prompt_similarity < 0 or p_prompt_similarity > 1 then
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
  select * into v_task from public.task_catalog where id = v_assignment.task_id;
  if p_model_result ->> 'taskPrompt' is distinct from v_task.prompt
    or p_model_result ->> 'localeRuleVersion' is distinct from v_task.locale_rule_version then
    raise exception 'INVALID_CLASSIFICATION' using errcode = '22023';
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
  v_similarity_threshold := coalesce((v_rule ->> 'taskSimilarityThreshold')::numeric, 0.75);
  v_task_valid := coalesce(p_matches_task, false)
    and p_confidence >= v_threshold
    and p_prompt_similarity >= v_similarity_threshold
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
    null, p_idempotency_key, v_task_valid, p_validation_reason, null, now()
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

create or replace function public.apply_submission_progress_for_actor(p_actor_id uuid, p_squad_id uuid, p_submission_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_points integer;
  v_day date;
  v_mission public.squad_daily_missions;
  v_new_post uuid;
  v_xp integer;
  v_unlocked jsonb := '[]'::jsonb;
begin
  select points into v_points from public.submissions where id = p_submission_id and profile_id = p_actor_id;
  if not found then raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.profile_posts(submission_id, profile_id, squad_id)
  values(p_submission_id, p_actor_id, p_squad_id)
  on conflict(submission_id) do nothing
  returning id into v_new_post;
  if v_new_post is null then return jsonb_build_object('duplicate', true); end if;

  insert into public.profile_progress(profile_id, lifetime_xp)
  values(p_actor_id, v_points)
  on conflict(profile_id) do update
    set lifetime_xp = public.profile_progress.lifetime_xp + excluded.lifetime_xp, updated_at = now()
  returning lifetime_xp into v_xp;

  with newly_unlocked as (
    insert into public.profile_inventory(profile_id, cosmetic_id)
    select p_actor_id, id from public.cosmetic_catalog
    where active and unlock_xp <= v_xp
    on conflict do nothing
    returning cosmetic_id, unlocked_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'cosmeticId', newly_unlocked.cosmetic_id,
    'name', catalog.name,
    'kind', catalog.kind,
    'unlockXp', catalog.unlock_xp,
    'unlockedAt', newly_unlocked.unlocked_at
  ) order by catalog.unlock_xp, catalog.id), '[]'::jsonb)
  into v_unlocked
  from newly_unlocked
  join public.cosmetic_catalog catalog on catalog.id = newly_unlocked.cosmetic_id;

  select (now() at time zone timezone)::date into v_day from public.squads where id = p_squad_id;
  perform public.get_squad_daily_mission_for_actor(p_actor_id, p_squad_id);
  select * into v_mission from public.squad_daily_missions
  where squad_id = p_squad_id and mission_day = v_day for update;
  update public.squad_daily_missions
  set progress = progress + v_points,
      completed_at = case when progress + v_points >= (select target from public.mission_catalog where id = v_mission.mission_id) then coalesce(completed_at, now()) else completed_at end
  where id = v_mission.id
  returning * into v_mission;
  update public.league_entries le
  set score = score + v_points
  from public.leagues l
  where le.league_id = l.id and le.squad_id = p_squad_id and l.status = 'active' and now() >= l.starts_at and now() < l.ends_at;
  insert into public.activity_events(squad_id, actor_id, post_id, event_type, payload)
  values(p_squad_id, p_actor_id, v_new_post, 'submission', jsonb_build_object('points', v_points));
  return jsonb_build_object(
    'missionProgress', v_mission.progress,
    'missionCompleted', v_mission.completed_at is not null,
    'lifetimeXp', v_xp,
    'unlocked', v_unlocked
  );
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
  v_unlocked jsonb := '[]'::jsonb;
  v_next_unlock jsonb;
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

  if v_submission.task_day <> private.profile_local_day(p_actor_id) then
    raise exception 'DAILY_TASK_EXPIRED' using errcode = 'P0001';
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
    v_unlocked := coalesce(v_crew_update -> 'unlocked', '[]'::jsonb);
    select coalesce(le.score, 0) into v_weekly_points
    from public.league_entries le
    join public.leagues l on l.id = le.league_id
    where le.squad_id = v_submission.squad_id and l.status = 'active'
    order by l.ends_at desc limit 1;
    v_lifetime_xp := coalesce((v_crew_update ->> 'lifetimeXp')::integer, 0);
  else
    perform private.update_user_streak(v_submission.profile_id, v_day);
    insert into public.profile_progress(profile_id, lifetime_xp)
    values (v_submission.profile_id, v_points)
    on conflict (profile_id) do update
      set lifetime_xp = public.profile_progress.lifetime_xp + excluded.lifetime_xp,
          updated_at = now()
    returning lifetime_xp into v_lifetime_xp;
    with newly_unlocked as (
      insert into public.profile_inventory(profile_id, cosmetic_id)
      select v_submission.profile_id, id from public.cosmetic_catalog
      where active and unlock_xp <= v_lifetime_xp
      on conflict do nothing
      returning cosmetic_id, unlocked_at
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'cosmeticId', newly_unlocked.cosmetic_id,
      'name', catalog.name,
      'kind', catalog.kind,
      'unlockXp', catalog.unlock_xp,
      'unlockedAt', newly_unlocked.unlocked_at
    ) order by catalog.unlock_xp, catalog.id), '[]'::jsonb)
    into v_unlocked
    from newly_unlocked
    join public.cosmetic_catalog catalog on catalog.id = newly_unlocked.cosmetic_id;
    insert into public.profile_posts(submission_id, profile_id, squad_id)
    values (v_submission.id, v_submission.profile_id, null)
    on conflict (submission_id) do nothing;
  end if;

  v_reward := v_unlocked -> 0;
  select jsonb_build_object(
    'cosmeticId', catalog.id,
    'name', catalog.name,
    'kind', catalog.kind,
    'unlockXp', catalog.unlock_xp
  ) into v_next_unlock
  from public.cosmetic_catalog catalog
  where catalog.active and catalog.unlock_xp > v_lifetime_xp
  order by catalog.unlock_xp, catalog.id
  limit 1;

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
    'nextUnlock', v_next_unlock,
    'duplicate', false
  );
  update public.submissions set result_payload = v_result where id = v_submission.id;
  return v_result;
end;
$$;

revoke all on function public.record_pending_task_submission(uuid, text, date, text, jsonb, boolean, numeric, numeric, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_pending_task_submission(uuid, text, date, text, jsonb, boolean, numeric, numeric, text, text, text, text, uuid) to service_role;
revoke all on function public.confirm_recycling_action(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_recycling_action(uuid, uuid, text) to service_role;
