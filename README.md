# EcoCrew

EcoCrew is a mobile-first social recycling game. Players post a photo of a household item, choose the bin they think is correct, receive AI-assisted disposal guidance, and contribute points to a private crew, weekly mission, and shared streak.

The current repository contains a working frontend demo with deterministic mock analysis and browser persistence. Supabase authentication, database persistence, Storage, and the production VLM adapter remain integration work.

## Current demo features

- Responsive dashboard with daily post allowance, points, crew streak, mission progress, and cosmetic unlock progress.
- Post flow with camera/file upload, image preview, four disposal choices, simulated analysis, and a result breakdown.
- Register and login screens with browser validation and mock session state.
- Editable profile with name, handle, age, About Myself text, lifetime points, cosmetics, and a list of completed posts.
- Crew hub with Join and Create flows. The controls disappear after membership is saved, and a crew owner can delete their crew after confirmation.
- Crew mission, activity feed, reactions, weekly league points that reset every Monday at midnight SGT, and cosmetic collection.
- Crew invite dropdown for X, Instagram, Telegram, and WhatsApp. Instagram copies the invite link for pasting; the other choices open their web share flow.
- An Info control in the top-right corner of every page explains that screen’s purpose.
- Keyboard-friendly controls, labelled bin choices, responsive layouts, and reduced-motion support.

## Technology

- Vite 8
- Native JavaScript ES modules
- Bootstrap 5 and Bootstrap Icons
- Sass and Stylelint
- Hash-based client routing
- Supabase project structure and Edge Function scaffolding

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer

Check the installed versions:

```shell
node --version
npm --version
```

## Run locally

Run commands from the directory that contains this README and `package.json`:

```powershell
cd "C:\Users\Mohamed Irfan\Documents\Lifehack Sustainability\lifehack2026"
npm.cmd ci
npm.cmd run dev
```

Open <http://localhost:3000/>. The root hash redirects to `#/auth`.

On PowerShell systems that allow npm scripts normally, `npm ci` and `npm run dev` also work. `npm.cmd` avoids a PowerShell execution-policy error caused by `npm.ps1` on some Windows installations.

Running npm from the parent `Lifehack Sustainability` directory produces an `ENOENT` error because that directory has no `package.json`. Alternatively, start the app from the parent directory with:

```powershell
npm.cmd --prefix ".\lifehack2026" run dev
```

## Configure Supabase

The app can run in persistent local mock mode while the database schema is being developed. Mock mode uses browser localStorage and does not contact Supabase.

With Docker Desktop or Podman running, reset the local Supabase database to the current migrations and seed fixture with:

```powershell
npm.cmd run db:reset
```

This is equivalent to `npx supabase db reset`; it discards local database changes and reruns `supabase/seed.sql`. It does not reset a linked remote project.

To reset the linked remote project and reload the seed fixture, run:

```powershell
npm.cmd run db:reset:remote
```

This permanently deletes data in the linked remote database before replaying the local migrations and seed. Use it only for a disposable development or staging project, and verify the linked project before confirming the CLI prompt.

To connect a Supabase project, copy `.env.example` to `.env.local` and add only browser-safe project values:

```shell
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

For schema-free local testing, use this instead in `.env.local`:

```shell
VITE_USE_MOCK_DATA=true
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The mock flag is honored only by Vite development builds. On the sign-in page, choose **Reset local demo data** to clear the dummy user, profile, and friends.

Add `http://localhost:3000/?auth_callback=1#/auth/callback` and the equivalent deployed URL to Supabase Auth’s allowed redirect URLs before testing Google OAuth or magic links. Never add a Supabase service-role key or an OpenAI key to a `VITE_` variable. The current frontend expects a `profiles` table; the friend service remains mock-backed until the backend friendship contract is merged.

## Routes
| Hash route | Screen |
|---|---|
| `#/` | Redirects to sign in |
| `#/register` | Create-account demo |
| `#/login` | Login demo |
| `#/dashboard` | Daily progress and primary Create Post action |
| `#/sort` | Create Post photo and bin-selection flow; the path is retained temporarily for compatibility |
| `#/result` | Classification guidance, points, crew progress, and unlock result |
| `#/crew` | Crew membership, mission, feed, reactions, and invitations |
| `#/league` | Weekly cohort leaderboard and cosmetics |
| `#/profile` | Editable profile and My Posts history |

Unknown routes display an in-app not-found state.

## Demo data and persistence

The frontend currently uses `src/features/ecocrew/scan-service.js` as a mock adapter. It stores demo data under the `localStorage` key `ecocrew-demo-state`, including:

- daily post count and daily points;
- lifetime profile points, which do not reset;
- weekly league points and the active Singapore week key;
- mission progress and the latest result;
- profile edits;
- profile post summaries;
- crew membership and invite code;
- activity reactions.

Login/register actions set `ecocrew-demo-signed-in` in `sessionStorage`. This is demonstration state only: there is currently no route guard, password storage, or real authentication.

To reset the demo and make Join/Create visible again, run this in the browser console and refresh:

```js
localStorage.removeItem('ecocrew-demo-state');
sessionStorage.removeItem('ecocrew-demo-signed-in');
```

Do not treat browser-calculated points, membership, or profile data as trusted production state. Supabase and trusted server functions will become canonical during integration.

## Project layout

```text
src/
  app/                     Hash router and route registry
  features/ecocrew/        Mock fixtures, state adapter, routes, and page utilities
  layouts/                 Signed-in application navigation
  pages/                   Auth, dashboard, post, result, crew, league, and profile screens
  styles/                  Bootstrap setup and scoped EcoCrew feature styles
supabase/
  functions/               Edge Function and shared analysis scaffolding
  migrations/              Canonical database changes when added by the backend owner
public/assets/              Static images and icons
tests/                      Unit, integration, and browser tests when added
```

The application uses hash routes, so static hosts do not need server-side SPA rewrite rules. The root route `#/` redirects to `#/auth`; authenticated users then continue to onboarding or the dashboard. Core frontend routes are `#/auth`, `#/auth/callback`, `#/onboarding`, `#/dashboard`, `#/friends`, `#/profile`, and `#/settings`.

Bootstrap JavaScript plugins should be imported only by the component that uses them; do not add jQuery or a global Bootstrap bundle.
The user-facing term is **Post**. Some internal names such as `submit-page`, `scan-service`, `scan_event`, and the `#/sort` route remain because a post is backed by a recycling scan attempt. Rename those only as a coordinated contract migration.

## Validate changes

```powershell
npm.cmd test
```

This runs Stylelint and creates a production Vite build. Other commands are:

| Command | Purpose |
|---|---|
| `npm.cmd run dev` | Start Vite on port 3000 |
| `npm.cmd run build` | Create an optimized build in `dist/` |
| `npm.cmd run preview` | Serve `dist/` on port 4173 |
| `npm.cmd run lint:styles` | Lint all Sass files |
| `npm.cmd test` | Run style linting and the production build |

## Integration rules

- VLM credentials must stay in a Supabase Edge Function; never expose them in client JavaScript or `VITE_*` variables.
- Item photos remain private by default. A profile post currently exposes only a disposal summary, not the image.
- The backend owns canonical points, daily limits, membership, streaks, missions, and unlocks.
- Keep mock responses aligned with [CONTRACTS.md](./CONTRACTS.md) while real services are developed.
- See [DEVPLAN.md](./DEVPLAN.md) for product priorities, ownership, milestones, and remaining work.

## Team ownership

- **Person 1 - Backend:** Supabase schema/RLS/Storage, Edge Functions, VLM adapter, scoring, quotas, missions, streaks, and backend tests.
- **Person 2 - Frontend platform:** application bootstrap, shared router/layouts/components/styles, authentication integration, settings, and global accessibility/session behavior.
- **Person 3 (Irfan) - Product pages:** dashboard, Create Post flow, result, crew, activity, invitations, league, cosmetics, profile pages, feature-specific styling, and end-to-end user journeys.

Coordinate changes to shared routing, global Sass, and API shapes with the relevant owners before merging.
