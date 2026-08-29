insert into public.scoring_rules (version, config, active)
values (
  'mvp-v1',
  jsonb_build_object(
    'confidenceThreshold', 0.70,
    'actionCompleted', 10,
    'correctSort', 10,
    'taskSimilarityThreshold', 0.75,
    'preparation', 5,
    'dailyFirst', 10,
    'participation', 5,
    'dailyActionCap', 3,
    'dailyPointsCap', 75
  ),
  true
)
on conflict (version) do update
set config = excluded.config, active = excluded.active;

insert into public.contests (
  id,
  name,
  theme,
  starts_at,
  ends_at,
  status,
  scoring_rule_version
)
values (
  '10000000-0000-4000-8000-000000000001',
  'Glass Guardians Weekly League',
  'Defeat the Landfill Monster',
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  'active',
  'mvp-v1'
)
on conflict (id) do update
set name = excluded.name,
    theme = excluded.theme,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    scoring_rule_version = excluded.scoring_rule_version;

insert into public.daily_challenges (
  id,
  challenge_day,
  locale,
  title,
  theme,
  prompt,
  locale_rule_version,
  scoring_rule_version,
  active
)
values (
  '20000000-0000-4000-8000-000000000001',
  (now() at time zone 'Asia/Singapore')::date,
  'en-SG',
  'Clean Bottle Check',
  'Glass Guardians',
  'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
  'sg-demo-v1',
  'mvp-v1',
  true
)
on conflict (challenge_day, locale) do update
set title = excluded.title,
    theme = excluded.theme,
    prompt = excluded.prompt,
    locale_rule_version = excluded.locale_rule_version,
    scoring_rule_version = excluded.scoring_rule_version,
    active = excluded.active;

-- Local MVP fixture data. This is intentionally reset-friendly and must not
-- be used as production or shared-environment application data.
do $$
declare
  v_day date := (now() at time zone 'Asia/Singapore')::date;
  v_week_start date := date_trunc('week', now() at time zone 'Asia/Singapore')::date;
  v_week_start_at timestamptz := (
    date_trunc('week', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore'
  );
  v_submission_at timestamptz := greatest(
    (v_day::text || ' 00:00:00 Asia/Singapore')::timestamptz,
    now() - interval '20 minutes'
  );
  v_classification jsonb := jsonb_build_object(
    'itemName', 'plastic drink bottle',
    'material', 'PET plastic',
    'recommendedBin', 'recycle',
    'preparationTip', 'Empty and rinse the bottle, then replace the cap before recycling.',
    'confidence', 0.86,
    'localeRuleVersion', 'sg-demo-v1',
    'explanation', 'The image appears to show a PET beverage bottle.',
    'taskPrompt', 'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    'promptSimilarity', 0.96,
    'taskSatisfied', true,
    'failureReason', null,
    'matchesTask', true,
    'taskConfidence', 0.95,
    'taskReason', 'The demo image matches the assigned bottle task.'
  );
begin
  -- Seed identities so their public profiles can satisfy the auth.users FK.
  insert into auth.users (
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'maya.seed@ecocrew.local', '{}'::jsonb, '{"display_name":"Maya"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'noah.seed@ecocrew.local', '{}'::jsonb, '{"display_name":"Noah"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ari.seed@ecocrew.local', '{}'::jsonb, '{"display_name":"Ari"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'bottle.brigade@ecocrew.local', '{}'::jsonb, '{"display_name":"Bottle Brigade"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'compost.club@ecocrew.local', '{}'::jsonb, '{"display_name":"Compost Club"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'recyclables@ecocrew.local', '{}'::jsonb, '{"display_name":"The Recyclables"}'::jsonb, now(), now()),
    ('a0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'bin.there@ecocrew.local', '{}'::jsonb, '{"display_name":"Bin There"}'::jsonb, now(), now())
  on conflict (id) do update
    set raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

  insert into public.profiles (
    id, display_name, handle, about, location, timezone, age_visibility,
    leaderboard_visible, privacy_settings
  )
  values
    ('a0000000-0000-4000-8000-000000000001', 'Maya', '@maya.eco', 'Glass Guardian captain.', 'Singapore', 'Asia/Singapore', 'crew', true, '{"shareActivity":true}'::jsonb),
    ('a0000000-0000-4000-8000-000000000002', 'Noah', '@noah.eco', 'Sorting one item at a time.', 'Singapore', 'Asia/Singapore', 'crew', true, '{"shareActivity":true}'::jsonb),
    ('a0000000-0000-4000-8000-000000000003', 'Ari', '@ari.eco', 'Making small choices count.', 'Singapore', 'Asia/Singapore', 'crew', true, '{"shareActivity":true}'::jsonb),
    ('a0000000-0000-4000-8000-000000000004', 'Bottle Brigade', null, '', 'Singapore', 'Asia/Singapore', 'private', true, '{"shareActivity":false}'::jsonb),
    ('a0000000-0000-4000-8000-000000000005', 'Compost Club', null, '', 'Singapore', 'Asia/Singapore', 'private', true, '{"shareActivity":false}'::jsonb),
    ('a0000000-0000-4000-8000-000000000006', 'The Recyclables', null, '', 'Singapore', 'Asia/Singapore', 'private', true, '{"shareActivity":false}'::jsonb),
    ('a0000000-0000-4000-8000-000000000007', 'Bin There', null, '', 'Singapore', 'Asia/Singapore', 'private', true, '{"shareActivity":false}'::jsonb)
  on conflict (id) do update set
    display_name = excluded.display_name,
    handle = excluded.handle,
    about = excluded.about,
    location = excluded.location,
    timezone = excluded.timezone,
    age_visibility = excluded.age_visibility,
    leaderboard_visible = excluded.leaderboard_visible,
    privacy_settings = excluded.privacy_settings;

  insert into public.squads (
    id, owner_id, name, timezone, min_daily_members, max_members, join_enabled, league_queue_enabled
  )
  values
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Glass Guardians', 'Asia/Singapore', 2, 8, true, true),
    ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'Bottle Brigade', 'Asia/Singapore', 1, 8, true, true),
    ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'Compost Club', 'Asia/Singapore', 1, 8, true, true),
    ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000006', 'The Recyclables', 'Asia/Singapore', 1, 8, true, true),
    ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000007', 'Bin There', 'Asia/Singapore', 1, 8, true, true)
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    timezone = excluded.timezone,
    min_daily_members = excluded.min_daily_members,
    max_members = excluded.max_members,
    join_enabled = excluded.join_enabled,
    league_queue_enabled = excluded.league_queue_enabled;

  insert into public.squad_members (squad_id, profile_id, role, status, joined_at, left_at)
  values
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner', 'active', now() - interval '30 days', null),
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'member', 'active', now() - interval '25 days', null),
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'member', 'active', now() - interval '20 days', null),
    ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'owner', 'active', now() - interval '30 days', null),
    ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'owner', 'active', now() - interval '30 days', null),
    ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000006', 'owner', 'active', now() - interval '30 days', null),
    ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000007', 'owner', 'active', now() - interval '30 days', null)
  on conflict (squad_id, profile_id) do update set
    role = excluded.role,
    status = excluded.status,
    joined_at = excluded.joined_at,
    left_at = excluded.left_at;

  insert into public.squad_invites (
    id, squad_id, token_hash, created_by, expires_at, max_uses, use_count, revoked_at, created_at
  )
  values (
    'b1000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    encode(digest('ECO123', 'sha256'), 'hex'),
    'a0000000-0000-4000-8000-000000000001',
    now() + interval '30 days',
    8,
    0,
    null,
    now()
  )
  on conflict (id) do update set
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    max_uses = excluded.max_uses,
    use_count = 0,
    revoked_at = null;

  -- Keep all five catalog rows, but make the reset-time demo task universal.
  update public.task_catalog
  set active = (id = 'recycle-plastic-bottle')
  where locale = 'en-SG';

  insert into public.mission_catalog (id, title, theme, target, active)
  values
    ('glass-guardians', 'Glass Guardians', 'Glass', 20, true),
    ('landfill-monster', 'Defeat the Landfill Monster', 'Waste reduction', 25, true),
    ('plastic-patrol', 'Plastic Patrol', 'Plastic', 20, true)
  on conflict (id) do update set
    title = excluded.title,
    theme = excluded.theme,
    target = excluded.target,
    active = excluded.active;

  update public.mission_catalog
  set target = 50, active = true
  where id = 'glass-guardians';

  insert into public.squad_daily_missions (
    id, squad_id, mission_id, mission_day, progress, completed_at, created_at
  )
  values (
    'b2000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'glass-guardians',
    v_day,
    25,
    null,
    now()
  )
  on conflict (squad_id, mission_day) do update set
    mission_id = excluded.mission_id,
    progress = 25,
    completed_at = null;

  insert into public.user_daily_tasks (profile_id, task_day, timezone, task_id)
  values ('a0000000-0000-4000-8000-000000000002', v_day, 'Asia/Singapore', 'recycle-plastic-bottle')
  on conflict (profile_id, task_day) do update set
    timezone = excluded.timezone,
    task_id = excluded.task_id;

  insert into public.submissions (
    id, profile_id, squad_id, challenge_id, image_path, task_id, task_day,
    model_result, user_bin, final_bin, confidence, verification_status, behavior_status, behavior_confirmed_at, points,
    result_payload, idempotency_key, matches_task, validation_reason, league_id,
    submitted_at, created_at
  )
  values (
    'd0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    null,
    null,
    'recycle-plastic-bottle',
    v_day,
    v_classification,
    'recycle',
    'recycle',
    0.860,
    'verified',
    'confirmed',
    v_submission_at,
    25,
    jsonb_build_object(
      'submissionId', 'd0000000-0000-4000-8000-000000000001',
      'scanEventId', 'd0000000-0000-4000-8000-000000000001',
      'taskId', 'recycle-plastic-bottle',
      'taskDay', v_day,
      'classification', v_classification,
      'outcome', 'completed',
      'validated', true,
      'photoValidated', true,
      'behaviorCheckIn', jsonb_build_object('action', 'recycle_bottle', 'status', 'confirmed', 'selfReported', true, 'confirmedAt', v_submission_at),
      'awarded', jsonb_build_array(
        jsonb_build_object('actionType', 'action_completed', 'points', 10),
        jsonb_build_object('actionType', 'prep_step', 'points', 5),
        jsonb_build_object('actionType', 'daily_first', 'points', 10)
      ),
      'points', jsonb_build_object('actionCompletion', 10, 'preparation', 5, 'dailyBonus', 10, 'total', 25),
      'streak', jsonb_build_object('current', 6, 'longest', 7),
      'duplicate', false
    ),
    'seed-noah-bottle-' || v_day::text,
    true,
    'The demo image matches the assigned bottle task.',
    null,
    v_submission_at,
    v_submission_at
  )
  on conflict (id) do update set
    task_id = excluded.task_id,
    task_day = excluded.task_day,
    model_result = excluded.model_result,
    user_bin = excluded.user_bin,
    final_bin = excluded.final_bin,
    confidence = excluded.confidence,
    verification_status = excluded.verification_status,
    behavior_status = excluded.behavior_status,
    behavior_confirmed_at = excluded.behavior_confirmed_at,
    points = excluded.points,
    result_payload = excluded.result_payload,
    idempotency_key = excluded.idempotency_key,
    matches_task = excluded.matches_task,
    validation_reason = excluded.validation_reason,
    submitted_at = excluded.submitted_at,
    created_at = excluded.created_at;

  insert into public.score_events (
    id, profile_id, squad_id, contest_id, submission_id, action_type, points,
    scoring_rule_version, occurred_at
  )
  values
    ('d1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null, 'd0000000-0000-4000-8000-000000000001', 'action_completed', 10, 'mvp-v1', v_submission_at),
    ('d1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null, 'd0000000-0000-4000-8000-000000000001', 'prep_step', 5, 'mvp-v1', v_submission_at),
    ('d1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null, 'd0000000-0000-4000-8000-000000000001', 'daily_first', 10, 'mvp-v1', v_submission_at)
  on conflict (submission_id, action_type) do update set
    points = excluded.points,
    scoring_rule_version = excluded.scoring_rule_version,
    occurred_at = excluded.occurred_at;

  insert into public.daily_progress (
    profile_id, squad_id, progress_day, verified_actions, points, first_completed_at, updated_at
  )
  values ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', v_day, 1, 25, v_submission_at, now())
  on conflict (profile_id, squad_id, progress_day) do update set
    verified_actions = 1,
    points = 25,
    first_completed_at = excluded.first_completed_at,
    updated_at = now();

  insert into public.user_streaks (profile_id, current_streak, longest_streak, last_completed_day, updated_at)
  values ('a0000000-0000-4000-8000-000000000002', 6, 7, v_day, now())
  on conflict (profile_id) do update set
    current_streak = 6,
    longest_streak = 7,
    last_completed_day = v_day,
    updated_at = now();

  insert into public.squad_streaks (squad_id, current_streak, repair_tokens, last_completed_day, updated_at)
  values ('b0000000-0000-4000-8000-000000000001', 4, 1, v_day - 1, now())
  on conflict (squad_id) do update set
    current_streak = 4,
    repair_tokens = 1,
    last_completed_day = v_day - 1,
    updated_at = now();

  insert into public.crew_daily_streaks (
    squad_id, streak_day, total_members, completed_members, required_members, qualified, created_at
  )
  values ('b0000000-0000-4000-8000-000000000001', v_day, 3, 1, 2, false, now())
  on conflict (squad_id, streak_day) do update set
    total_members = 3,
    completed_members = 1,
    required_members = 2,
    qualified = false;

  insert into public.profile_progress (profile_id, lifetime_xp, updated_at)
  values
    ('a0000000-0000-4000-8000-000000000001', 100, now()),
    ('a0000000-0000-4000-8000-000000000002', 25, now()),
    ('a0000000-0000-4000-8000-000000000003', 50, now())
  on conflict (profile_id) do update set
    lifetime_xp = excluded.lifetime_xp,
    updated_at = now();

  insert into public.profile_inventory (profile_id, cosmetic_id, unlocked_at, equipped)
  values
    ('a0000000-0000-4000-8000-000000000001', 'leaf-frame', now() - interval '2 days', true),
    ('a0000000-0000-4000-8000-000000000002', 'leaf-frame', now() - interval '1 day', true),
    ('a0000000-0000-4000-8000-000000000003', 'leaf-frame', now() - interval '3 days', false),
    ('a0000000-0000-4000-8000-000000000003', 'sprout-badge', now() - interval '2 days', false)
  on conflict (profile_id, cosmetic_id) do update set
    unlocked_at = excluded.unlocked_at,
    equipped = excluded.equipped;

  insert into public.crew_progression (squad_id, lifetime_xp, updated_at)
  values ('b0000000-0000-4000-8000-000000000001', 25, now())
  on conflict (squad_id) do update set
    lifetime_xp = 25,
    updated_at = now();

  insert into public.crew_cosmetics (squad_id, cosmetic_id, unlocked_at)
  values ('b0000000-0000-4000-8000-000000000001', 'leaf-frame', now() - interval '1 day')
  on conflict (squad_id, cosmetic_id) do update set
    unlocked_at = excluded.unlocked_at;

  insert into public.crew_cosmetic_equipment (squad_id, profile_id, cosmetic_id, equipped_at)
  values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'leaf-frame', now() - interval '1 day')
  on conflict (squad_id, profile_id, cosmetic_id) do update set
    equipped_at = excluded.equipped_at;

  insert into public.profile_posts (
    id, submission_id, profile_id, squad_id, visibility, image_visible, deleted_at, created_at
  )
  values (
    'd2000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    'crew',
    false,
    null,
    v_submission_at
  )
  on conflict (submission_id) do update set
    profile_id = excluded.profile_id,
    squad_id = excluded.squad_id,
    visibility = excluded.visibility,
    image_visible = excluded.image_visible,
    deleted_at = null,
    created_at = excluded.created_at;

  insert into public.activity_events (id, squad_id, actor_id, post_id, event_type, payload, created_at)
  values
    ('d3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'submission', '{"message":"Noah sorted a plastic bottle correctly","points":25}'::jsonb, v_submission_at),
    ('d3000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', null, 'streak', '{"message":"Maya helped protect the crew streak","streakDays":4}'::jsonb, now() - interval '2 hours'),
    ('d3000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', null, 'unlock', '{"message":"Ari unlocked the Leaf Frame","cosmeticId":"leaf-frame"}'::jsonb, now() - interval '1 day')
  on conflict (id) do update set
    actor_id = excluded.actor_id,
    post_id = excluded.post_id,
    event_type = excluded.event_type,
    payload = excluded.payload,
    created_at = excluded.created_at;

  insert into public.activity_reactions (activity_id, profile_id, emoji)
  values
    ('d3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '👏'),
    ('d3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', '🔥'),
    ('d3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', '🔥'),
    ('d3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', '👏')
  on conflict (activity_id, profile_id, emoji) do nothing;

  update public.task_catalog
  set
    title = 'Clean Bottle Check',
    instruction = 'Empty a single-use plastic bottle, recycle it, and take a photo to confirm the action.',
    prompt = 'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    locale_rule_version = 'sg-demo-v1'
  where id = 'recycle-plastic-bottle';

  insert into public.measurement_checks (
    id, profile_id, phase, scenario_id, selected_bin, prep_confirmed,
    validated, prompt_similarity, self_reported, action_confirmed, is_demo, completed_at
  )
  values
    ('e4000000-0000-4000-8000-000000000001', null, 'baseline', 'bottle-1', 'recycle', true, true, .82, true, true, true, now() - interval '8 days'),
    ('e4000000-0000-4000-8000-000000000002', null, 'baseline', 'bottle-2', 'landfill', false, false, .41, false, false, true, now() - interval '8 days'),
    ('e4000000-0000-4000-8000-000000000003', null, 'baseline', 'bottle-3', 'recycle', false, false, .54, false, false, true, now() - interval '8 days'),
    ('e4000000-0000-4000-8000-000000000004', null, 'baseline', 'bottle-4', 'compost', false, false, .28, false, false, true, now() - interval '8 days'),
    ('e4000000-0000-4000-8000-000000000005', null, 'follow_up', 'bottle-1', 'recycle', true, true, .95, true, true, true, now() - interval '1 day'),
    ('e4000000-0000-4000-8000-000000000006', null, 'follow_up', 'bottle-2', 'recycle', true, true, .93, true, true, true, now() - interval '1 day'),
    ('e4000000-0000-4000-8000-000000000007', null, 'follow_up', 'bottle-3', 'landfill', false, false, .62, false, false, true, now() - interval '1 day'),
    ('e4000000-0000-4000-8000-000000000008', null, 'follow_up', 'bottle-4', 'recycle', true, true, .91, true, true, true, now() - interval '1 day')
  on conflict (id) do update set
    phase = excluded.phase,
    selected_bin = excluded.selected_bin,
    prep_confirmed = excluded.prep_confirmed,
    validated = excluded.validated,
    prompt_similarity = excluded.prompt_similarity,
    self_reported = excluded.self_reported,
    action_confirmed = excluded.action_confirmed,
    is_demo = excluded.is_demo,
    completed_at = excluded.completed_at;

  insert into public.leagues (
    id, owner_squad_id, name, starts_at, ends_at, max_squads, status, week_key, matched_at
  )
  values (
    'c0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'Glass Guardians Weekly League',
    v_week_start_at,
    v_week_start_at + interval '7 days',
    5,
    'active',
    v_week_start,
    now()
  )
  on conflict (id) do update set
    owner_squad_id = excluded.owner_squad_id,
    name = excluded.name,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    max_squads = excluded.max_squads,
    status = excluded.status,
    week_key = excluded.week_key,
    matched_at = excluded.matched_at,
    finalized_at = null;

  insert into public.league_entries (league_id, squad_id, score, joined_at, final_rank, streak_days, streak_multiplier)
  values
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 745, now() - interval '4 days', null, 0, 0),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 910, now() - interval '4 days', null, 0, 0),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 835, now() - interval '4 days', null, 0, 0),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 790, now() - interval '4 days', null, 0, 0),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 710, now() - interval '4 days', null, 0, 0)
  on conflict (league_id, squad_id) do update set
    score = excluded.score,
    joined_at = excluded.joined_at,
    final_rank = null,
    streak_days = 0,
    streak_multiplier = 0;

  if not exists (
    select 1
    from public.leagues
    where id = 'c0000000-0000-4000-8000-000000000001'
      and owner_squad_id = 'b0000000-0000-4000-8000-000000000001'
      and name = 'Glass Guardians Weekly League'
      and starts_at = v_week_start_at
      and ends_at = v_week_start_at + interval '7 days'
      and max_squads = 5
      and status = 'active'
      and week_key = v_week_start
  ) then
    raise exception 'Seed assertion failed: current Glass Guardians league is missing';
  end if;
  if (
    select count(*)
    from public.league_entries
    where league_id = 'c0000000-0000-4000-8000-000000000001'
  ) <> 5 then
    raise exception 'Seed assertion failed: current league entries are incomplete';
  end if;
  if not exists (
    select 1
    from public.league_entries
    where league_id = 'c0000000-0000-4000-8000-000000000001'
      and squad_id = 'b0000000-0000-4000-8000-000000000001'
      and score = 745
  ) then
    raise exception 'Seed assertion failed: Glass Guardians league entry is missing';
  end if;
  if exists (
    select 1
    from public.league_entries as entry
    left join public.squads as squad on squad.id = entry.squad_id
    where entry.league_id = 'c0000000-0000-4000-8000-000000000001'
      and squad.id is null
  ) then
    raise exception 'Seed assertion failed: current league has an unknown crew';
  end if;
  if (
    select count(*)
    from public.activity_events
    where id in (
      'd3000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000002',
      'd3000000-0000-4000-8000-000000000003'
    )
      and squad_id = 'b0000000-0000-4000-8000-000000000001'
  ) <> 3 then
    raise exception 'Seed assertion failed: Glass Guardians activity messages are incomplete';
  end if;
  if exists (
    select 1
    from public.activity_events
    where squad_id in (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000004',
      'b0000000-0000-4000-8000-000000000005'
    )
  ) then
    raise exception 'Seed assertion failed: fixture activity leaked outside Glass Guardians';
  end if;

  if not exists (
    select 1
    from public.squads
    where id = 'b0000000-0000-4000-8000-000000000001'
      and name = 'Glass Guardians'
  ) then
    raise exception 'Seed assertion failed: Glass Guardians crew is missing';
  end if;
  if (
    select count(*)
    from public.squad_members
    where squad_id = 'b0000000-0000-4000-8000-000000000001'
      and status = 'active'
  ) <> 3 then
    raise exception 'Seed assertion failed: Glass Guardians active members are incomplete';
  end if;
  if not exists (
    select 1
    from public.squad_invites
    where id = 'b1000000-0000-4000-8000-000000000001'
      and squad_id = 'b0000000-0000-4000-8000-000000000001'
      and token_hash = encode(digest('ECO123', 'sha256'), 'hex')
      and revoked_at is null
  ) then
    raise exception 'Seed assertion failed: ECO123 invite is missing';
  end if;
  if not exists (
    select 1
    from public.mission_catalog
    where id = 'glass-guardians' and active
  ) then
    raise exception 'Seed assertion failed: Glass Guardians mission catalog row is missing';
  end if;
  if not exists (
    select 1
    from public.squad_daily_missions
    where squad_id = 'b0000000-0000-4000-8000-000000000001'
      and mission_id = 'glass-guardians'
      and mission_day = v_day
  ) then
    raise exception 'Seed assertion failed: Glass Guardians daily mission is missing';
  end if;
end;
$$;
