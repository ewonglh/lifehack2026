# EcoCrew

[![CI](https://github.com/ewonglh/lifehack2026/actions/workflows/ci.yml/badge.svg)](https://github.com/ewonglh/lifehack2026/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Node.js 22.12+](https://img.shields.io/badge/Node.js-22.12%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Live Demo](https://img.shields.io/badge/demo-live-2ea44f)](https://lifehack2026.onrender.com)

EcoCrew is a mobile-first social recycling game that helps people build the habit of correctly preparing and recycling a single-use plastic bottle. A player completes a daily mission, captures or uploads a photo, receives AI-assisted preparation feedback, confirms the real-world action, and contributes progress to a private crew.

The MVP supports a real Supabase-backed experience and a deterministic local demo mode. The photo validates preparation and recycling context; the final disposal action is self-reported, so the app does not claim that an image proves real-world disposal.

Live demo: [lifehack2026.onrender.com](https://lifehack2026.onrender.com)

## What is included

- Daily **Clean Bottle Check** mission focused on emptying and recycling a single-use plastic bottle.
- Camera or file upload with preview, retry, and clear success, mismatch, low-confidence, and failure states.
- AI-assisted classification through a secure Supabase Edge Function, with three deterministic demo fixtures.
- Email/password, magic-link, and OAuth authentication through Supabase, plus display-name onboarding.
- Private crew creation and invite joining, shared missions, activity feed, reactions, streaks, and weekly league standings.
- Personal points, profile history, cosmetic unlocks, and a metadata-only baseline/follow-up measurement view.
- Keyboard-friendly controls, labelled bin choices, responsive layouts, and reduced-motion support.

## Technology

- Vite `^8.2.2` and native JavaScript ES modules
- Bootstrap `^5.3.8`, Bootstrap Icons, Sass, and Stylelint
- Hash-based client-side routing
- Supabase Auth, Postgres, Row Level Security, RPCs, and Edge Functions
- OpenAI Responses API for optional live image analysis
- Vitest, jsdom, ESLint, Prettier, and GitHub Actions

## Architecture

```text
Browser
├─ Vite app and hash router
├─ Pages, layouts, components, and feature styles
└─ Services
   ├─ Mock adapter ── localStorage/sessionStorage (development demo)
   └─ Supabase client
      ├─ Auth
      ├─ Postgres + RLS + trusted RPCs
      └─ Edge Functions
         └─ OpenAI Responses API (optional; secret stays server-side)
```

The user-facing term **crew** maps to `squad` in the current backend function and database names. Server responses are canonical for authentication, membership, task completion, points, streaks, missions, leagues, and unlocks; the browser only renders them.

Task images are sent to `create-submission` as ephemeral multipart data. They are analyzed in memory and are not stored. Profile images, where enabled, use the private `avatars` bucket.

## Getting started

### Prerequisites

- Node.js `22.12.0` or newer
- npm 10 or newer
- Docker Desktop or Podman only if you need the local Supabase stack

Check your versions:

```shell
node --version
npm --version
```

### Run the frontend

From the directory containing this README and `package.json`:

```shell
npm ci
npm run dev
```

Open <http://localhost:3000/>. The development server uses a strict port and the root hash redirects to the appropriate landing or signed-in screen.

On Windows PowerShell, use `npm.cmd` instead if the local execution policy blocks `npm.ps1`:

```powershell
npm.cmd ci
npm.cmd run dev
```

### Choose an environment mode

The frontend reads `.env.local`. Start from [.env.example](./.env.example).

#### Local mock mode

Mock mode is intended for development and demos. It uses browser storage and does not contact Supabase.

```text
VITE_USE_MOCK_DATA=true
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

During Vite development, missing Supabase credentials also fall back to mock mode. The production build requires valid Supabase credentials. On the sign-in screen, **Reset local demo data** clears the demo account and state.

#### Supabase mode

Copy the example file and set browser-safe project values:

```shell
cp .env.example .env.local
```

```text
VITE_USE_MOCK_DATA=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

In PowerShell, the copy step is:

```powershell
Copy-Item .env.example .env.local
```

Add the following to Supabase Auth’s allowed redirect URLs, replacing the origin for a deployed environment:

```text
http://localhost:3000/?auth_callback=1#/auth/callback
```

For a judge-friendly demo, configure Supabase Auth to allow new accounts without email confirmation. Never put a service-role key or an AI provider key in a `VITE_` variable.

### Run the local Supabase backend

The local database requires Docker Desktop or Podman and the Supabase CLI:

```shell
npx supabase start
npm run db:reset
npx supabase test db
```

`npm run db:reset` applies all migrations and reloads [supabase/seed.sql](./supabase/seed.sql). It resets only the local database. The remote reset command is destructive and should be used only for a disposable linked project:

```shell
npm run db:reset:remote
```

To serve the Edge Functions locally, copy [supabase/.env.example](./supabase/.env.example) to `supabase/.env.local`, set the required values, and run:

```shell
npx supabase functions serve --env-file supabase/.env.local
```

### Configure live photo analysis

The Edge Functions use the OpenAI Responses API. Set these values in `supabase/.env.local` or as hosted Edge Function secrets:

```text
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-4o-mini
MOCK_VLM=true
ALLOWED_ORIGIN=http://localhost:3000
```

Set `MOCK_VLM=true` for the deterministic demo fixtures. Set it to `false` and provide `OPENAI_API_KEY` for live analysis. If the live model is unavailable, the API returns an explicit `ai_failure` result with retry/manual-guidance messaging.

Keep `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, contact-provider secrets, and provider access tokens out of the browser bundle and all `VITE_` variables.

## The daily flow

1. Sign in and set a display name.
2. Join or create a crew, or continue with individual progress.
3. Open **Today’s action** and read the Clean Bottle Check instruction.
4. Capture or upload the prepared bottle and submit the photo.
5. Review the preparation/context result. A successful photo returns `awaiting_check_in` with zero points.
6. Confirm **I recycled it**. The trusted backend awards points and updates personal and crew progress idempotently.
7. View the result, reward, streak, teammate activity, and next unlock.

### Demo fixtures

When `MOCK_VLM=true`, the Scan screen exposes deterministic examples:

| Fixture | Result | Expected behavior |
|---|---|---|
| Bottle with water | `liquid_present` | Explain “Empty the bottle first,” award no points, and offer retry. |
| Empty bottle | Success | Show recycle guidance; confirmation normally awards 25 points on a fresh demo and updates progress. |
| Unrelated item | `unrelated_item` | Explain that the item does not match today’s mission, award no points, and offer retry. |

The seeded demo crew uses invite code `ECO123`. Reset the local demo before replaying a successful action because one daily action is intentionally enforced.

## Routes

All routes use the hash portion of the URL, for example `#/dashboard`.

| Route | Screen or behavior |
|---|---|
| `#/` | Public habit landing page; signed-in users continue to onboarding or Home. |
| `#/auth` / `#/login` | Sign-in screen. |
| `#/register` | Account creation. |
| `#/join/:inviteCode` | Public crew invite flow. |
| `#/auth/callback` | Supabase Auth callback handler. |
| `#/onboarding` | Display-name setup. |
| `#/dashboard` | Home, today’s action, personal progress, and crew progress. |
| `#/dashboard/variants` | Dashboard design-review variants. |
| `#/sort` | Today’s action/photo flow; retained for compatibility. |
| `#/result` / `#/result/:submissionId` | Preparation result, check-in, score, and reward. |
| `#/crew` | Membership, mission, activity, reactions, and invites. |
| `#/friends` | Redirects to the crew hub. |
| `#/league` | Weekly standings and cosmetics. |
| `#/profile` | Editable profile and completed-action history. |
| `#/settings` | Account and application settings. |
| `#/measurement` | Seeded baseline/follow-up behavior measurement. |

Unknown routes render an in-app not-found state.

## Backend flow

The main authenticated photo path is:

1. `manage-mission` returns the stable task for the user’s local day.
2. `create-submission` accepts multipart `image`, `taskId`, `idempotencyKey`, and optional `locale`.
3. The Edge Function validates the image and task, analyzes the photo, records metadata, and returns `awaiting_check_in`, `failed`, or `unknown`.
4. `confirm-action` accepts the submission ID and records the self-reported recycling action. This is the only step that awards action, preparation, daily, streak, or crew progress.
5. The frontend renders the returned score breakdown and unlock data without recalculating them.

Additional Edge Functions support crew management, missions, profiles, activity, cosmetics, leagues, contacts, and weekly league jobs. See [supabase/README.md](./supabase/README.md) for function payloads and deployment commands.

## Project structure

```text
src/
  app/                    Router, route registry, session guards, and errors
  assets/                 Product images used by the frontend
  components/             Shared UI components
  config/                 Environment resolution
  features/ecocrew/       EcoCrew routes, mock data, state, and page utilities
  layouts/                Public and signed-in layouts
  lib/                    DOM and Supabase helpers
  pages/                  Auth, dashboard, action, result, crew, league, and profile screens
  services/               Auth, game, profile, crew, and mock adapters
  styles/                 Bootstrap setup, tokens, overrides, and feature Sass
public/assets/            Static asset placeholders
supabase/
  functions/               Edge Functions and shared TypeScript modules
  migrations/              Canonical database migrations
  tests/database/          SQL/RLS tests
  seed.sql                 Local and demo fixture data
tests/unit/                 Frontend unit tests
.github/workflows/ci.yml   Push and pull-request quality gate
```

## Validate changes

The frontend quality gate is:

```shell
npm test
```

It runs formatting checks, ESLint, Stylelint, Vitest, and the production Vite build. Individual commands are:

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite on port 3000. |
| `npm run build` | Create the production build in `dist/`. |
| `npm run preview` | Preview `dist/` on port 4173. |
| `npm run format:check` | Check JavaScript formatting. |
| `npm run lint:js` | Run ESLint. |
| `npm run lint:styles` | Run Stylelint on Sass. |
| `npm run test:unit` | Run Vitest unit tests. |
| `npx supabase test db` | Run Supabase SQL/RLS tests. |

## Security and product boundaries

- The browser never decides final points, streaks, membership, permissions, or unlocks.
- All sensitive mutations and model calls stay behind Supabase RPCs or Edge Functions.
- Item photos are private and ephemeral; profile photos use private avatar storage.
- The VLM is advisory and may return `unknown` or `ai_failure`; uncertainty must remain visible to the player.
- Analytics and activity data should not contain raw images, prompts, contact lists, or sensitive profile text.
- The initial ruleset is a single locale, `en-SG`; disposal guidance may differ in other jurisdictions.

See [CONTRACTS.md](./CONTRACTS.md) for the shared privacy, scoring, API, and ownership rules.

## Contributing

Before opening a pull request:

1. Keep frontend mock responses aligned with the shared result contracts.
2. Preserve the daily loop and its success, retry, low-confidence, and failure states.
3. Add or update tests for behavior changes.
4. Run `npm test` and, when backend behavior changes, `npx supabase test db`.
5. Do not commit `.env.local`, API keys, service-role keys, or other secrets.

Coordinate changes to shared routing, global Sass, database contracts, and Edge Function payloads with the relevant owners. Product scope and priorities are documented in [DEVPLAN.md](./DEVPLAN.md); the judge walkthrough is in [DEMO_PLAN.md](./DEMO_PLAN.md).

## License

See [LICENSE.md](./LICENSE.md) for the repository’s current license text.
