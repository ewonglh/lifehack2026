alter table public.crews add column if not exists invites_enabled boolean not null default true;

create or replace function public.set_crew_invites_enabled(
  target_crew uuid,
  enabled boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.crews
    where id = target_crew and owner_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.crews
  set invites_enabled = enabled
  where id = target_crew;

  if not enabled then
    update public.crew_invites
    set revoked_at = coalesce(revoked_at, now())
    where crew_id = target_crew and revoked_at is null;
  end if;
end;
$$;

create or replace function public.kick_crew_member(
  target_crew uuid,
  target_member uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.crews
    where id = target_crew and owner_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if target_member = auth.uid() then
    raise exception 'OWNER_CANNOT_KICK_SELF';
  end if;

  update public.crew_members
  set active = false
  where crew_id = target_crew and profile_id = target_member;
end;
$$;
