insert into public.scoring_rules (version, config, active)
values (
  'mvp-v1',
  jsonb_build_object(
    'confidenceThreshold', 0.70,
    'correctSort', 10,
    'preparation', 5,
    'dailyFirst', 10,
    'participation', 5,
    'dailyActionCap', 3,
    'dailyPointsCap', 75
  ),
  true
)
on conflict (version) do update
set config = excluded.config, active = excluded.active;

insert into public.contests (
  id,
  name,
  theme,
  starts_at,
  ends_at,
  status,
  scoring_rule_version
)
values (
  '10000000-0000-4000-8000-000000000001',
  'Glass Guardians Weekly League',
  'Defeat the Landfill Monster',
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  'active',
  'mvp-v1'
)
on conflict (id) do update
set name = excluded.name,
    theme = excluded.theme,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    scoring_rule_version = excluded.scoring_rule_version;

insert into public.daily_challenges (
  id,
  challenge_day,
  locale,
  title,
  theme,
  prompt,
  locale_rule_version,
  scoring_rule_version,
  active
)
values (
  '20000000-0000-4000-8000-000000000001',
  (now() at time zone 'Asia/Singapore')::date,
  'en-SG',
  'Sort today’s item',
  'Glass Guardians',
  'Photograph one household item and choose its disposal bin.',
  'sg-demo-v1',
  'mvp-v1',
  true
)
on conflict (challenge_day, locale) do update
set title = excluded.title,
    theme = excluded.theme,
    prompt = excluded.prompt,
    locale_rule_version = excluded.locale_rule_version,
    scoring_rule_version = excluded.scoring_rule_version,
    active = excluded.active;
