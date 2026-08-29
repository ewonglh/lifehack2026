-- Final MVP contract: friendly task copy, structured validation outcomes,
-- and metadata-only behaviour measurement.

alter table public.task_catalog
  add column if not exists title text,
  add column if not exists instruction text;

update public.task_catalog
set
  title = 'Clean Bottle Check',
  instruction = 'Empty a single-use plastic bottle, recycle it, and take a photo to confirm the action.',
  prompt = 'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
  locale_rule_version = 'sg-demo-v1'
where id = 'recycle-plastic-bottle';

update public.task_catalog
set title = coalesce(title, initcap(replace(id, '-', ' '))),
    instruction = coalesce(instruction, prompt)
where title is null or instruction is null;

alter table public.task_catalog
  alter column title set not null,
  alter column instruction set not null;

alter table public.submissions
  add column if not exists failure_reason text;

alter table public.submissions
  drop constraint if exists submissions_failure_reason_check;

alter table public.submissions
    add constraint submissions_failure_reason_check check (
    failure_reason is null or failure_reason in (
      'liquid_present',
      'unrelated_item',
      'recycling_context_missing',
      'low_confidence',
      'upload_failure',
      'ai_failure'
    )
  );

create or replace function private.derive_submission_failure_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.verification_status = 'verified' then
    new.failure_reason := null;
    return new;
  end if;

  v_reason := coalesce(
    new.model_result ->> 'failureReason',
    new.model_result ->> 'failure_reason'
  );

  if v_reason = 'wrong_bin' then v_reason := 'recycling_context_missing'; end if;
  if v_reason in ('liquid_present', 'unrelated_item', 'recycling_context_missing', 'low_confidence', 'upload_failure', 'ai_failure') then
    new.failure_reason := v_reason;
  elsif new.verification_status = 'low_confidence' then
    new.failure_reason := 'low_confidence';
  elsif new.verification_status = 'failed' then
    new.failure_reason := 'recycling_context_missing';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_failure_reason on public.submissions;
create trigger submissions_failure_reason
before insert or update of verification_status, model_result, user_bin, final_bin
on public.submissions
for each row execute function private.derive_submission_failure_reason();

create or replace function private.ensure_personal_submission_post()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.verification_status = 'verified' and new.squad_id is null then
    insert into public.profile_posts (submission_id, profile_id, squad_id)
    values (new.id, new.profile_id, null)
    on conflict (submission_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_personal_post on public.submissions;
create trigger submissions_personal_post
after insert on public.submissions
for each row execute function private.ensure_personal_submission_post();

create table if not exists public.measurement_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('baseline', 'follow_up')),
  scenario_id text not null check (char_length(scenario_id) between 2 and 80),
  selected_bin text check (selected_bin is null or selected_bin in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown')),
  prep_confirmed boolean,
  validated boolean not null,
  prompt_similarity numeric(5, 4) check (prompt_similarity is null or prompt_similarity between 0 and 1),
  self_reported boolean not null default false,
  action_confirmed boolean not null default false,
  is_demo boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (profile_id, phase, scenario_id)
);

create index if not exists measurement_checks_summary_idx
  on public.measurement_checks (is_demo, phase, completed_at);

alter table public.measurement_checks enable row level security;

drop policy if exists measurement_checks_owner_read on public.measurement_checks;
create policy measurement_checks_owner_read
on public.measurement_checks for select to authenticated
using (profile_id = (select auth.uid()));

create or replace function public.record_measurement_check(
  p_actor_id uuid,
  p_phase text,
  p_scenario_id text,
  p_selected_bin text,
  p_prep_confirmed boolean,
  p_validated boolean,
  p_prompt_similarity numeric default null,
  p_self_reported boolean default false
)
returns public.measurement_checks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.measurement_checks;
begin
  if p_phase not in ('baseline', 'follow_up')
    or (p_selected_bin is not null and p_selected_bin not in ('recycle', 'compost', 'reuse_return', 'landfill', 'unknown'))
    or char_length(trim(p_scenario_id)) not between 2 and 80
    or (p_prompt_similarity is not null and (p_prompt_similarity < 0 or p_prompt_similarity > 1)) then
    raise exception 'INVALID_MEASUREMENT' using errcode = '22023';
  end if;
  insert into public.measurement_checks (
    profile_id, phase, scenario_id, selected_bin, prep_confirmed,
    validated, prompt_similarity, self_reported, action_confirmed, is_demo
  ) values (
    p_actor_id, p_phase, trim(p_scenario_id), p_selected_bin, p_prep_confirmed,
    p_validated, p_prompt_similarity, coalesce(p_self_reported, false), coalesce(p_self_reported, false), false
  )
  on conflict (profile_id, phase, scenario_id) do update set
    selected_bin = excluded.selected_bin,
    prep_confirmed = excluded.prep_confirmed,
    validated = excluded.validated,
    prompt_similarity = excluded.prompt_similarity,
    self_reported = excluded.self_reported,
    action_confirmed = excluded.action_confirmed,
    completed_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.get_measurement_summary(p_actor_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with rows as (
    select * from public.measurement_checks
    where is_demo or profile_id = p_actor_id
  ), summary as (
    select
      phase,
      count(*)::integer as scenarios,
      coalesce(round(avg(case when prep_confirmed then 100.0 else 0 end), 1), 0) as prepared_percent,
      coalesce(round(avg(case when action_confirmed then 100.0 else 0 end), 1), 0) as recycled_percent,
      coalesce(round(avg(case when prep_confirmed and action_confirmed then 100.0 else 0 end), 1), 0) as behavior_percent
    from rows
    group by phase
  )
  select jsonb_build_object(
    'baseline', coalesce((select to_jsonb(summary) from summary where phase = 'baseline'), jsonb_build_object('scenarios', 0, 'prepared_percent', 0, 'recycled_percent', 0, 'behavior_percent', 0)),
    'followUp', coalesce((select to_jsonb(summary) from summary where phase = 'follow_up'), jsonb_build_object('scenarios', 0, 'prepared_percent', 0, 'recycled_percent', 0, 'behavior_percent', 0)),
    'targetPercentagePoints', 20,
    'isDemo', exists(select 1 from rows where is_demo)
  );
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
  select coalesce(timezone, 'Asia/Singapore') into v_timezone
  from public.profiles where id = p_actor_id;
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
    'locale', v_task.locale,
    'localeRuleVersion', v_task.locale_rule_version,
    'title', v_task.title,
    'instruction', v_task.instruction,
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

revoke all on function public.record_measurement_check(uuid, text, text, text, boolean, boolean, numeric, boolean) from public, anon, authenticated;
revoke all on function public.get_measurement_summary(uuid) from public, anon, authenticated;
grant execute on function public.record_measurement_check(uuid, text, text, text, boolean, boolean, numeric, boolean) to service_role;
grant execute on function public.get_measurement_summary(uuid) to service_role;
