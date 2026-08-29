alter table public.crews add column if not exists invites_enabled boolean not null default true;

create table public.crew_invites (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.crew_invites enable row level security;

create policy crew_invites_owner_read
on public.crew_invites for select
using (created_by = auth.uid());

create or replace function public.create_crew_invite(
  target_crew uuid,
  token_digest text,
  expiry timestamptz default (now() + interval '7 days')
) returns public.crew_invites
language plpgsql security definer set search_path = public as $$
declare
  result public.crew_invites;
  member_count int;
begin
  if not exists (
    select 1 from public.crew_members
    where crew_id = target_crew and profile_id = auth.uid() and active
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.crews
    where id = target_crew and invites_enabled
  ) then
    raise exception 'INVITES_DISABLED';
  end if;

  select count(*) into member_count
  from public.crew_members
  where crew_id = target_crew and active;

  if member_count >= 8 then
    raise exception 'CREW_FULL';
  end if;

  insert into public.crew_invites (crew_id, created_by, token_hash, expires_at)
  values (target_crew, auth.uid(), token_digest, expiry)
  returning * into result;

  return result;
end;
$$;

create or replace function public.join_crew_with_invite(token_digest text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  invite public.crew_invites;
  member_count int;
begin
  select * into invite
  from public.crew_invites
  where token_hash = token_digest
    and revoked_at is null
    and expires_at > now()
    and uses < max_uses
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  select count(*) into member_count
  from public.crew_members
  where crew_id = invite.crew_id and active;

  if member_count >= 8 then
    raise exception 'CREW_FULL';
  end if;

  insert into public.crew_members (crew_id, profile_id, role)
  values (invite.crew_id, auth.uid(), 'member')
  on conflict (crew_id, profile_id) do update set active = true;

  update public.crew_invites
  set uses = uses + 1
  where id = invite.id;

  return invite.crew_id;
end;
$$;

create or replace function public.revoke_crew_invite(target_invite uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.crew_invites
  set revoked_at = now()
  where id = target_invite and created_by = auth.uid();
end;
$$;
