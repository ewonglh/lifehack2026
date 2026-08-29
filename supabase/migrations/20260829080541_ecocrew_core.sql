create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_id text,
  frame_id text,
  privacy_settings jsonb not null default '{"shareActivity": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  timezone text not null default 'Asia/Singapore',
  min_daily_members smallint not null default 1 check (min_daily_members between 1 and 8),
  max_members smallint not null default 8 check (max_members between 3 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint squads_min_not_above_max check (min_daily_members <= max_members)
);

create index squads_owner_id_idx on public.squads (owner_id);

create table public.squad_members (
  squad_id uuid not null references public.squads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (squad_id, profile_id),
  constraint squad_members_left_state check (
    (status = 'active' and left_at is null) or (status <> 'active' and left_at is not null)
  )
);

create unique index squad_members_one_active_squad_idx
  on public.squad_members (profile_id)
  where status = 'active';
create index squad_members_active_squad_idx
  on public.squad_members (squad_id, profile_id)
  where status = 'active';
create index squad_members_profile_id_idx on public.squad_members (profile_id);

create table public.squad_invites (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses smallint not null default 1 check (max_uses between 1 and 8),
  use_count smallint not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint squad_invites_uses_within_limit check (use_count <= max_uses),
  constraint squad_invites_expire_after_creation check (expires_at > created_at)
);

create index squad_invites_squad_active_idx
  on public.squad_invites (squad_id, expires_at)
  where revoked_at is null;
create index squad_invites_created_by_idx on public.squad_invites (created_by);

create table public.scoring_rules (
  version text primary key,
  config jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint scoring_rules_config_object check (jsonb_typeof(config) = 'object')
);

create unique index scoring_rules_one_active_idx
  on public.scoring_rules ((active))
  where active;

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  theme text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'closed', 'cancelled')),
  scoring_rule_version text not null references public.scoring_rules (version) on delete restrict,
  created_at timestamptz not null default now(),
  constraint contests_valid_window check (ends_at > starts_at)
);

create index contests_status_window_idx on public.contests (status, starts_at, ends_at);
create index contests_scoring_rule_version_idx on public.contests (scoring_rule_version);

create table public.contest_squads (
  contest_id uuid not null references public.contests (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  league text not null default 'sprout',
  cohort text not null default 'default',
  score integer not null default 0 check (score >= 0),
  final_rank integer check (final_rank is null or final_rank > 0),
  joined_at timestamptz not null default now(),
  primary key (contest_id, squad_id)
);

create index contest_squads_leaderboard_idx
  on public.contest_squads (contest_id, league, cohort, score desc, joined_at);
create index contest_squads_squad_id_idx on public.contest_squads (squad_id);

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_day date not null,
  locale text not null,
  title text not null check (char_length(title) between 2 and 100),
  theme text not null,
  prompt text not null,
  locale_rule_version text not null,
  scoring_rule_version text not null references public.scoring_rules (version) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (challenge_day, locale)
);

create index daily_challenges_active_lookup_idx
  on public.daily_challenges (locale, challenge_day)
  where active;
create index daily_challenges_scoring_rule_version_idx
  on public.daily_challenges (scoring_rule_version);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete restrict,
  challenge_id uuid not null references public.daily_challenges (id) on delete restrict,
  image_path text not null,
  model_result jsonb not null,
  user_bin text not null check (user_bin in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown')),
  final_bin text not null check (final_bin in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown')),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  verification_status text not null check (verification_status in ('verified', 'low_confidence', 'manual', 'failed')),
  points integer not null default 0 check (points >= 0),
  result_payload jsonb,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default now(),
  unique (profile_id, idempotency_key)
);

create index submissions_profile_created_idx on public.submissions (profile_id, created_at desc);
create index submissions_squad_created_idx on public.submissions (squad_id, created_at desc);
create index submissions_challenge_id_idx on public.submissions (challenge_id);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete restrict,
  contest_id uuid references public.contests (id) on delete set null,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  action_type text not null check (action_type in ('correct_sort', 'prep_step', 'daily_first', 'mission', 'streak_bonus', 'participation')),
  points smallint not null check (points > 0),
  scoring_rule_version text not null references public.scoring_rules (version) on delete restrict,
  occurred_at timestamptz not null default now(),
  unique (submission_id, action_type)
);

create index score_events_profile_occurred_idx on public.score_events (profile_id, occurred_at desc);
create index score_events_squad_occurred_idx on public.score_events (squad_id, occurred_at desc);
create index score_events_contest_score_idx on public.score_events (contest_id, squad_id) include (points);
create index score_events_scoring_rule_version_idx on public.score_events (scoring_rule_version);

create table public.daily_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_id uuid not null references public.squads (id) on delete cascade,
  progress_day date not null,
  verified_actions smallint not null default 0 check (verified_actions >= 0),
  points integer not null default 0 check (points >= 0),
  first_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, squad_id, progress_day)
);

create index daily_progress_squad_day_idx on public.daily_progress (squad_id, progress_day, profile_id);

create table public.squad_streaks (
  squad_id uuid primary key references public.squads (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  repair_tokens smallint not null default 1 check (repair_tokens between 0 and 7),
  last_completed_day date,
  updated_at timestamptz not null default now()
);

create table public.edge_rate_limits (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (actor_id, endpoint, window_started_at)
);

create index edge_rate_limits_window_idx on public.edge_rate_limits (window_started_at);

create or replace function private.current_squad_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sm.squad_id
  from public.squad_members as sm
  where sm.profile_id = (select auth.uid())
    and sm.status = 'active';
$$;

create or replace function private.shares_active_squad(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid()) or exists (
    select 1
    from public.squad_members as mine
    join public.squad_members as theirs on theirs.squad_id = mine.squad_id
    where mine.profile_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.profile_id = p_profile_id
      and theirs.status = 'active'
  );
$$;

create or replace function private.visible_contest_squad_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select competitor.squad_id
  from public.contest_squads as competitor
  where competitor.contest_id in (
    select mine.contest_id
    from public.contest_squads as mine
    join public.squad_members as membership on membership.squad_id = mine.squad_id
    where membership.profile_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.current_contest_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select mine.contest_id
  from public.contest_squads as mine
  join public.squad_members as membership on membership.squad_id = mine.squad_id
  where membership.profile_id = (select auth.uid())
    and membership.status = 'active';
$$;

revoke execute on function private.current_squad_ids() from public, anon, authenticated;
revoke execute on function private.shares_active_squad(uuid) from public, anon, authenticated;
revoke execute on function private.visible_contest_squad_ids() from public, anon, authenticated;
revoke execute on function private.current_contest_ids() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_squad_ids() to authenticated;
grant execute on function private.shares_active_squad(uuid) to authenticated;
grant execute on function private.visible_contest_squad_ids() to authenticated;
grant execute on function private.current_contest_ids() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger squads_set_updated_at
before update on public.squads
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Eco player'), '@', 1)), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, display_name)
select
  users.id,
  left(
    coalesce(
      nullif(users.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(users.email, 'Eco player'), '@', 1)
    ),
    40
  )
from auth.users as users
on conflict (id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.create_squad_for_actor(
  p_actor_id uuid,
  p_name text,
  p_timezone text default 'Asia/Singapore'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_squad_id uuid;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if char_length(trim(p_name)) not between 2 and 60 then
    raise exception 'INVALID_SQUAD_NAME' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text, 0));
  if exists (
    select 1 from public.squad_members
    where profile_id = p_actor_id and status = 'active'
  ) then
    raise exception 'ALREADY_IN_SQUAD' using errcode = 'P0001';
  end if;

  insert into public.squads (owner_id, name, timezone)
  values (p_actor_id, trim(p_name), p_timezone)
  returning id into v_squad_id;

  insert into public.squad_members (squad_id, profile_id, role)
  values (v_squad_id, p_actor_id, 'owner');

  insert into public.squad_streaks (squad_id) values (v_squad_id);
  return v_squad_id;
end;
$$;

create or replace function public.create_squad_invite_for_actor(
  p_actor_id uuid,
  p_squad_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_max_uses smallint default 1
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite_id uuid;
begin
  if not exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id
      and profile_id = p_actor_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INVITE_TOKEN' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'INVALID_INVITE_EXPIRY' using errcode = '22023';
  end if;

  insert into public.squad_invites (squad_id, token_hash, created_by, expires_at, max_uses)
  values (p_squad_id, p_token_hash, p_actor_id, p_expires_at, p_max_uses)
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create or replace function public.join_squad_for_actor(
  p_actor_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.squad_invites%rowtype;
  v_squad public.squads%rowtype;
  v_member_count integer;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text, 0));

  select * into v_invite
  from public.squad_invites
  where token_hash = p_token_hash
  for update;

  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now()
    or v_invite.use_count >= v_invite.max_uses then
    raise exception 'INVITE_INVALID_OR_EXPIRED' using errcode = 'P0001';
  end if;

  select * into v_squad from public.squads where id = v_invite.squad_id for update;
  if exists (
    select 1 from public.squad_members
    where profile_id = p_actor_id and status = 'active'
  ) then
    raise exception 'ALREADY_IN_SQUAD' using errcode = 'P0001';
  end if;

  select count(*) into v_member_count
  from public.squad_members
  where squad_id = v_squad.id and status = 'active';
  if v_member_count >= v_squad.max_members then
    raise exception 'SQUAD_FULL' using errcode = 'P0001';
  end if;

  insert into public.squad_members (squad_id, profile_id, role, status, joined_at, left_at)
  values (v_squad.id, p_actor_id, 'member', 'active', now(), null)
  on conflict (squad_id, profile_id) do update
    set role = 'member', status = 'active', joined_at = now(), left_at = null;

  update public.squad_invites set use_count = use_count + 1 where id = v_invite.id;
  return v_squad.id;
end;
$$;

create or replace function public.enter_contest_for_actor(
  p_actor_id uuid,
  p_squad_id uuid,
  p_contest_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id and profile_id = p_actor_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.contests
    where id = p_contest_id and status in ('scheduled', 'active') and now() < ends_at
  ) then
    raise exception 'CONTEST_NOT_OPEN' using errcode = 'P0001';
  end if;

  insert into public.contest_squads (contest_id, squad_id)
  values (p_contest_id, p_squad_id)
  on conflict (contest_id, squad_id) do nothing;
end;
$$;

create or replace function public.record_verified_sort(
  p_actor_id uuid,
  p_squad_id uuid,
  p_challenge_id uuid,
  p_idempotency_key text,
  p_image_path text,
  p_user_bin text,
  p_classification jsonb,
  p_preparation_confirmed boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.submissions%rowtype;
  v_squad public.squads%rowtype;
  v_challenge public.daily_challenges%rowtype;
  v_rule jsonb;
  v_day date;
  v_submission_id uuid;
  v_contest_id uuid;
  v_confidence numeric;
  v_recommended_bin text;
  v_status text;
  v_daily_actions integer := 0;
  v_daily_points integer := 0;
  v_points integer := 0;
  v_awards jsonb := '[]'::jsonb;
  v_award integer;
  v_member_completions integer;
  v_streak_status text := 'not_qualified';
  v_streak public.squad_streaks%rowtype;
  v_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;
  if p_user_bin not in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown') then
    raise exception 'INVALID_BIN' using errcode = '22023';
  end if;
  if p_image_path !~ ('^' || p_actor_id::text || '/[^/]+') then
    raise exception 'INVALID_IMAGE_PATH' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key, 0)
  );

  select * into v_existing
  from public.submissions
  where profile_id = p_actor_id and idempotency_key = p_idempotency_key;
  if found then
    return coalesce(
      v_existing.result_payload,
      jsonb_build_object(
        'submissionId', v_existing.id,
        'classification', v_existing.model_result,
        'outcome', v_existing.verification_status,
        'awarded', '[]'::jsonb,
        'points', v_existing.points
      )
    ) || jsonb_build_object('duplicate', true);
  end if;

  select s.* into v_squad
  from public.squads as s
  join public.squad_members as sm on sm.squad_id = s.id
  where s.id = p_squad_id and sm.profile_id = p_actor_id and sm.status = 'active'
  for update of s;
  if not found then
    raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_challenge from public.daily_challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'DAILY_CHALLENGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_day := (now() at time zone v_squad.timezone)::date;
  if v_challenge.challenge_day <> v_day then
    raise exception 'DAILY_CHALLENGE_EXPIRED' using errcode = 'P0001';
  end if;

  select config into v_rule from public.scoring_rules where version = v_challenge.scoring_rule_version;
  v_confidence := (p_classification ->> 'confidence')::numeric;
  v_recommended_bin := p_classification ->> 'recommendedBin';
  if v_confidence is null or v_confidence < 0 or v_confidence > 1
    or v_recommended_bin not in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown') then
    raise exception 'INVALID_CLASSIFICATION' using errcode = '22023';
  end if;

  v_status := case
    when v_confidence >= coalesce((v_rule ->> 'confidenceThreshold')::numeric, 0.70)
      and v_recommended_bin <> 'unknown' then 'verified'
    else 'low_confidence'
  end;

  select verified_actions, points into v_daily_actions, v_daily_points
  from public.daily_progress
  where profile_id = p_actor_id and squad_id = p_squad_id and progress_day = v_day
  for update;
  if not found then
    v_daily_actions := 0;
    v_daily_points := 0;
  end if;

  insert into public.submissions (
    profile_id, squad_id, challenge_id, image_path, model_result, user_bin, final_bin,
    confidence, verification_status, idempotency_key
  ) values (
    p_actor_id, p_squad_id, p_challenge_id, p_image_path, p_classification, p_user_bin,
    v_recommended_bin, v_confidence, v_status, p_idempotency_key
  ) returning id into v_submission_id;

  select cs.contest_id into v_contest_id
  from public.contest_squads as cs
  join public.contests as c on c.id = cs.contest_id
  where cs.squad_id = p_squad_id and c.status = 'active' and now() >= c.starts_at and now() < c.ends_at
  order by c.starts_at desc
  limit 1;

  if v_daily_actions < coalesce((v_rule ->> 'dailyActionCap')::integer, 3) then
    if v_status = 'verified' and p_user_bin = v_recommended_bin then
      v_award := coalesce((v_rule ->> 'correctSort')::integer, 10);
      insert into public.score_events values (
        gen_random_uuid(), p_actor_id, p_squad_id, v_contest_id, v_submission_id,
        'correct_sort', v_award, v_challenge.scoring_rule_version, now()
      );
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'correct_sort', 'points', v_award));
    elsif v_status = 'verified' then
      v_award := coalesce((v_rule ->> 'participation')::integer, 5);
      insert into public.score_events values (
        gen_random_uuid(), p_actor_id, p_squad_id, v_contest_id, v_submission_id,
        'participation', v_award, v_challenge.scoring_rule_version, now()
      );
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'participation', 'points', v_award));
    end if;

    if v_status = 'verified' and p_preparation_confirmed
      and nullif(p_classification ->> 'preparationTip', '') is not null then
      v_award := coalesce((v_rule ->> 'preparation')::integer, 5);
      insert into public.score_events values (
        gen_random_uuid(), p_actor_id, p_squad_id, v_contest_id, v_submission_id,
        'prep_step', v_award, v_challenge.scoring_rule_version, now()
      );
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'prep_step', 'points', v_award));
    end if;

    if v_status = 'verified' and v_daily_actions = 0 then
      v_award := coalesce((v_rule ->> 'dailyFirst')::integer, 10);
      insert into public.score_events values (
        gen_random_uuid(), p_actor_id, p_squad_id, v_contest_id, v_submission_id,
        'daily_first', v_award, v_challenge.scoring_rule_version, now()
      );
      v_points := v_points + v_award;
      v_awards := v_awards || jsonb_build_array(jsonb_build_object('actionType', 'daily_first', 'points', v_award));
    end if;
  end if;

  update public.submissions set points = v_points where id = v_submission_id;

  insert into public.daily_progress (
    profile_id, squad_id, progress_day, verified_actions, points, first_completed_at
  ) values (
    p_actor_id, p_squad_id, v_day,
    case when v_status = 'verified' then 1 else 0 end,
    v_points,
    case when v_status = 'verified' then now() else null end
  )
  on conflict (profile_id, squad_id, progress_day) do update
    set verified_actions = public.daily_progress.verified_actions + case when v_status = 'verified' then 1 else 0 end,
        points = public.daily_progress.points + v_points,
        first_completed_at = coalesce(public.daily_progress.first_completed_at, excluded.first_completed_at),
        updated_at = now();

  if v_contest_id is not null and v_points > 0 then
    update public.contest_squads
    set score = score + v_points
    where contest_id = v_contest_id and squad_id = p_squad_id;
  end if;

  if v_status = 'verified' then
    select count(*) into v_member_completions
    from public.daily_progress
    where squad_id = p_squad_id and progress_day = v_day and verified_actions > 0;

    if v_member_completions >= v_squad.min_daily_members then
      select * into v_streak from public.squad_streaks where squad_id = p_squad_id for update;
      if v_streak.last_completed_day = v_day then
        v_streak_status := 'already_complete';
      else
        update public.squad_streaks
        set current_streak = case
              when last_completed_day = v_day - 1 then current_streak + 1
              else 1
            end,
            last_completed_day = v_day,
            updated_at = now()
        where squad_id = p_squad_id;
        v_streak_status := 'advanced';
      end if;
    end if;
  end if;

  v_result := jsonb_build_object(
    'submissionId', v_submission_id,
    'classification', p_classification,
    'outcome', v_status,
    'awarded', v_awards,
    'points', v_points,
    'dailyPointsRemaining', greatest(
      0,
      coalesce((v_rule ->> 'dailyPointsCap')::integer, 75) - (v_daily_points + v_points)
    ),
    'crewUpdate', jsonb_build_object(
      'contestId', v_contest_id,
      'streakStatus', v_streak_status
    ),
    'duplicate', false
  );
  update public.submissions set result_payload = v_result where id = v_submission_id;
  return v_result;
end;
$$;

create or replace function public.consume_edge_rate_limit(
  p_actor_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_actor_id is null or char_length(p_endpoint) not between 1 and 80
    or p_max_requests not between 1 and 1000 or p_window_seconds not between 10 and 86400 then
    raise exception 'INVALID_RATE_LIMIT' using errcode = '22023';
  end if;

  v_window := pg_catalog.to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_endpoint || ':' || v_window::text, 0)
  );

  insert into public.edge_rate_limits (actor_id, endpoint, window_started_at, request_count)
  values (p_actor_id, p_endpoint, v_window, 1)
  on conflict (actor_id, endpoint, window_started_at) do update
    set request_count = public.edge_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

create or replace function public.refresh_contest_statuses()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.contests
  set status = 'active'
  where status = 'scheduled' and starts_at <= now() and ends_at > now();

  update public.contests
  set status = 'closed'
  where status in ('scheduled', 'active') and ends_at <= now();

  with ranked as (
    select contest_id, squad_id,
      dense_rank() over (partition by contest_id, league, cohort order by score desc, joined_at) as rank
    from public.contest_squads
    where contest_id in (select id from public.contests where status = 'closed')
  )
  update public.contest_squads as cs
  set final_rank = ranked.rank
  from ranked
  where cs.contest_id = ranked.contest_id and cs.squad_id = ranked.squad_id and cs.final_rank is null;

  delete from public.edge_rate_limits where window_started_at < now() - interval '2 days';
end;
$$;

revoke execute on function public.create_squad_for_actor(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_squad_invite_for_actor(uuid, uuid, text, timestamptz, smallint) from public, anon, authenticated;
revoke execute on function public.join_squad_for_actor(uuid, text) from public, anon, authenticated;
revoke execute on function public.enter_contest_for_actor(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_verified_sort(uuid, uuid, uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.consume_edge_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.refresh_contest_statuses() from public, anon, authenticated;
grant execute on function public.create_squad_for_actor(uuid, text, text) to service_role;
grant execute on function public.create_squad_invite_for_actor(uuid, uuid, text, timestamptz, smallint) to service_role;
grant execute on function public.join_squad_for_actor(uuid, text) to service_role;
grant execute on function public.enter_contest_for_actor(uuid, uuid, uuid) to service_role;
grant execute on function public.record_verified_sort(uuid, uuid, uuid, text, text, text, jsonb, boolean) to service_role;
grant execute on function public.consume_edge_rate_limit(uuid, text, integer, integer) to service_role;
grant execute on function public.refresh_contest_statuses() to service_role;

alter table public.profiles enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.squad_invites enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.contests enable row level security;
alter table public.contest_squads enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.score_events enable row level security;
alter table public.daily_progress enable row level security;
alter table public.squad_streaks enable row level security;
alter table public.edge_rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_id, frame_id, privacy_settings) on public.profiles to authenticated;
grant select on public.squads, public.squad_members, public.squad_invites, public.scoring_rules,
  public.contests, public.contest_squads, public.daily_challenges, public.submissions,
  public.score_events, public.daily_progress, public.squad_streaks to authenticated;

create policy profiles_select_shared_squad
on public.profiles for select to authenticated
using ((select private.shares_active_squad(id)));

create policy profiles_update_self
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy squads_select_members
on public.squads for select to authenticated
using (
  id in (select private.current_squad_ids())
  or id in (select private.visible_contest_squad_ids())
);

create policy squad_members_select_members
on public.squad_members for select to authenticated
using (squad_id in (select private.current_squad_ids()));

create policy squad_invites_select_owners
on public.squad_invites for select to authenticated
using (exists (
  select 1 from public.squads
  where squads.id = squad_invites.squad_id and squads.owner_id = (select auth.uid())
));

create policy scoring_rules_select_authenticated
on public.scoring_rules for select to authenticated
using (true);

create policy contests_select_authenticated
on public.contests for select to authenticated
using (true);

create policy contest_squads_select_same_contest
on public.contest_squads for select to authenticated
using (contest_id in (select private.current_contest_ids()));

create policy daily_challenges_select_authenticated
on public.daily_challenges for select to authenticated
using (active);

create policy submissions_select_owner
on public.submissions for select to authenticated
using (profile_id = (select auth.uid()));

create policy score_events_select_owner
on public.score_events for select to authenticated
using (profile_id = (select auth.uid()));

create policy daily_progress_select_owner
on public.daily_progress for select to authenticated
using (profile_id = (select auth.uid()));

create policy squad_streaks_select_members
on public.squad_streaks for select to authenticated
using (squad_id in (select private.current_squad_ids()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scan-images', 'scan-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy scan_images_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'scan-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy scan_images_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'scan-images'
  and owner_id = (select auth.uid()::text)
);

create policy scan_images_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'scan-images'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'scan-images'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy scan_images_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'scan-images'
  and owner_id = (select auth.uid()::text)
);

create or replace view public.contest_leaderboard
with (security_invoker = true)
as
select
  cs.contest_id,
  cs.squad_id,
  s.name as squad_name,
  cs.league,
  cs.cohort,
  cs.score,
  dense_rank() over (
    partition by cs.contest_id, cs.league, cs.cohort
    order by cs.score desc, cs.joined_at
  ) as rank
from public.contest_squads as cs
join public.squads as s on s.id = cs.squad_id;

revoke all on public.contest_leaderboard from anon, authenticated;
grant select on public.contest_leaderboard to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'refresh-contest-statuses',
  '*/5 * * * *',
  'select public.refresh_contest_statuses()'
);
