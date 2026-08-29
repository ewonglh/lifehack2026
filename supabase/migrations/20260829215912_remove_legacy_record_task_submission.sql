-- Remove the pre-MVP overloaded submission RPC after the MVP contract rollout.

drop function if exists public.record_task_submission(
  uuid, text, date, text, jsonb, boolean, numeric, text, text, text, text, uuid
);
