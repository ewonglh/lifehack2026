-- Per-user task gameplay, crew progression, automatic leagues, streaks, avatars,
-- and privacy-safe contact leaderboards.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists timezone text not null default 'Asia/Singapore',
  add column if not exists leaderboard_visible boolean not null default true;

alter table public.squads
  add column if not exists league_queue_enabled boolean not null default true;

create table if not exists public.task_catalog (
  id text primary key,
  prompt text not null check (char_length(prompt) between 8 and 240),
  locale text not null default 'en-SG',
  target_object text not null check (char_length(target_object) between 2 and 80),
  target_material text,
  target_action text not null check (target_action in ('recycle', 'compost', 'reuse_return', 'landfill')),
  validation_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_metadata) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists task_catalog_active_locale_idx
  on public.task_catalog (locale, id)
  where active;

create table if not exists public.user_daily_tasks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_day date not null,
  timezone text not null,
  task_id text not null references public.task_catalog(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (profile_id, task_day)
);

create index if not exists user_daily_tasks_task_idx
  on public.user_daily_tasks (task_id, task_day);

alter table public.submissions
  alter column squad_id drop not null,
  alter column challenge_id drop not null,
  alter column image_path drop not null;

alter table public.submissions
  add column if not exists task_id text references public.task_catalog(id) on delete restrict,
  add column if not exists task_day date,
  add column if not exists matches_task boolean,
  add column if not exists validation_reason text,
  add column if not exists league_id uuid references public.leagues(id) on delete set null,
  add column if not exists submitted_at timestamptz not null default now();

create index if not exists submissions_task_day_idx
  on public.submissions (profile_id, task_day, verification_status);
create index if not exists submissions_league_day_idx
  on public.submissions (league_id, squad_id, submitted_at);
create unique index if not exists submissions_one_verified_task_per_day_idx
  on public.submissions (profile_id, task_day)
  where task_id is not null and verification_status = 'verified';

create table if not exists public.user_streaks (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_completed_day date,
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_daily_streaks (
  squad_id uuid not null references public.squads(id) on delete cascade,
  streak_day date not null,
  total_members integer not null check (total_members >= 0),
  completed_members integer not null check (completed_members >= 0),
  required_members integer not null check (required_members >= 0),
  qualified boolean not null,
  created_at timestamptz not null default now(),
  primary key (squad_id, streak_day),
  check (completed_members <= total_members),
  check (required_members = ceil(total_members / 2.0))
);

create index if not exists crew_daily_streaks_day_idx
  on public.crew_daily_streaks (squad_id, streak_day desc);

create table if not exists public.crew_progression (
  squad_id uuid primary key references public.squads(id) on delete cascade,
  lifetime_xp numeric(14, 2) not null default 0 check (lifetime_xp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_cosmetics (
  squad_id uuid not null references public.squads(id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_catalog(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  primary key (squad_id, cosmetic_id)
);

create table if not exists public.crew_cosmetic_equipment (
  squad_id uuid not null references public.squads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (squad_id, profile_id, cosmetic_id),
  foreign key (squad_id, cosmetic_id)
    references public.crew_cosmetics(squad_id, cosmetic_id)
    on delete cascade
);

create index if not exists crew_cosmetic_equipment_profile_idx
  on public.crew_cosmetic_equipment (profile_id, squad_id);

alter table public.league_entries
  alter column score type numeric(14, 2) using score::numeric;

alter table public.leagues
  add column if not exists week_key date,
  add column if not exists matched_at timestamptz,
  add column if not exists finalized_at timestamptz;

alter table public.league_entries
  add column if not exists streak_days smallint not null default 0 check (streak_days between 0 and 7),
  add column if not exists streak_multiplier numeric(8, 6) not null default 0 check (streak_multiplier between 0 and 1);

create table if not exists public.league_queue (
  squad_id uuid primary key references public.squads(id) on delete cascade,
  queued_by uuid not null references public.profiles(id) on delete cascade,
  queued_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'matched', 'cancelled')),
  league_id uuid references public.leagues(id) on delete set null,
  constraint league_queue_active_unique unique (squad_id, status)
);

create index if not exists league_queue_ready_idx
  on public.league_queue (queued_at, squad_id)
  where status = 'queued';

create table if not exists public.league_rosters (
  league_id uuid not null references public.leagues(id) on delete cascade,
  squad_id uuid not null references public.squads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, squad_id, profile_id)
);

create index if not exists league_rosters_profile_idx
  on public.league_rosters (league_id, profile_id);

create table if not exists public.league_daily_scores (
  league_id uuid not null references public.leagues(id) on delete cascade,
  squad_id uuid not null references public.squads(id) on delete cascade,
  score_day smallint not null check (score_day between 0 and 6),
  total_members integer not null check (total_members >= 0),
  completed_members integer not null check (completed_members between 0 and total_members),
  daily_score numeric(14, 6) not null check (daily_score >= 0 and daily_score <= 100),
  qualifies_for_streak boolean not null,
  calculated_at timestamptz not null default now(),
  primary key (league_id, squad_id, score_day)
);

create table if not exists public.league_finalizations (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  streak_days smallint not null check (streak_days between 0 and 7),
  streak_multiplier numeric(8, 6) not null check (streak_multiplier between 0 and 1),
  finalized_at timestamptz not null default now()
);

create table if not exists public.contact_sync_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  google_enabled boolean not null default false,
  facebook_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_identifiers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook')),
  identifier_hash text not null check (char_length(identifier_hash) = 64),
  synced_at timestamptz not null default now(),
  primary key (profile_id, provider, identifier_hash)
);

create index if not exists contact_identifiers_lookup_idx
  on public.contact_identifiers (provider, identifier_hash, profile_id);

create table if not exists public.profile_contact_identifiers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook')),
  identifier_hash text not null check (char_length(identifier_hash) = 64),
  primary key (profile_id, provider, identifier_hash)
);

create index if not exists profile_contact_identifiers_lookup_idx
  on public.profile_contact_identifiers (provider, identifier_hash);

create table if not exists public.contact_oauth_states (
  state_hash text primary key check (char_length(state_hash) = 64),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_oauth_states_expiry_idx
  on public.contact_oauth_states (expires_at);

insert into public.task_catalog (id, prompt, target_object, target_material, target_action, validation_metadata)
values
  ('recycle-metal-can', 'Recycle a metal can', 'can', 'metal', 'recycle', '{"aliases":["tin can","aluminium can","aluminum can"]}'),
  ('recycle-plastic-bottle', 'Recycle a plastic drink bottle', 'bottle', 'plastic', 'recycle', '{"aliases":["PET bottle","water bottle"]}'),
  ('compost-food-scraps', 'Compost a serving of food scraps', 'food scraps', 'organic', 'compost', '{"aliases":["leftovers","vegetable scraps"]}'),
  ('reuse-glass-jar', 'Reuse or return a glass jar', 'jar', 'glass', 'reuse_return', '{"aliases":["glass container"]}'),
  ('landfill-contaminated-item', 'Dispose of a contaminated item as landfill waste', 'contaminated item', null, 'landfill', '{"aliases":["soiled packaging"]}')
on conflict (id) do update set
  prompt = excluded.prompt,
  target_object = excluded.target_object,
  target_material = excluded.target_material,
  target_action = excluded.target_action,
  validation_metadata = excluded.validation_metadata,
  active = true;

insert into public.crew_progression (squad_id)
select id from public.squads
on conflict (squad_id) do nothing;

create or replace function private.ensure_crew_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crew_progression(squad_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists squads_create_progression on public.squads;
create trigger squads_create_progression
after insert on public.squads
for each row execute function private.ensure_crew_progression();

create or replace function private.profile_local_day(p_profile_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = p_profile_id),
    'Asia/Singapore'
  ))::date;
$$;

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
  select coalesce(timezone, 'Asia/Singapore') into v_timezone from public.profiles where id = p_actor_id;
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

create or replace function private.update_user_streak(p_actor_id uuid, p_day date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_streak public.user_streaks;
begin
  insert into public.user_streaks(profile_id, current_streak, longest_streak, last_completed_day)
  values (p_actor_id, 1, 1, p_day)
  on conflict (profile_id) do update set
    current_streak = case
      when public.user_streaks.last_completed_day = p_day then public.user_streaks.current_streak
      when public.user_streaks.last_completed_day = p_day - 1 then public.user_streaks.current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      public.user_streaks.longest_streak,
      case
        when public.user_streaks.last_completed_day = p_day then public.user_streaks.current_streak
        when public.user_streaks.last_completed_day = p_day - 1 then public.user_streaks.current_streak + 1
        else 1
      end
    ),
    last_completed_day = greatest(public.user_streaks.last_completed_day, p_day),
    updated_at = now()
  returning * into v_streak;
end;
$$;

create or replace function private.refresh_crew_daily_streak(p_squad_id uuid, p_day date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_total integer;
  v_completed integer;
  v_required integer;
begin
  select timezone into v_timezone from public.squads where id = p_squad_id;
  if not found then return; end if;
  v_start := (p_day::text || ' 00:00:00 ' || v_timezone)::timestamptz;
  v_end := ((p_day + 1)::text || ' 00:00:00 ' || v_timezone)::timestamptz;
  select count(*) into v_total
  from public.squad_members sm
  where sm.squad_id = p_squad_id
    and sm.joined_at < v_end
    and (sm.left_at is null or sm.left_at >= v_start);
  select count(distinct s.profile_id) into v_completed
  from public.submissions s
  join public.squad_members sm on sm.squad_id = p_squad_id and sm.profile_id = s.profile_id
  where s.squad_id = p_squad_id
    and s.task_day = p_day
    and s.verification_status = 'verified'
    and s.submitted_at >= v_start and s.submitted_at < v_end
    and sm.joined_at < v_end
    and (sm.left_at is null or sm.left_at >= v_start);
  v_required := ceil(v_total / 2.0);

  insert into public.crew_daily_streaks(squad_id, streak_day, total_members, completed_members, required_members, qualified)
  values (p_squad_id, p_day, v_total, v_completed, v_required, v_total > 0 and v_completed >= v_required)
  on conflict (squad_id, streak_day) do update set
    total_members = excluded.total_members,
    completed_members = excluded.completed_members,
    required_members = excluded.required_members,
    qualified = excluded.qualified;
end;
$$;

create or replace function public.record_task_submission(
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
  v_squad_id uuid := p_squad_id;
  v_submission public.submissions;
  v_verified boolean := p_matches_task and p_confidence >= 0.75;
  v_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;
  select * into v_assignment
  from public.user_daily_tasks
  where profile_id = p_actor_id and task_day = p_task_day and task_id = p_task_id;
  if not found then raise exception 'DAILY_TASK_MISMATCH' using errcode = 'P0001'; end if;
  if p_task_day <> private.profile_local_day(p_actor_id) then
    raise exception 'DAILY_TASK_EXPIRED' using errcode = 'P0001';
  end if;

  if v_squad_id is not null and not exists (
    select 1 from public.squad_members
    where squad_id = v_squad_id and profile_id = p_actor_id and status = 'active'
  ) then
    raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_submission from public.submissions
  where profile_id = p_actor_id and idempotency_key = p_idempotency_key;
  if found then return coalesce(v_submission.result_payload, jsonb_build_object('submissionId', v_submission.id, 'duplicate', true)); end if;

  if v_verified and exists (
    select 1 from public.submissions
    where profile_id = p_actor_id and task_day = p_task_day and verification_status = 'verified'
  ) then
    v_verified := false;
    p_validation_reason := 'A verified task has already been submitted today.';
  end if;

  insert into public.submissions (
    profile_id, squad_id, challenge_id, image_path, task_id, task_day, model_result,
    user_bin, final_bin, confidence, verification_status, points, result_payload,
    idempotency_key, matches_task, validation_reason, league_id, submitted_at
  )
  values (
    p_actor_id, v_squad_id, null, null, p_task_id, p_task_day, coalesce(p_model_result, '{}'::jsonb),
    coalesce(p_recommended_bin, 'unknown'), coalesce(p_recommended_bin, 'unknown'),
    greatest(0, least(1, p_confidence)), case when v_verified then 'verified' else 'failed' end,
    0, null, p_idempotency_key, v_verified, p_validation_reason, null, now()
  )
  returning * into v_submission;

  if v_verified then
    perform private.update_user_streak(p_actor_id, p_task_day);
    if v_squad_id is not null then
      perform private.refresh_crew_daily_streak(v_squad_id, p_task_day);
      insert into public.activity_events(squad_id, actor_id, event_type, payload)
      values (v_squad_id, p_actor_id, 'submission', jsonb_build_object('taskId', p_task_id, 'taskDay', p_task_day));
    end if;
  end if;

  v_result := jsonb_build_object(
    'submissionId', v_submission.id,
    'taskId', p_task_id,
    'taskDay', p_task_day,
    'validated', v_verified,
    'points', 0,
    'validationReason', p_validation_reason,
    'itemName', p_item_name,
    'material', p_material,
    'recommendedBin', p_recommended_bin,
    'streak', (select jsonb_build_object('current', current_streak, 'longest', longest_streak) from public.user_streaks where profile_id = p_actor_id)
  );
  update public.submissions set result_payload = v_result where id = v_submission.id;
  return v_result;
end;
$$;

create or replace function public.queue_squad_for_league(p_actor_id uuid, p_squad_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_members integer;
  v_queue public.league_queue;
begin
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_actor_id and role = 'owner' and status = 'active') then
    raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001';
  end if;
  select count(*) into v_members from public.squad_members where squad_id = p_squad_id and status = 'active';
  if v_members < 4 then raise exception 'LEAGUE_MINIMUM_MEMBERS' using errcode = 'P0001'; end if;
  if exists (select 1 from public.league_entries le join public.leagues l on l.id = le.league_id where le.squad_id = p_squad_id and l.status = 'active' and l.ends_at > now()) then
    raise exception 'ALREADY_IN_LEAGUE' using errcode = 'P0001';
  end if;
  insert into public.league_queue(squad_id, queued_by, status) values (p_squad_id, p_actor_id, 'queued')
  on conflict (squad_id) do update set status = 'queued', league_id = null, queued_at = now(), queued_by = excluded.queued_by
  returning * into v_queue;
  return jsonb_build_object('squadId', p_squad_id, 'status', v_queue.status, 'queuedAt', v_queue.queued_at);
end;
$$;

create or replace function public.cancel_squad_league_queue(p_actor_id uuid, p_squad_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_actor_id and role = 'owner' and status = 'active') then
    raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001';
  end if;
  update public.league_queue set status = 'cancelled' where squad_id = p_squad_id and status = 'queued';
end;
$$;

create or replace function public.remove_squad_member_for_actor(p_actor_id uuid, p_squad_id uuid, p_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_actor_id and role = 'owner' and status = 'active') or p_actor_id = p_profile_id then
    raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001';
  end if;
  delete from public.crew_cosmetic_equipment where squad_id = p_squad_id and profile_id = p_profile_id;
  update public.squad_members set status = 'removed', left_at = now()
  where squad_id = p_squad_id and profile_id = p_profile_id and status = 'active' and role = 'member';
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.leave_squad_for_actor(p_actor_id uuid, p_squad_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_actor_id and role = 'owner' and status = 'active') then
    raise exception 'OWNER_TRANSFER_REQUIRED' using errcode = 'P0001';
  end if;
  delete from public.crew_cosmetic_equipment where squad_id = p_squad_id and profile_id = p_actor_id;
  update public.squad_members set status = 'left', left_at = now()
  where squad_id = p_squad_id and profile_id = p_actor_id and status = 'active';
  if not found then raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.run_league_matchmaking()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_remaining integer;
  v_group_size integer;
  v_offset integer := 1;
  v_league_id uuid;
  v_owner uuid;
  v_week date := date_trunc('week', now() at time zone 'UTC')::date;
  v_cutoff timestamptz := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ecocrew-league-matchmaking', 0));
  select array_agg(squad_id order by md5(squad_id::text || clock_timestamp()::text)) into v_ids
  from public.league_queue q
  join public.squads s on s.id = q.squad_id and s.league_queue_enabled
  where q.status = 'queued'
    and q.queued_at < v_cutoff
    and (select count(*) from public.squad_members sm where sm.squad_id = q.squad_id and sm.status = 'active') >= 4;
  v_remaining := coalesce(array_length(v_ids, 1), 0);
  while v_remaining >= 6 loop
    v_group_size := least(11, v_remaining);
    if v_remaining - v_group_size between 1 and 5 then
      v_group_size := v_group_size - (6 - (v_remaining - v_group_size));
    end if;
    v_owner := v_ids[v_offset];
    insert into public.leagues(name, owner_squad_id, starts_at, ends_at, max_squads, status, week_key, matched_at)
    values ('EcoCrew League ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD'), v_owner, now(), now() + interval '7 days', v_group_size, 'active', v_week, now())
    returning id into v_league_id;
    insert into public.league_entries(league_id, squad_id)
    select v_league_id, unnest(v_ids[v_offset:v_offset + v_group_size - 1]);
    insert into public.league_rosters(league_id, squad_id, profile_id)
    select v_league_id, sm.squad_id, sm.profile_id
    from public.squad_members sm
    where sm.squad_id = any(v_ids[v_offset:v_offset + v_group_size - 1]) and sm.status = 'active';
    update public.league_queue set status = 'matched', league_id = v_league_id where squad_id = any(v_ids[v_offset:v_offset + v_group_size - 1]) and status = 'queued';
    v_offset := v_offset + v_group_size;
    v_remaining := v_remaining - v_group_size;
  end loop;
  return coalesce(v_offset - 1, 0);
end;
$$;

create or replace function public.finalize_league(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues;
  v_entry record;
  v_day integer;
  v_total integer;
  v_completed integer;
  v_daily numeric;
  v_sum numeric;
  v_streak_days integer;
  v_multiplier numeric;
  v_final numeric;
  v_cosmetic_id text;
begin
  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'LEAGUE_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists (select 1 from public.league_finalizations where league_id = p_league_id) then
    return jsonb_build_object('leagueId', p_league_id, 'finalized', true, 'duplicate', true);
  end if;
  if v_league.ends_at > now() then raise exception 'LEAGUE_NOT_ENDED' using errcode = 'P0001'; end if;

  for v_entry in select league_id, squad_id from public.league_entries where league_id = p_league_id loop
    v_sum := 0;
    v_streak_days := 0;
    for v_day in 0..6 loop
      select count(distinct r.profile_id), count(distinct s.profile_id)
      into v_total, v_completed
      from public.league_rosters r
      left join public.submissions s on s.profile_id = r.profile_id
        and s.squad_id = r.squad_id
        and s.verification_status = 'verified'
        and s.submitted_at >= v_league.starts_at + (v_day * interval '1 day')
        and s.submitted_at < v_league.starts_at + ((v_day + 1) * interval '1 day')
      where r.league_id = p_league_id and r.squad_id = v_entry.squad_id;
      v_daily := case when v_total = 0 then 0 else 100.0 * v_completed / v_total end;
      if v_completed >= ceil(v_total / 2.0) and v_total > 0 then v_streak_days := v_streak_days + 1; end if;
      v_sum := v_sum + v_daily;
      insert into public.league_daily_scores(league_id, squad_id, score_day, total_members, completed_members, daily_score, qualifies_for_streak)
      values (p_league_id, v_entry.squad_id, v_day, v_total, v_completed, v_daily, v_completed >= ceil(v_total / 2.0) and v_total > 0)
      on conflict (league_id, squad_id, score_day) do update set
        total_members = excluded.total_members,
        completed_members = excluded.completed_members,
        daily_score = excluded.daily_score,
        qualifies_for_streak = excluded.qualifies_for_streak,
        calculated_at = now();
    end loop;
    v_multiplier := v_streak_days / 7.0;
    v_final := v_sum * v_multiplier;
    update public.league_entries
    set score = v_final, streak_days = v_streak_days, streak_multiplier = v_multiplier
    where league_id = p_league_id and squad_id = v_entry.squad_id;
    insert into public.crew_progression(squad_id) values(v_entry.squad_id) on conflict do nothing;
    update public.crew_progression set lifetime_xp = lifetime_xp + v_final, updated_at = now() where squad_id = v_entry.squad_id;
    insert into public.activity_events(squad_id, actor_id, event_type, payload)
    select v_entry.squad_id, s.owner_id, 'league', jsonb_build_object('leagueId', p_league_id, 'finalScore', v_final, 'streakDays', v_streak_days)
    from public.squads s where s.id = v_entry.squad_id;
    if v_streak_days > 0 then
      insert into public.activity_events(squad_id, actor_id, event_type, payload)
      select v_entry.squad_id, s.owner_id, 'streak', jsonb_build_object('leagueId', p_league_id, 'streakDays', v_streak_days)
      from public.squads s where s.id = v_entry.squad_id;
    end if;
    for v_cosmetic_id in
      insert into public.crew_cosmetics(squad_id, cosmetic_id)
      select v_entry.squad_id, c.id from public.cosmetic_catalog c
      join public.crew_progression cp on cp.squad_id = v_entry.squad_id
      where c.active and c.unlock_xp <= cp.lifetime_xp on conflict do nothing
      returning cosmetic_id
    loop
      insert into public.activity_events(squad_id, actor_id, event_type, payload)
      select v_entry.squad_id, s.owner_id, 'unlock', jsonb_build_object('leagueId', p_league_id, 'cosmeticId', v_cosmetic_id)
      from public.squads s where s.id = v_entry.squad_id;
    end loop;
  end loop;

  with ranked as (
    select squad_id, dense_rank() over (order by score desc, squad_id) as final_rank
    from public.league_entries where league_id = p_league_id
  )
  update public.league_entries le set final_rank = ranked.final_rank from ranked where le.league_id = p_league_id and le.squad_id = ranked.squad_id;
  insert into public.league_finalizations(league_id, streak_days, streak_multiplier)
  select p_league_id, coalesce(summary.streak_days, 0), coalesce(summary.streak_multiplier, 0)
  from (select max(streak_days) as streak_days, max(streak_multiplier) as streak_multiplier
        from public.league_entries where league_id = p_league_id) summary;
  update public.leagues set status = 'closed', finalized_at = now() where id = p_league_id;
  return jsonb_build_object('leagueId', p_league_id, 'finalized', true);
end;
$$;

create or replace function public.equip_crew_cosmetic_for_actor(p_actor_id uuid, p_cosmetic_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_squad_id uuid;
begin
  select squad_id into v_squad_id from public.squad_members where profile_id = p_actor_id and status = 'active';
  if v_squad_id is null then raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.crew_cosmetics where squad_id = v_squad_id and cosmetic_id = p_cosmetic_id) then
    raise exception 'COSMETIC_NOT_OWNED' using errcode = 'P0001';
  end if;
  delete from public.crew_cosmetic_equipment where squad_id = v_squad_id and profile_id = p_actor_id;
  insert into public.crew_cosmetic_equipment(squad_id, profile_id, cosmetic_id) values (v_squad_id, p_actor_id, p_cosmetic_id);
end;
$$;

create or replace function public.save_profile_for_actor(
  p_actor_id uuid,
  p_display_name text,
  p_handle text,
  p_about text,
  p_location text,
  p_timezone text,
  p_age_visibility text,
  p_leaderboard_visible boolean,
  p_avatar_path text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 40 then raise exception 'INVALID_PROFILE' using errcode = '22023'; end if;
  if p_handle is not null and p_handle !~ '^@[a-zA-Z0-9._]{2,29}$' then raise exception 'INVALID_HANDLE' using errcode = '22023'; end if;
  if char_length(coalesce(p_about, '')) > 280 or char_length(coalesce(p_location, '')) > 80 or coalesce(p_age_visibility, 'private') not in ('private', 'crew', 'public') then raise exception 'INVALID_PROFILE' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = coalesce(p_timezone, 'Asia/Singapore')) then raise exception 'INVALID_TIMEZONE' using errcode = '22023'; end if;
  update public.profiles set
    display_name = trim(p_display_name),
    handle = nullif(lower(trim(p_handle)), ''),
    about = coalesce(p_about, ''),
    location = coalesce(nullif(trim(p_location), ''), 'Singapore'),
    timezone = coalesce(p_timezone, 'Asia/Singapore'),
    age_visibility = coalesce(p_age_visibility, 'private'),
    leaderboard_visible = coalesce(p_leaderboard_visible, true),
    avatar_path = coalesce(p_avatar_path, avatar_path)
  where id = p_actor_id returning * into v_profile;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  return v_profile;
exception when unique_violation then raise exception 'HANDLE_TAKEN' using errcode = 'P0001';
end;
$$;

create or replace function public.get_crew_member_leaderboard(p_actor_id uuid, p_squad_id uuid)
returns table(profile_id uuid, display_name text, avatar_path text, completed_tasks bigint, current_streak integer, rank bigint)
language sql
security invoker
set search_path = ''
as $$
  with members as (
    select p.id, p.display_name, p.avatar_path
    from public.profiles p join public.squad_members sm on sm.profile_id = p.id
    where sm.squad_id = p_squad_id and sm.status = 'active'
  ), stats as (
    select m.*, count(s.id) filter (where s.verification_status = 'verified') as completed_tasks,
      coalesce(us.current_streak, 0) as current_streak
    from members m left join public.submissions s on s.profile_id = m.id and s.squad_id = p_squad_id
    left join public.user_streaks us on us.profile_id = m.id
    group by m.id, m.display_name, m.avatar_path, us.current_streak
  )
  select id, display_name, avatar_path, completed_tasks, current_streak,
    dense_rank() over (order by stats.completed_tasks desc, stats.id) as rank
  from stats
  where exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_actor_id and status = 'active')
  order by rank, display_name;
$$;

create or replace function public.get_contact_leaderboard(p_actor_id uuid)
returns table(profile_id uuid, display_name text, avatar_path text, completed_tasks bigint, current_streak integer, rank bigint)
language sql
security invoker
set search_path = ''
as $$
  with matches as (
    select distinct ci.profile_id
    from public.contact_identifiers mine
    join public.profile_contact_identifiers ci
      on ci.provider = mine.provider and ci.identifier_hash = mine.identifier_hash
    join public.profiles p on p.id = ci.profile_id and p.leaderboard_visible
    where mine.profile_id = p_actor_id and ci.profile_id <> p_actor_id
  ), stats as (
    select p.id, p.display_name, p.avatar_path, count(s.id) filter (where s.verification_status = 'verified') as completed_tasks,
      coalesce(us.current_streak, 0) as current_streak
    from matches m join public.profiles p on p.id = m.profile_id
    left join public.submissions s on s.profile_id = p.id
    left join public.user_streaks us on us.profile_id = p.id
    group by p.id, p.display_name, p.avatar_path, us.current_streak
  )
  select id, display_name, avatar_path, completed_tasks, current_streak,
    dense_rank() over (order by stats.completed_tasks desc, stats.id) as rank
  from stats order by rank, display_name;
$$;

alter table public.task_catalog enable row level security;
alter table public.user_daily_tasks enable row level security;
alter table public.user_streaks enable row level security;
alter table public.crew_daily_streaks enable row level security;
alter table public.crew_progression enable row level security;
alter table public.crew_cosmetics enable row level security;
alter table public.crew_cosmetic_equipment enable row level security;
alter table public.league_queue enable row level security;
alter table public.league_rosters enable row level security;
alter table public.league_daily_scores enable row level security;
alter table public.league_finalizations enable row level security;
alter table public.contact_sync_preferences enable row level security;
alter table public.contact_identifiers enable row level security;
alter table public.profile_contact_identifiers enable row level security;
alter table public.contact_oauth_states enable row level security;

drop policy if exists task_catalog_read on public.task_catalog;
create policy task_catalog_read on public.task_catalog for select to authenticated using (active);
drop policy if exists user_daily_tasks_owner_read on public.user_daily_tasks;
create policy user_daily_tasks_owner_read on public.user_daily_tasks for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists user_streaks_owner_read on public.user_streaks;
create policy user_streaks_owner_read on public.user_streaks for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists crew_streak_members_read on public.crew_daily_streaks;
create policy crew_streak_members_read on public.crew_daily_streaks for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists crew_progression_members_read on public.crew_progression;
create policy crew_progression_members_read on public.crew_progression for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists crew_cosmetics_members_read on public.crew_cosmetics;
create policy crew_cosmetics_members_read on public.crew_cosmetics for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists crew_equipment_owner_read on public.crew_cosmetic_equipment;
create policy crew_equipment_owner_read on public.crew_cosmetic_equipment for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists queue_members_read on public.league_queue;
create policy queue_members_read on public.league_queue for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists roster_members_read on public.league_rosters;
create policy roster_members_read on public.league_rosters for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists daily_scores_members_read on public.league_daily_scores;
create policy daily_scores_members_read on public.league_daily_scores for select to authenticated using (squad_id in (select private.current_squad_ids()));
drop policy if exists finalizations_members_read on public.league_finalizations;
create policy finalizations_members_read on public.league_finalizations for select to authenticated using (exists (
  select 1 from public.league_rosters r
  where r.league_id = league_finalizations.league_id
    and r.profile_id = (select auth.uid())
));
drop policy if exists contact_preferences_owner_read on public.contact_sync_preferences;
create policy contact_preferences_owner_read on public.contact_sync_preferences for select to authenticated using (profile_id = (select auth.uid()));

drop policy if exists avatars_select_owner on storage.objects;
create policy avatars_select_owner on storage.objects for select to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

revoke all on function public.run_league_matchmaking() from public, anon, authenticated;
revoke all on function public.finalize_league(uuid) from public, anon, authenticated;
grant execute on function public.run_league_matchmaking() to service_role;
grant execute on function public.finalize_league(uuid) to service_role;
revoke all on function public.record_task_submission(uuid,text,date,text,jsonb,boolean,numeric,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.queue_squad_for_league(uuid,uuid) from public, anon, authenticated;
revoke all on function public.cancel_squad_league_queue(uuid,uuid) from public, anon, authenticated;
revoke all on function public.equip_crew_cosmetic_for_actor(uuid,text) from public, anon, authenticated;
revoke all on function public.save_profile_for_actor(uuid,text,text,text,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.get_or_assign_daily_task(uuid) to service_role;
grant execute on function public.record_task_submission(uuid,text,date,text,jsonb,boolean,numeric,text,text,text,text,uuid) to service_role;
grant execute on function public.queue_squad_for_league(uuid,uuid) to service_role;
grant execute on function public.cancel_squad_league_queue(uuid,uuid) to service_role;
grant execute on function public.equip_crew_cosmetic_for_actor(uuid,text) to service_role;
grant execute on function public.save_profile_for_actor(uuid,text,text,text,text,text,text,boolean,text) to service_role;
grant execute on function public.get_crew_member_leaderboard(uuid,uuid) to service_role;
grant execute on function public.get_contact_leaderboard(uuid) to service_role;
