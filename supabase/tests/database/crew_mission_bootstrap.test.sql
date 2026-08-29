begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'mission-owner@example.test',
    '{}'::jsonb,
    '{"display_name":"Mission Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'mission-failure@example.test',
    '{}'::jsonb,
    '{"display_name":"Mission Failure"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'mission-joiner@example.test',
    '{}'::jsonb,
    '{"display_name":"Mission Joiner"}'::jsonb,
    now(),
    now()
  );

select ok(
  (select count(*) >= 3 from public.mission_catalog where active),
  'active mission catalog rows are available'
);

select lives_ok(
  $$select public.create_squad_for_actor(
    'e1000000-0000-4000-8000-000000000001',
    'Mission Test Crew',
    'Asia/Singapore'
  )$$,
  'creating a crew succeeds with mission configuration'
);

select is(
  (select count(*)::integer from public.squad_members where profile_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active'),
  1,
  'creating a crew creates exactly one active membership'
);
select is(
  (
    select count(*)::integer
    from public.squad_daily_missions as dm
    join public.squads as s on s.id = dm.squad_id
    where s.owner_id = 'e1000000-0000-4000-8000-000000000001'
      and dm.mission_day = (now() at time zone s.timezone)::date
  ),
  1,
  'creating a crew creates exactly one current-day mission'
);
select ok(
  exists (
    select 1
    from public.squad_daily_missions as dm
    join public.squads as s on s.id = dm.squad_id
    join public.mission_catalog as mc on mc.id = dm.mission_id
    where s.owner_id = 'e1000000-0000-4000-8000-000000000001'
      and dm.mission_day = (now() at time zone s.timezone)::date
      and mc.active
  ),
  'the created current-day mission references an active catalog row'
);

delete from public.squad_daily_missions
where squad_id = (
  select id from public.squads where owner_id = 'e1000000-0000-4000-8000-000000000001'
);
select lives_ok(
  $$select public.get_squad_daily_mission_for_actor(
    'e1000000-0000-4000-8000-000000000001',
    (select id from public.squads where owner_id = 'e1000000-0000-4000-8000-000000000001')
  )$$,
  'the mission getter repairs a squad missing its current-day mission'
);
select ok(
  exists (
    select 1
    from public.squad_daily_missions as dm
    join public.squads as s on s.id = dm.squad_id
    where s.owner_id = 'e1000000-0000-4000-8000-000000000001'
      and dm.mission_day = (now() at time zone s.timezone)::date
  ),
  'lazy repair restores the current-day mission'
);

update public.mission_catalog set active = false;
select throws_ok(
  $$select public.create_squad_for_actor(
    'e1000000-0000-4000-8000-000000000002',
    'Should Roll Back',
    'Asia/Singapore'
  )$$,
  'P0001',
  'MISSION_UNAVAILABLE',
  'missing active mission configuration returns a structured setup error'
);
select ok(
  not exists (select 1 from public.squads where owner_id = 'e1000000-0000-4000-8000-000000000002'),
  'a failed mission setup rolls back the squad row'
);
select ok(
  not exists (select 1 from public.squad_members where profile_id = 'e1000000-0000-4000-8000-000000000002' and status = 'active'),
  'a failed mission setup rolls back the membership row'
);
update public.mission_catalog set active = true;

select ok(
  exists (
    select 1 from public.squads
    where id = 'b0000000-0000-4000-8000-000000000001'
      and name = 'Glass Guardians'
  ),
  'ECO123 points to the seeded Glass Guardians crew'
);
select ok(
  exists (
    select 1
    from public.squad_invites
    where squad_id = 'b0000000-0000-4000-8000-000000000001'
      and token_hash = encode(digest('ECO123', 'sha256'), 'hex')
      and revoked_at is null
  ),
  'ECO123 has the expected active invite hash'
);
select is(
  (select count(*)::integer from public.squad_members where squad_id = 'b0000000-0000-4000-8000-000000000001' and status = 'active'),
  3,
  'Glass Guardians has three active seeded members'
);
select ok(
  exists (select 1 from public.mission_catalog where id = 'glass-guardians' and active),
  'Glass Guardians has an active mission catalog row'
);
select ok(
  exists (
    select 1
    from public.squad_daily_missions
    where squad_id = 'b0000000-0000-4000-8000-000000000001'
      and mission_id = 'glass-guardians'
      and mission_day = (now() at time zone 'Asia/Singapore')::date
  ),
  'Glass Guardians has its seeded current-day mission'
);
select lives_ok(
  $$select public.join_squad_for_actor(
    'e1000000-0000-4000-8000-000000000003',
    encode(digest('ECO123', 'sha256'), 'hex')
  )$$,
  'ECO123 resolves through the join RPC'
);

select * from finish();
rollback;
