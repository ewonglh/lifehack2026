begin;

-- Contract assertions for the additive migration. These run after the core
-- schema and confirm the user-data tables retain RLS protection.
select plan(12);

select ok(to_regclass('public.mission_catalog') is not null, 'mission catalog exists');
select ok(to_regclass('public.leagues') is not null, 'leagues exist');
select ok(to_regclass('public.profile_inventory') is not null, 'inventory exists');
select ok(to_regclass('public.profile_posts') is not null, 'post projections exist');
select ok((select relrowsecurity from pg_class where oid = 'public.leagues'::regclass), 'league RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.profile_inventory'::regclass), 'inventory RLS is enabled');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'create_league_for_actor'), 'league mutation exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_submission_progress_for_actor'), 'progress mutation exists');
select ok(has_function_privilege('authenticated', 'private.is_active_squad_member(uuid, uuid)', 'EXECUTE'), 'authenticated can execute squad membership helper');
select ok(exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'unequip_cosmetic_for_actor'), 'cosmetic unequip mutation exists');
select ok(not has_function_privilege('authenticated', 'public.unequip_cosmetic_for_actor(uuid, text)', 'EXECUTE'), 'authenticated clients cannot call cosmetic unequip RPC');
select ok(not has_function_privilege('anon', 'public.unequip_cosmetic_for_actor(uuid, text)', 'EXECUTE'), 'anonymous clients cannot call cosmetic unequip RPC');

select * from finish();
rollback;
