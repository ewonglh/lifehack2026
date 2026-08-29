begin;

select plan(16);

select ok(to_regclass('public.task_catalog') is not null, 'task catalog exists');
select ok(to_regclass('public.user_daily_tasks') is not null, 'per-user daily tasks exist');
select ok(to_regclass('public.crew_progression') is not null, 'crew progression exists');
select ok(to_regclass('public.crew_cosmetics') is not null, 'crew cosmetics exist');
select ok(to_regclass('public.league_queue') is not null, 'league queue exists');
select ok(to_regclass('public.league_rosters') is not null, 'league roster snapshots exist');
select ok(to_regclass('public.league_daily_scores') is not null, 'daily score ledger exists');
select ok(to_regclass('public.user_streaks') is not null, 'individual streaks exist');
select ok(to_regclass('public.crew_daily_streaks') is not null, 'crew streak ledger exists');
select ok(to_regclass('public.contact_identifiers') is not null, 'contact identifiers exist');
select ok((select relrowsecurity from pg_class where oid = 'public.user_daily_tasks'::regclass), 'daily tasks have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.league_queue'::regclass), 'league queue has RLS');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'record_pending_task_submission'), 'pending task submission mutation exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'confirm_recycling_action'), 'action confirmation mutation exists');
select ok(not has_function_privilege('authenticated', 'public.record_pending_task_submission(uuid,text,date,text,jsonb,boolean,numeric,numeric,text,text,text,text,uuid)', 'EXECUTE'), 'authenticated clients cannot call pending submission RPC');
select ok(not has_function_privilege('authenticated', 'public.confirm_recycling_action(uuid,uuid,text)', 'EXECUTE'), 'authenticated clients cannot call confirmation RPC');

select * from finish();
rollback;
