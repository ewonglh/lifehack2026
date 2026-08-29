# EcoCrew Supabase backend

This folder contains the authoritative game backend for squad membership, weekly contests, daily challenges, image analysis, scoring, daily caps, and squad streaks.

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

1. Upload a JPEG, PNG, or WebP image to `scan-images/<auth.uid()>/<random-name>`.
2. Invoke `create-submission` with `squadId`, `idempotencyKey`, `imageStoragePath`, `userSelectedBin`, and `locale`.
3. Render the returned classification, awards, daily points remaining, and streak update without recalculating them in the browser.

Squad mutations use `manage-squad` with one of these actions:

- `create`: `name`, optional `timezone`
- `createInvite`: `squadId`, optional `expiresInHours` and `maxUses`
- `join`: `inviteToken`
- `enterContest`: `squadId`, `contestId`

Invite tokens are returned once; only their SHA-256 hashes are stored. The `analyze-submission` function is an optional analysis-only endpoint and never awards points.

## Production deployment

```shell
npx supabase db push
npx supabase functions deploy analyze-submission
npx supabase functions deploy create-submission
npx supabase functions deploy manage-squad
```

Set Edge Function secrets in the project rather than committing `.env.local`. Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` out of all `VITE_` variables and browser bundles.
