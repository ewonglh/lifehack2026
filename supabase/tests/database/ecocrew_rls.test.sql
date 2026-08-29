begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

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
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '{}'::jsonb,
    '{"display_name":"Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'member@example.test',
    '{}'::jsonb,
    '{"display_name":"Member"}'::jsonb,
    now(),
    now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '{}'::jsonb,
    '{"display_name":"Outsider"}'::jsonb,
    now(),
    now()
  );

insert into public.squads (id, owner_id, name)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Policy Test Squad'
);

insert into public.squad_members (squad_id, profile_id, role)
values
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'owner'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'member'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select id::text from public.profiles order by id$$,
  array[
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ]::text[],
  'a player sees only profiles in their active squad'
);

select results_eq(
  $$select id::text from public.squads$$,
  array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::text[],
  'a player sees their active squad'
);

select ok(
  not has_table_privilege('authenticated', 'public.score_events', 'INSERT'),
  'authenticated clients cannot write score events directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_verified_sort(uuid,uuid,uuid,text,text,text,jsonb,boolean)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the privileged scoring RPC directly'
);

select * from finish();
rollback;
