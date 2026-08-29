insert into public.weekly_missions(title,theme,target,starts_at,ends_at) values('Glass Guardians','Defeat the Landfill Monster',20,date_trunc('week',now()),date_trunc('week',now()) + interval '7 days');

insert into public.league_weeks(starts_at, ends_at, league)
values (date_trunc('week', now()), date_trunc('week', now()) + interval '7 days', 'seedlings')
on conflict (starts_at, league) do nothing;
