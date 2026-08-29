-- Additive social, progression, and privacy features for the deployed core.

alter table public.profiles
  add column if not exists handle text,
  add column if not exists age smallint check (age between 13 and 120),
  add column if not exists about text not null default '' check (char_length(about) <= 280),
  add column if not exists location text not null default 'Singapore' check (char_length(location) <= 80),
  add column if not exists age_visibility text not null default 'private' check (age_visibility in ('private', 'crew', 'public')),
  add column if not exists avatar_path text;

create unique index if not exists profiles_handle_unique_idx
  on public.profiles (lower(handle)) where handle is not null;

alter table public.squads
  add column if not exists join_enabled boolean not null default true;

create table if not exists public.mission_catalog (
  id text primary key,
  title text not null check (char_length(title) between 2 and 100),
  theme text not null check (char_length(theme) between 2 and 80),
  target integer not null check (target between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_daily_missions (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  mission_id text not null references public.mission_catalog(id) on delete restrict,
  mission_day date not null,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (squad_id, mission_day)
);

create index if not exists squad_daily_missions_lookup_idx on public.squad_daily_missions (squad_id, mission_day desc);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  owner_squad_id uuid not null references public.squads(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '7 days'),
  max_squads smallint not null default 12 check (max_squads between 2 and 50),
  status text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at = starts_at + interval '7 days')
);

create table if not exists public.league_entries (
  league_id uuid not null references public.leagues(id) on delete cascade,
  squad_id uuid not null references public.squads(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  final_rank integer check (final_rank > 0),
  primary key (league_id, squad_id)
);
create index if not exists league_entries_rank_idx on public.league_entries (league_id, score desc, joined_at);

create table if not exists public.profile_progress (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  lifetime_xp integer not null default 0 check (lifetime_xp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.cosmetic_catalog (
  id text primary key,
  kind text not null check (kind in ('avatar', 'frame', 'badge')),
  name text not null check (char_length(name) between 2 and 80),
  unlock_xp integer not null check (unlock_xp >= 0),
  active boolean not null default true
);

create table if not exists public.profile_inventory (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_catalog(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (profile_id, cosmetic_id)
);

create table if not exists public.profile_posts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  squad_id uuid references public.squads(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'crew', 'public')),
  image_visible boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.profile_posts(id) on delete set null,
  event_type text not null check (event_type in ('submission', 'mission_complete', 'streak', 'league', 'unlock')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists activity_events_squad_created_idx on public.activity_events (squad_id, created_at desc);

create table if not exists public.activity_reactions (
  activity_id uuid not null references public.activity_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '♻️', '👏', '🌱')),
  created_at timestamptz not null default now(),
  primary key (activity_id, profile_id, emoji)
);

create or replace function private.is_active_squad_member(p_squad_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_profile_id and status = 'active');
$$;
create or replace function private.is_squad_owner(p_squad_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.squad_members where squad_id = p_squad_id and profile_id = p_profile_id and status = 'active' and role = 'owner');
$$;
revoke all on function private.is_active_squad_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_squad_owner(uuid, uuid) from public, anon, authenticated;

create or replace function public.update_profile_for_actor(p_actor_id uuid, p_display_name text, p_handle text, p_age smallint, p_about text, p_location text, p_age_visibility text, p_avatar_path text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor_id is null then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  if char_length(trim(p_display_name)) not between 1 and 40 then raise exception 'INVALID_PROFILE' using errcode = '22023'; end if;
  if p_handle is not null and (p_handle !~ '^@[a-zA-Z0-9._]{2,29}$') then raise exception 'INVALID_HANDLE' using errcode = '22023'; end if;
  if p_age is not null and p_age not between 13 and 120 then raise exception 'INVALID_PROFILE' using errcode = '22023'; end if;
  if char_length(p_about) > 280 or char_length(p_location) > 80 or p_age_visibility not in ('private', 'crew', 'public') then raise exception 'INVALID_PROFILE' using errcode = '22023'; end if;
  update public.profiles set display_name = trim(p_display_name), handle = nullif(lower(trim(p_handle)), ''), age = p_age, about = p_about, location = p_location, age_visibility = p_age_visibility, avatar_path = p_avatar_path where id = p_actor_id;
exception when unique_violation then raise exception 'HANDLE_TAKEN' using errcode = 'P0001';
end; $$;

create or replace function public.create_squad_invite_code_for_actor(p_actor_id uuid, p_squad_id uuid, p_code_hash text, p_expires_at timestamptz, p_max_uses smallint)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_active_squad_member(p_squad_id, p_actor_id) then raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001'; end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '30 days' or p_max_uses not between 1 and 8 then raise exception 'INVALID_INVITE' using errcode = '22023'; end if;
  insert into public.squad_invites(squad_id, token_hash, created_by, expires_at, max_uses) values (p_squad_id, p_code_hash, p_actor_id, p_expires_at, p_max_uses) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.configure_squad_for_actor(p_actor_id uuid, p_squad_id uuid, p_join_enabled boolean, p_min_daily_members smallint)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_squad_owner(p_squad_id, p_actor_id) then raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001'; end if;
  update public.squads set join_enabled = p_join_enabled, min_daily_members = p_min_daily_members where id = p_squad_id;
end; $$;

create or replace function public.remove_squad_member_for_actor(p_actor_id uuid, p_squad_id uuid, p_profile_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_squad_owner(p_squad_id, p_actor_id) or p_actor_id = p_profile_id then raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001'; end if;
  update public.squad_members set status = 'removed', left_at = now() where squad_id = p_squad_id and profile_id = p_profile_id and status = 'active' and role = 'member';
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.leave_squad_for_actor(p_actor_id uuid, p_squad_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if private.is_squad_owner(p_squad_id, p_actor_id) then raise exception 'OWNER_TRANSFER_REQUIRED' using errcode = 'P0001'; end if;
  update public.squad_members set status = 'left', left_at = now() where squad_id = p_squad_id and profile_id = p_actor_id and status = 'active';
  if not found then raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.transfer_squad_ownership_for_actor(p_actor_id uuid, p_squad_id uuid, p_new_owner_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_squad_owner(p_squad_id, p_actor_id) or not private.is_active_squad_member(p_squad_id, p_new_owner_id) then raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001'; end if;
  update public.squad_members set role = case when profile_id = p_new_owner_id then 'owner' else 'member' end where squad_id = p_squad_id and profile_id in (p_actor_id, p_new_owner_id);
  update public.squads set owner_id = p_new_owner_id where id = p_squad_id;
end; $$;

create or replace function public.get_squad_daily_mission_for_actor(p_actor_id uuid, p_squad_id uuid)
returns public.squad_daily_missions language plpgsql security invoker set search_path = '' as $$
declare v_day date; v_row public.squad_daily_missions;
begin
  if not private.is_active_squad_member(p_squad_id, p_actor_id) then raise exception 'SQUAD_MEMBERSHIP_REQUIRED' using errcode = 'P0001'; end if;
  select (now() at time zone timezone)::date into v_day from public.squads where id = p_squad_id;
  insert into public.squad_daily_missions(squad_id, mission_id, mission_day)
  select p_squad_id, id, v_day from public.mission_catalog where active order by md5(p_squad_id::text || v_day::text || id) limit 1 on conflict (squad_id, mission_day) do nothing;
  select * into v_row from public.squad_daily_missions where squad_id = p_squad_id and mission_day = v_day;
  if not found then raise exception 'MISSION_UNAVAILABLE' using errcode = 'P0001'; end if;
  return v_row;
end; $$;

create or replace function public.create_league_for_actor(p_actor_id uuid, p_squad_id uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_squad_owner(p_squad_id, p_actor_id) then raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001'; end if;
  insert into public.leagues(owner_squad_id, name) values (p_squad_id, trim(p_name)) returning id into v_id;
  insert into public.league_entries(league_id, squad_id) values(v_id, p_squad_id);
  return v_id;
end; $$;

create or replace function public.join_league_for_actor(p_actor_id uuid, p_squad_id uuid, p_league_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_max smallint; v_count integer;
begin
  if not private.is_squad_owner(p_squad_id, p_actor_id) then raise exception 'SQUAD_OWNER_REQUIRED' using errcode = 'P0001'; end if;
  select max_squads into v_max from public.leagues where id = p_league_id and status = 'active' and now() < ends_at for update;
  if not found then raise exception 'LEAGUE_UNAVAILABLE' using errcode = 'P0001'; end if;
  select count(*) into v_count from public.league_entries where league_id = p_league_id;
  if v_count >= v_max then raise exception 'LEAGUE_FULL' using errcode = 'P0001'; end if;
  insert into public.league_entries(league_id, squad_id) values(p_league_id, p_squad_id) on conflict do nothing;
end; $$;

create or replace function public.equip_cosmetic_for_actor(p_actor_id uuid, p_cosmetic_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_kind text;
begin
  select kind into v_kind from public.cosmetic_catalog where id = p_cosmetic_id;
  if not found or not exists(select 1 from public.profile_inventory where profile_id = p_actor_id and cosmetic_id = p_cosmetic_id) then raise exception 'COSMETIC_NOT_OWNED' using errcode = 'P0001'; end if;
  update public.profile_inventory set equipped = false where profile_id = p_actor_id and cosmetic_id in (select id from public.cosmetic_catalog where kind = v_kind);
  update public.profile_inventory set equipped = true where profile_id = p_actor_id and cosmetic_id = p_cosmetic_id;
  if v_kind = 'avatar' then update public.profiles set avatar_id = p_cosmetic_id where id = p_actor_id; end if;
  if v_kind = 'frame' then update public.profiles set frame_id = p_cosmetic_id where id = p_actor_id; end if;
end; $$;

alter table public.mission_catalog enable row level security;
alter table public.squad_daily_missions enable row level security;
alter table public.leagues enable row level security;
alter table public.league_entries enable row level security;
alter table public.profile_progress enable row level security;
alter table public.cosmetic_catalog enable row level security;
alter table public.profile_inventory enable row level security;
alter table public.profile_posts enable row level security;
alter table public.activity_events enable row level security;
alter table public.activity_reactions enable row level security;

create policy mission_catalog_read on public.mission_catalog for select to authenticated using (active);
create policy squad_missions_read on public.squad_daily_missions for select to authenticated using (private.is_active_squad_member(squad_id, (select auth.uid())));
create policy leagues_read on public.leagues for select to authenticated using (true);
create policy league_entries_read on public.league_entries for select to authenticated using (true);
create policy progress_owner_read on public.profile_progress for select to authenticated using (profile_id = (select auth.uid()));
create policy cosmetics_read on public.cosmetic_catalog for select to authenticated using (active);
create policy inventory_owner_read on public.profile_inventory for select to authenticated using (profile_id = (select auth.uid()));
create policy posts_read on public.profile_posts for select to authenticated using (deleted_at is null and (profile_id = (select auth.uid()) or (visibility = 'crew' and squad_id is not null and private.is_active_squad_member(squad_id, (select auth.uid()))) or visibility = 'public'));
create policy activity_read on public.activity_events for select to authenticated using (private.is_active_squad_member(squad_id, (select auth.uid())));
create policy reactions_read on public.activity_reactions for select to authenticated using (exists (select 1 from public.activity_events where id = activity_id and private.is_active_squad_member(squad_id, (select auth.uid()))));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy avatars_insert_owner on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_update_owner on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text)) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_delete_owner on storage.objects for delete to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

insert into public.mission_catalog(id,title,theme,target) values
  ('glass-guardians','Glass Guardians','Glass',20),
  ('landfill-monster','Defeat the Landfill Monster','Waste reduction',25),
  ('plastic-patrol','Plastic Patrol','Plastic',20)
on conflict (id) do nothing;
insert into public.cosmetic_catalog(id,kind,name,unlock_xp) values
  ('leaf-frame','frame','Leaf Frame',25),('mushroom-frame','frame','Mushroom Frame',100),('sprout-badge','badge','Sprout Badge',50),('planet-badge','badge','Planet Badge',250),('otter-avatar','avatar','Otter Avatar',150),('fox-avatar','avatar','Fox Avatar',500)
on conflict (id) do nothing;

create or replace function public.join_squad_for_actor(p_actor_id uuid, p_token_hash text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_invite public.squad_invites%rowtype; v_squad public.squads%rowtype; v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text, 0));
  if exists (select 1 from public.squad_members where profile_id = p_actor_id and status = 'active') then raise exception 'ALREADY_IN_SQUAD' using errcode = 'P0001'; end if;
  select * into v_invite from public.squad_invites where token_hash = p_token_hash for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() or v_invite.use_count >= v_invite.max_uses then raise exception 'INVALID_INVITE' using errcode = 'P0001'; end if;
  select * into v_squad from public.squads where id = v_invite.squad_id for update;
  if not v_squad.join_enabled then raise exception 'JOIN_DISABLED' using errcode = 'P0001'; end if;
  select count(*) into v_count from public.squad_members where squad_id = v_squad.id and status = 'active';
  if v_count >= v_squad.max_members then raise exception 'SQUAD_FULL' using errcode = 'P0001'; end if;
  insert into public.squad_members(squad_id, profile_id, role, status, joined_at, left_at) values(v_squad.id, p_actor_id, 'member', 'active', now(), null)
  on conflict(squad_id, profile_id) do update set role = 'member', status = 'active', joined_at = now(), left_at = null;
  update public.squad_invites set use_count = use_count + 1 where id = v_invite.id;
  return v_squad.id;
end; $$;

create or replace function public.apply_submission_progress_for_actor(p_actor_id uuid, p_squad_id uuid, p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_points integer; v_day date; v_mission public.squad_daily_missions; v_new_post uuid; v_xp integer;
begin
  select points into v_points from public.submissions where id = p_submission_id and profile_id = p_actor_id;
  if not found then raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.profile_posts(submission_id, profile_id, squad_id) values(p_submission_id, p_actor_id, p_squad_id) on conflict(submission_id) do nothing returning id into v_new_post;
  if v_new_post is null then return jsonb_build_object('duplicate', true); end if;
  insert into public.profile_progress(profile_id, lifetime_xp) values(p_actor_id, v_points) on conflict(profile_id) do update set lifetime_xp = public.profile_progress.lifetime_xp + excluded.lifetime_xp, updated_at = now() returning lifetime_xp into v_xp;
  insert into public.profile_inventory(profile_id, cosmetic_id)
    select p_actor_id, id from public.cosmetic_catalog where active and unlock_xp <= v_xp on conflict do nothing;
  select (now() at time zone timezone)::date into v_day from public.squads where id = p_squad_id;
  perform public.get_squad_daily_mission_for_actor(p_actor_id, p_squad_id);
  select * into v_mission from public.squad_daily_missions where squad_id = p_squad_id and mission_day = v_day for update;
  update public.squad_daily_missions set progress = progress + v_points, completed_at = case when progress + v_points >= (select target from public.mission_catalog where id = v_mission.mission_id) then coalesce(completed_at, now()) else completed_at end where id = v_mission.id returning * into v_mission;
  update public.league_entries le set score = score + v_points from public.leagues l where le.league_id = l.id and le.squad_id = p_squad_id and l.status = 'active' and now() >= l.starts_at and now() < l.ends_at;
  insert into public.activity_events(squad_id, actor_id, post_id, event_type, payload) values(p_squad_id, p_actor_id, v_new_post, 'submission', jsonb_build_object('points', v_points));
  return jsonb_build_object('missionProgress', v_mission.progress, 'missionCompleted', v_mission.completed_at is not null, 'lifetimeXp', v_xp);
end; $$;

revoke all on function public.update_profile_for_actor(uuid, text, text, smallint, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_squad_invite_code_for_actor(uuid, uuid, text, timestamptz, smallint) from public, anon, authenticated;
revoke all on function public.configure_squad_for_actor(uuid, uuid, boolean, smallint) from public, anon, authenticated;
revoke all on function public.remove_squad_member_for_actor(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.leave_squad_for_actor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.transfer_squad_ownership_for_actor(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_squad_daily_mission_for_actor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_league_for_actor(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.join_league_for_actor(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.equip_cosmetic_for_actor(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_submission_progress_for_actor(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
