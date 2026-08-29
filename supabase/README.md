# EcoCrew Supabase backend

This folder contains the authoritative game backend for per-user tasks, ephemeral image analysis, squad membership, automatic weekly leagues, finalized scoring, crew progression, avatars, contact leaderboards, and individual/crew streaks.

## Local setup

Docker Desktop or Podman is required by the Supabase CLI.

```shell
npx supabase start
npx supabase db reset
npx supabase test db
```

Copy `.env.example` to `.env.local`, then serve the authenticated functions:

```shell
npx supabase functions serve --env-file supabase/.env.local
```

Set `MOCK_VLM=true` for deterministic demos. For live analysis, set `MOCK_VLM=false`, provide `OPENAI_API_KEY`, and optionally select a compatible vision model with `OPENAI_MODEL`. `ALLOW_VLM_FALLBACK=true` preserves the demo loop when the provider is unavailable.

## Client flow

1. Invoke `manage-mission` with `{ "action": "getDaily" }` to get the authenticated user’s stable task and prompt for the local day.
2. Invoke `create-submission` with multipart form data containing `image`, `taskId`, `idempotencyKey`, and optional `locale`.
3. The Edge Function analyzes the image in memory, validates it against the task, stores metadata only, and discards the image.
4. Render the returned validation result and streak update without recalculating them in the browser.

Profile photos use `manage-profile` with multipart form data and are stored in the private `avatars` bucket under `<auth.uid>/<random-name>`. Task images must never be uploaded to Storage.

Squad mutations use `manage-squad` with one of these actions:

- `create`: `name`, optional `timezone`
- `createInvite`: `squadId`, optional `expiresInHours` and `maxUses`
- `join`: `inviteCode`

League mutations use `manage-league` with `queue`, `cancel`, `current`, `list`, `leaderboard`, and `contacts` actions. A crew must have at least four active members to queue. The `league-jobs` function must be invoked weekly with `x-cron-secret: $CRON_SECRET`; it performs matchmaking and finalizes ended leagues.

Contact synchronization uses `manage-contacts` with `authorize`, `sync`, or `disable`. Configure the provider client IDs, secrets, callback URLs, and `CONTACTS_REDIRECT_URL` as Edge Function secrets. Provider access tokens are used only for the request and are never stored; only hashed contact identifiers are retained.

Invite tokens are returned once; only their SHA-256 hashes are stored. The `analyze-submission` function is an optional analysis-only endpoint and never awards points.

## Production deployment

```shell
npx supabase db push
npx supabase functions deploy analyze-submission
npx supabase functions deploy create-submission
npx supabase functions deploy manage-squad
npx supabase functions deploy manage-mission
npx supabase functions deploy manage-league
npx supabase functions deploy manage-cosmetics
npx supabase functions deploy manage-profile
npx supabase functions deploy manage-activity
npx supabase functions deploy manage-contacts
npx supabase functions deploy league-jobs
```

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ALLOW_VLM_FALLBACK`, `CRON_SECRET`, and the contact-provider secrets from `.env.example` as Edge Function secrets. Configure a weekly scheduler to POST to `league-jobs` with `x-cron-secret: $CRON_SECRET`. Keep `SUPABASE_SERVICE_ROLE_KEY`, provider access tokens, `CRON_SECRET`, and `OPENAI_API_KEY` out of all `VITE_` variables and browser bundles.
