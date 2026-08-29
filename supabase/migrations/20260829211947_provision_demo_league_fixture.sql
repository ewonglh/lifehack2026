-- Provision the full weekly-league fixture in the explicitly designated
-- demo/staging project. This migration does not delete or rewrite real-user
-- rows and intentionally creates no activity events for the standings-only
-- crews.

do $$
declare
  v_week_start date := date_trunc('week', now() at time zone 'Asia/Singapore')::date;
  v_week_start_at timestamptz := (
    date_trunc('week', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore'
  );
begin
  if exists (
    select 1
    from auth.users as existing_user
    join (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'maya.seed@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'noah.seed@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'ari.seed@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'bottle.brigade@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000005'::uuid, 'compost.club@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'recyclables@ecocrew.local'::text),
      ('a0000000-0000-4000-8000-000000000007'::uuid, 'bin.there@ecocrew.local'::text)
    ) as fixture_user(id, email) on fixture_user.id = existing_user.id
    where existing_user.email is distinct from fixture_user.email
  ) then
    raise exception 'DEMO_FIXTURE_ID_CONFLICT' using errcode = 'P0001';
  end if;

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

  insert into public.league_entries (
    league_id, squad_id, score, joined_at, final_rank, streak_days, streak_multiplier
  )
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
    raise exception 'DEMO_FIXTURE_ACTIVITY_SCOPE_INVALID' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.league_entries
    where league_id = 'c0000000-0000-4000-8000-000000000001'
  ) <> 5 then
    raise exception 'DEMO_FIXTURE_LEAGUE_ENTRIES_INCOMPLETE' using errcode = 'P0001';
  end if;
end;
$$;
