begin;

select plan(20);

create temp table mvp_flow_results (
  result_key text primary key,
  value jsonb not null
);

do $$
declare
  v_day date := private.profile_local_day('a1000000-0000-4000-8000-000000000001'::uuid);
  v_prompt text := 'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.';
  v_base jsonb := jsonb_build_object(
    'itemName', 'empty plastic bottle',
    'material', 'PET plastic',
    'recommendedBin', 'recycle',
    'preparationTip', 'Empty the bottle before recycling.',
    'confidence', 0.96,
    'localeRuleVersion', 'sg-demo-v1',
    'explanation', 'The image matches the assigned task.',
    'taskPrompt', v_prompt,
    'promptSimilarity', 0.96,
    'taskSatisfied', true,
    'failureReason', null,
    'matchesTask', true,
    'taskConfidence', 0.96,
    'taskReason', 'The bottle is empty and held toward a recycling bin.'
  );
  v_message text;
  v_error jsonb;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mvp-empty@ecocrew.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mvp-liquid@ecocrew.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'mvp-unrelated@ecocrew.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'mvp-stale@ecocrew.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'mvp-crew@ecocrew.local', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, display_name, timezone)
  values
    ('a1000000-0000-4000-8000-000000000001', 'MVP Empty', 'Asia/Singapore'),
    ('a1000000-0000-4000-8000-000000000002', 'MVP Liquid', 'Asia/Singapore'),
    ('a1000000-0000-4000-8000-000000000003', 'MVP Unrelated', 'Asia/Singapore'),
    ('a1000000-0000-4000-8000-000000000004', 'MVP Stale', 'Asia/Singapore'),
    ('a1000000-0000-4000-8000-000000000005', 'MVP Crew', 'Asia/Singapore')
  on conflict (id) do update set
    display_name = excluded.display_name,
    timezone = excluded.timezone;

  insert into public.user_daily_tasks (profile_id, task_day, timezone, task_id)
  select id, v_day, 'Asia/Singapore', 'recycle-plastic-bottle'
  from public.profiles
  where id in (
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000005'
  );

  insert into mvp_flow_results
  values ('empty_pending', public.record_pending_task_submission(
    'a1000000-0000-4000-8000-000000000001', 'recycle-plastic-bottle', v_day, 'mvp-empty-01', v_base, true, .96, .96,
    'The bottle is empty and held toward a recycling bin.', 'empty plastic bottle', 'PET plastic', 'recycle', null
  ));

  insert into mvp_flow_results
  values ('empty_confirmed', public.confirm_recycling_action(
    'a1000000-0000-4000-8000-000000000001',
    ((select value from mvp_flow_results where result_key = 'empty_pending')->>'submissionId')::uuid,
    'mvp-confirm-01'
  ));

  insert into mvp_flow_results
  values ('empty_duplicate', public.confirm_recycling_action(
    'a1000000-0000-4000-8000-000000000001',
    ((select value from mvp_flow_results where result_key = 'empty_pending')->>'submissionId')::uuid,
    'mvp-confirm-02'
  ));

  insert into mvp_flow_results
  values ('liquid_failed', public.record_pending_task_submission(
    'a1000000-0000-4000-8000-000000000002', 'recycle-plastic-bottle', v_day, 'mvp-liquid-01',
    v_base || jsonb_build_object('itemName', 'plastic bottle with liquid', 'taskSatisfied', false, 'matchesTask', false, 'failureReason', 'liquid_present', 'taskReason', 'Empty the bottle first.'),
    false, .96, .96, 'Empty the bottle first.', 'plastic bottle with liquid', 'PET plastic', 'recycle', null
  ));

  insert into mvp_flow_results
  values ('unrelated_failed', public.record_pending_task_submission(
    'a1000000-0000-4000-8000-000000000003', 'recycle-plastic-bottle', v_day, 'mvp-unrelated-01',
    v_base || jsonb_build_object('itemName', 'unrelated household item', 'material', 'unknown', 'recommendedBin', 'landfill', 'preparationTip', null, 'taskSatisfied', false, 'matchesTask', false, 'failureReason', 'unrelated_item', 'taskReason', 'That item does not match today’s mission.'),
    false, .94, .96, 'That item does not match today’s mission.', 'unrelated household item', 'unknown', 'landfill', null
  ));

  insert into mvp_flow_results
  values ('stale_pending', public.record_pending_task_submission(
    'a1000000-0000-4000-8000-000000000004', 'recycle-plastic-bottle', v_day, 'mvp-stale-01', v_base, true, .96, .96,
    'The bottle is empty and held toward a recycling bin.', 'empty plastic bottle', 'PET plastic', 'recycle', null
  ));
  update public.submissions
  set task_day = v_day - 1
  where id = ((select value from mvp_flow_results where result_key = 'stale_pending')->>'submissionId')::uuid;
  begin
    v_error := jsonb_build_object('message', 'NO_ERROR');
    perform public.confirm_recycling_action(
      'a1000000-0000-4000-8000-000000000004',
      ((select value from mvp_flow_results where result_key = 'stale_pending')->>'submissionId')::uuid,
      'mvp-stale-confirm'
    );
  exception when others then
    get stacked diagnostics v_message = message_text;
    v_error := jsonb_build_object('message', v_message);
  end;
  insert into mvp_flow_results values ('stale_error', v_error);

  insert into public.squads (id, owner_id, name, timezone, min_daily_members, max_members)
  values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'MVP Crew', 'Asia/Singapore', 1, 8);
  insert into public.squad_members (squad_id, profile_id, role, status)
  values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'owner', 'active');
  insert into public.squad_streaks (squad_id) values ('b1000000-0000-4000-8000-000000000001');

  insert into mvp_flow_results
  values ('crew_pending', public.record_pending_task_submission(
    'a1000000-0000-4000-8000-000000000005', 'recycle-plastic-bottle', v_day, 'mvp-crew-01', v_base, true, .96, .96,
    'The bottle is empty and held toward a recycling bin.', 'empty plastic bottle', 'PET plastic', 'recycle', 'b1000000-0000-4000-8000-000000000001'
  ));
  insert into mvp_flow_results
  values ('crew_confirmed', public.confirm_recycling_action(
    'a1000000-0000-4000-8000-000000000005',
    ((select value from mvp_flow_results where result_key = 'crew_pending')->>'submissionId')::uuid,
    'mvp-crew-confirm'
  ));
end;
$$;

select is((select value->>'outcome' from mvp_flow_results where result_key = 'empty_pending'), 'awaiting_check_in', 'successful photo waits for check-in');
select is(((select value from mvp_flow_results where result_key = 'empty_pending')->'points'->>'total')::integer, 0, 'photo attempt awards zero points');
select is((select value->>'outcome' from mvp_flow_results where result_key = 'empty_confirmed'), 'completed', 'check-in completes the action');
select is(((select value from mvp_flow_results where result_key = 'empty_confirmed')->'points'->>'total')::integer, 25, 'eligible action receives 10 plus 5 plus 10');
select is(((select value from mvp_flow_results where result_key = 'empty_confirmed')->'awarded'->0->>'actionType'), 'action_completed', 'completion uses the canonical score event');
select is((select value->'unlock'->>'cosmeticId' from mvp_flow_results where result_key = 'empty_confirmed'), 'leaf-frame', 'newly unlocked cosmetic is returned');
select is((select value->'nextUnlock'->>'cosmeticId' from mvp_flow_results where result_key = 'empty_confirmed'), 'sprout-badge', 'next cosmetic unlock is returned');
select is(((select value from mvp_flow_results where result_key = 'empty_duplicate')->>'duplicate')::boolean, true, 'confirmation is idempotent');
select is((select lifetime_xp from public.profile_progress where profile_id = 'a1000000-0000-4000-8000-000000000001'), 25, 'no-crew user receives personal progress');
select is((select value->>'outcome' from mvp_flow_results where result_key = 'liquid_failed'), 'failed', 'liquid fixture fails');
select is((select value->>'failureReason' from mvp_flow_results where result_key = 'liquid_failed'), 'liquid_present', 'liquid failure is canonical');
select is((select value->>'outcome' from mvp_flow_results where result_key = 'unrelated_failed'), 'failed', 'unrelated fixture fails');
select is((select value->>'failureReason' from mvp_flow_results where result_key = 'unrelated_failed'), 'unrelated_item', 'unrelated failure is canonical');
select is((select value->>'message' from mvp_flow_results where result_key = 'stale_error'), 'DAILY_TASK_EXPIRED', 'stale confirmation is rejected');
select is((select value->>'outcome' from mvp_flow_results where result_key = 'crew_confirmed'), 'completed', 'crew check-in completes the action');
select is(((select value from mvp_flow_results where result_key = 'crew_confirmed')->'points'->>'total')::integer, 25, 'crew action receives the full breakdown');
select is(((select value from mvp_flow_results where result_key = 'crew_confirmed')->'crewUpdate'->>'missionProgress')::integer, 25, 'crew mission progress advances');
select is((select value->'crewUpdate'->>'streakStatus' from mvp_flow_results where result_key = 'crew_confirmed'), 'advanced', 'crew streak qualifies with one active member');
select is((select action_type from public.score_events where submission_id = ((select value from mvp_flow_results where result_key = 'crew_pending')->>'submissionId')::uuid and action_type = 'action_completed'), 'action_completed', 'crew score ledger uses action_completed');
select is((select points from public.daily_progress where profile_id = 'a1000000-0000-4000-8000-000000000005' and squad_id = 'b1000000-0000-4000-8000-000000000001' and progress_day = private.profile_local_day('a1000000-0000-4000-8000-000000000005')), 25, 'crew daily progress advances');

select * from finish();
rollback;
