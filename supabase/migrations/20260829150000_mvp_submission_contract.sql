-- MVP follow-up: keep the existing task assignment and RLS model, but make
-- the selected bin part of the trusted submission result and award MVP points
-- in the same transaction as the submission.

drop function if exists public.record_task_submission(
  uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid
);

create function public.record_task_submission(
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
  p_user_selected_bin text,
  p_squad_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment public.user_daily_tasks;
  v_squad_id uuid := p_squad_id;
  v_submission public.submissions;
  v_rule jsonb := jsonb_build_object(
    'confidenceThreshold', 0.70,
    'correctSort', 10,
    'preparation', 5,
    'dailyFirst', 10,
    'dailyPointsCap', 75
  );
  v_rule_version text := 'mvp-v1';
  v_threshold numeric := 0.70;
  v_task_valid boolean := coalesce(p_matches_task, false);
  v_correct boolean := false;
  v_already_verified boolean := false;
  v_status text;
  v_daily_actions integer := 0;
  v_daily_points integer := 0;
  v_points integer := 0;
  v_correct_points integer := 0;
  v_preparation_points integer := 0;
  v_daily_first_points integer := 0;
  v_award integer;
  v_awards jsonb := '[]'::jsonb;
  v_crew_update jsonb := '{}'::jsonb;
  v_post jsonb;
  v_weekly_points numeric := 0;
  v_lifetime_xp integer := 0;
  v_streak_status text := 'not_qualified';
  v_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;
  if p_user_selected_bin not in ('recycle', 'compost', 'reuse_return', 'landfill') then
    raise exception 'INVALID_BIN' using errcode = '22023';
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
    return coalesce(
      v_submission.result_payload,
      jsonb_build_object(
        'submissionId', v_submission.id,
        'classification', v_submission.model_result,
        'outcome', v_submission.verification_status,
        'awarded', '[]'::jsonb,
        'points', jsonb_build_object('total', v_submission.points)
      )
    ) || jsonb_build_object('duplicate', true);
  end if;

  select * into v_assignment
  from public.user_daily_tasks
  where profile_id = p_actor_id
    and task_day = p_task_day
    and task_id = p_task_id;
  if not found then
    raise exception 'DAILY_TASK_MISMATCH' using errcode = 'P0001';
  end if;
  if p_task_day <> private.profile_local_day(p_actor_id) then
    raise exception 'DAILY_TASK_EXPIRED' using errcode = 'P0001';
  end if;

  if v_squad_id is not null and not exists (
    select 1
    from public.squad_members
    where squad_id = v_squad_id
      and profile_id = p_actor_id
      and status = 'active'
  ) then
    raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001';
  end if;

  select config, version into v_rule, v_rule_version
  from public.scoring_rules
  where active
  limit 1;
  v_threshold := coalesce((v_rule ->> 'confidenceThreshold')::numeric, 0.70);
  v_task_valid := v_task_valid and p_confidence >= v_threshold and p_recommended_bin <> 'unknown';
  v_correct := v_task_valid and p_user_selected_bin = p_recommended_bin;

  select exists (
    select 1
    from public.submissions
    where profile_id = p_actor_id
      and task_day = p_task_day
      and verification_status = 'verified'
  ) into v_already_verified;

  if v_already_verified and v_correct then
    p_validation_reason := 'A verified task has already been submitted today.';
    v_correct := false;
    v_task_valid := false;
  end if;

  v_status := case
    when v_correct then 'verified'
    when not v_task_valid then 'low_confidence'
    else 'failed'
  end;

  select coalesce(sum(points), 0), count(*) filter (where verification_status = 'verified')
  into v_daily_points, v_daily_actions
  from public.submissions
  where profile_id = p_actor_id and task_day = p_task_day;

  insert into public.submissions (
    profile_id, squad_id, challenge_id, image_path, task_id, task_day, model_result,
    user_bin, final_bin, confidence, verification_status, points, result_payload,
    idempotency_key, matches_task, validation_reason, league_id, submitted_at
  )
  values (
    p_actor_id, v_squad_id, null, null, p_task_id, p_task_day, coalesce(p_model_result, '{}'::jsonb),
    p_user_selected_bin, coalesce(p_recommended_bin, 'unknown'),
    greatest(0, least(1, p_confidence)), v_status, 0, null,
    p_idempotency_key, coalesce(p_matches_task, false), p_validation_reason, null, now()
  )
  returning * into v_submission;

  if v_status = 'verified' and v_daily_actions < coalesce((v_rule ->> 'dailyActionCap')::integer, 3) then
    v_award := least(
      coalesce((v_rule ->> 'correctSort')::integer, 10),
      greatest(0, coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points)
    );
    if v_award > 0 then
      v_correct_points := v_award;
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'correct_sort', 'points', v_award));
    end if;

    if nullif(p_model_result ->> 'preparationTip', '') is not null then
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

  if v_squad_id is not null then
    if v_correct_points > 0 then
      insert into public.score_events (
        profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version
      ) values (
        p_actor_id, v_squad_id, null, v_submission.id, 'correct_sort', v_correct_points, v_rule_version
      );
    end if;
    if v_preparation_points > 0 then
      insert into public.score_events (
        profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version
      ) values (
        p_actor_id, v_squad_id, null, v_submission.id, 'prep_step', v_preparation_points, v_rule_version
      );
    end if;
    if v_daily_first_points > 0 then
      insert into public.score_events (
        profile_id, squad_id, contest_id, submission_id, action_type, points, scoring_rule_version
      ) values (
        p_actor_id, v_squad_id, null, v_submission.id, 'daily_first', v_daily_first_points, v_rule_version
      );
    end if;
  end if;

  update public.submissions set points = v_points where id = v_submission.id;

  if v_squad_id is not null then
    if v_status = 'verified' then
      insert into public.daily_progress (
        profile_id, squad_id, progress_day, verified_actions, points, first_completed_at
      )
      values (p_actor_id, v_squad_id, p_task_day, 1, v_points, now())
      on conflict (profile_id, squad_id, progress_day) do update
      set verified_actions = public.daily_progress.verified_actions + 1,
          points = public.daily_progress.points + excluded.points,
          first_completed_at = coalesce(public.daily_progress.first_completed_at, excluded.first_completed_at),
          updated_at = now();
    end if;

    if v_status = 'verified' then
      perform private.update_user_streak(p_actor_id, p_task_day);
      perform private.refresh_crew_daily_streak(v_squad_id, p_task_day);
      select case when qualified then 'advanced' else 'not_qualified' end
      into v_streak_status
      from public.crew_daily_streaks
      where squad_id = v_squad_id and streak_day = p_task_day;

      if v_streak_status = 'advanced' then
        insert into public.squad_streaks (squad_id)
        values (v_squad_id)
        on conflict (squad_id) do nothing;
        update public.squad_streaks
        set current_streak = case
              when last_completed_day = p_task_day then current_streak
              when last_completed_day = p_task_day - 1 then current_streak + 1
              else 1
            end,
            last_completed_day = p_task_day,
            updated_at = now()
        where squad_id = v_squad_id;
      end if;
    end if;

    if v_status = 'verified' then
      select public.apply_submission_progress_for_actor(p_actor_id, v_squad_id, v_submission.id)
      into v_crew_update;
      select coalesce(le.score, 0) into v_weekly_points
      from public.league_entries le
      join public.leagues l on l.id = le.league_id
      where le.squad_id = v_squad_id and l.status = 'active'
      order by l.ends_at desc
      limit 1;
    else
      insert into public.profile_posts(submission_id, profile_id, squad_id)
      values (v_submission.id, p_actor_id, v_squad_id);
    end if;
  else
    if v_status = 'verified' then
      perform private.update_user_streak(p_actor_id, p_task_day);
    end if;
    insert into public.profile_progress(profile_id, lifetime_xp)
    values (p_actor_id, v_points)
    on conflict (profile_id) do update
      set lifetime_xp = public.profile_progress.lifetime_xp + excluded.lifetime_xp,
          updated_at = now()
    returning lifetime_xp into v_lifetime_xp;
    insert into public.profile_inventory(profile_id, cosmetic_id)
    select p_actor_id, id
    from public.cosmetic_catalog
    where active and unlock_xp <= v_lifetime_xp
    on conflict do nothing;
    if v_status <> 'verified' then
      insert into public.profile_posts(submission_id, profile_id, squad_id)
      values (v_submission.id, p_actor_id, null);
    end if;
  end if;

  select jsonb_build_object(
    'id', pp.id,
    'scanEventId', pp.submission_id,
    'itemName', p_item_name,
    'finalBin', p_recommended_bin,
    'isCorrect', case when v_status = 'low_confidence' then null else v_correct end,
    'points', v_points,
    'createdAt', pp.created_at,
    'visibility', pp.visibility,
    'imageVisible', pp.image_visible
  ) into v_post
  from public.profile_posts pp
  where pp.submission_id = v_submission.id;

  v_result := jsonb_build_object(
    'submissionId', v_submission.id,
    'scanEventId', v_submission.id,
    'taskId', p_task_id,
    'taskDay', p_task_day,
    'classification', coalesce(p_model_result, '{}'::jsonb),
    'outcome', case when v_correct then 'confirmed' when v_task_valid then 'needs_confirmation' else 'unknown' end,
    'validated', v_correct,
    'userSelectedBin', p_user_selected_bin,
    'awarded', v_awards,
    'points', jsonb_build_object(
      'correctBin', v_correct_points,
      'preparation', v_preparation_points,
      'dailyBonus', v_daily_first_points,
      'total', v_points
    ),
    'dailyPointsRemaining', greatest(
      0,
      coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - v_daily_points - v_points
    ),
    'validationReason', p_validation_reason,
    'itemName', p_item_name,
    'material', p_material,
    'recommendedBin', p_recommended_bin,
    'streak', coalesce(
      (select jsonb_build_object('current', current_streak, 'longest', longest_streak)
       from public.user_streaks where profile_id = p_actor_id),
      jsonb_build_object('current', 0, 'longest', 0)
    ),
    'crewUpdate', case
      when v_squad_id is null then null
      else v_crew_update || jsonb_build_object('weeklyPoints', coalesce(v_weekly_points, 0), 'streakStatus', v_streak_status)
    end,
    'post', v_post,
    'duplicate', false
  );

  update public.submissions set result_payload = v_result where id = v_submission.id;
  return v_result;
end;
$$;

revoke all on function public.record_task_submission(
  uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_task_submission(
  uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid
) to service_role;
