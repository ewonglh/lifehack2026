-- Ensure every crew has a current local-day mission and that crew creation
-- cannot commit membership without its mission state.

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
  v_day date;
  v_mission_id uuid;
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

  v_day := (now() at time zone p_timezone)::date;
  insert into public.squad_daily_missions (squad_id, mission_id, mission_day)
  select v_squad_id, mc.id, v_day
  from public.mission_catalog as mc
  where mc.active
  order by md5(v_squad_id::text || v_day::text || mc.id)
  limit 1
  returning id into v_mission_id;

  if v_mission_id is null then
    raise exception 'MISSION_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return v_squad_id;
end;
$$;

revoke execute on function public.create_squad_for_actor(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_squad_for_actor(uuid, text, text) to service_role;

-- Repair squads created before mission provisioning was made transactional.
insert into public.squad_daily_missions (squad_id, mission_id, mission_day)
select s.id, selected_mission.id, (now() at time zone s.timezone)::date
from public.squads as s
cross join lateral (
  select mc.id
  from public.mission_catalog as mc
  where mc.active
  order by md5(s.id::text || (now() at time zone s.timezone)::date::text || mc.id)
  limit 1
) as selected_mission
on conflict (squad_id, mission_day) do nothing;
