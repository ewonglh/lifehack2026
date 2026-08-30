create or replace function public.unequip_cosmetic_for_actor(p_actor_id uuid, p_cosmetic_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text, 0));

  select kind into v_kind
  from public.cosmetic_catalog
  where id = p_cosmetic_id;

  if not found
    or (
      not exists (
        select 1
        from public.profile_inventory
        where profile_id = p_actor_id
          and cosmetic_id = p_cosmetic_id
      )
      and not exists (
        select 1
        from public.crew_cosmetics cc
        join public.squad_members sm on sm.squad_id = cc.squad_id
        where sm.profile_id = p_actor_id
          and sm.status = 'active'
          and cc.cosmetic_id = p_cosmetic_id
      )
    ) then
    raise exception 'COSMETIC_NOT_OWNED' using errcode = 'P0001';
  end if;

  update public.profile_inventory
  set equipped = false
  where profile_id = p_actor_id
    and cosmetic_id = p_cosmetic_id;

  if v_kind = 'avatar' then
    update public.profiles
    set avatar_id = null
    where id = p_actor_id
      and avatar_id = p_cosmetic_id;
  end if;

  if v_kind = 'frame' then
    update public.profiles
    set frame_id = null
    where id = p_actor_id
      and frame_id = p_cosmetic_id;
  end if;

  delete from public.crew_cosmetic_equipment
  where profile_id = p_actor_id
    and cosmetic_id = p_cosmetic_id
    and squad_id in (
      select squad_id
      from public.squad_members
      where profile_id = p_actor_id
        and status = 'active'
    );
end;
$$;

revoke all on function public.unequip_cosmetic_for_actor(uuid, text) from public, anon, authenticated;
grant execute on function public.unequip_cosmetic_for_actor(uuid, text) to service_role;
