-- Backend-owned progression, friendship, activity, and league reward extensions.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table public.inventory_items (
  id text primary key,
  item_type text not null check (item_type in ('avatar', 'frame', 'badge', 'banner')),
  name text not null,
  unlock_rule jsonb not null default '{}'::jsonb
);

create table public.profile_inventory (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.inventory_items(id),
  unlocked_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (profile_id, item_id)
);

create table public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.activity_reactions (
  activity_id uuid not null references public.activity_feed(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('🌱', '🔥', '👏', '♻️')),
  created_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

create table public.league_weeks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  league text not null default 'seedlings',
  unique (starts_at, league)
);

create table public.crew_league_scores (
  league_week_id uuid not null references public.league_weeks(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  points int not null default 0,
  rank int,
  primary key (league_week_id, crew_id)
);

create table public.league_rewards (
  league_week_id uuid not null references public.league_weeks(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  item_id text not null references public.inventory_items(id),
  threshold int not null,
  granted_at timestamptz not null default now(),
  primary key (league_week_id, crew_id, item_id)
);

create or replace function public.leaderboard_for_week(target_week uuid)
returns table (rank bigint, crew_id uuid, crew_name text, league text, points int)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by cls.points desc, c.created_at asc),
    c.id, c.name, c.league, cls.points
  from public.crew_league_scores cls
  join public.crews c on c.id = cls.crew_id
  where cls.league_week_id = target_week
  order by cls.points desc, c.created_at asc;
$$;

create or replace function public.grant_league_cosmetic(
  target_week uuid,
  target_crew uuid,
  target_item text,
  required_points int
) returns int
language plpgsql security definer set search_path = public as $$
declare
  crew_points int;
  granted int := 0;
begin
  select points into crew_points
  from public.crew_league_scores
  where league_week_id = target_week and crew_id = target_crew;

  if coalesce(crew_points, 0) < required_points then
    return 0;
  end if;

  insert into public.league_rewards(league_week_id, crew_id, item_id, threshold)
  values (target_week, target_crew, target_item, required_points)
  on conflict do nothing;

  if found then
    insert into public.profile_inventory(profile_id, item_id)
    select profile_id, target_item
    from public.crew_members
    where crew_id = target_crew and active
    on conflict do nothing;
    get diagnostics granted = row_count;
  end if;

  return granted;
end;
$$;

alter table public.friendships enable row level security;
alter table public.inventory_items enable row level security;
alter table public.profile_inventory enable row level security;
alter table public.activity_feed enable row level security;
alter table public.activity_reactions enable row level security;
alter table public.league_weeks enable row level security;
alter table public.crew_league_scores enable row level security;
alter table public.league_rewards enable row level security;

create policy friendships_participants on public.friendships for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy inventory_catalog_public on public.inventory_items for select using (true);
create policy profile_inventory_self on public.profile_inventory for select using (profile_id = auth.uid());
create policy activity_crew_members on public.activity_feed for select using (public.is_crew_member(crew_id));
create policy reactions_crew_members on public.activity_reactions for select using (exists (select 1 from public.activity_feed a where a.id = activity_id and public.is_crew_member(a.crew_id)));
create policy league_weeks_public on public.league_weeks for select using (true);
create policy league_scores_crew_members on public.crew_league_scores for select using (public.is_crew_member(crew_id));
create policy league_rewards_crew_members on public.league_rewards for select using (public.is_crew_member(crew_id));

insert into public.inventory_items (id, item_type, name, unlock_rule) values
  ('frame-leaf', 'frame', 'Leaf Frame', '{"league_points": 50}'),
  ('frame-glass', 'frame', 'Glass Guardian Frame', '{"league_points": 100}'),
  ('avatar-sprout', 'avatar', 'Sprout', '{}'),
  ('badge-eco', 'badge', 'Eco Starter', '{"league_points": 25}'),
  ('banner-green', 'banner', 'Green Crew Banner', '{"league_points": 150}')
on conflict (id) do nothing;
