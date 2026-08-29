# EcoCrew

EcoCrew is a mobile-first social sustainability game. Players complete a daily task, upload proof, earn points, and contribute to a private crew and shared streak.

The current repository contains a working frontend demo with deterministic mock analysis and browser persistence. Supabase authentication, database persistence, Storage, and the production VLM adapter remain integration work.

## Current demo features

- Responsive dashboard with daily task completion, points, crew streak, and cosmetic unlock progress.
- Post flow with camera/file upload, image preview, four disposal choices, simulated analysis, and a result breakdown.
- Register and login screens with browser validation and mock session state.
- Editable profile with name, handle, age, About Myself text, lifetime points, cosmetics, and a list of completed posts.
- Crew hub with Join and Create flows. The controls disappear after membership is saved, and a crew owner can delete their crew after confirmation.
- Crew activity feed, reactions, weekly league points that reset every Monday at midnight SGT, and cosmetic collection.
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

Open <http://localhost:3000/>. The root hash redirects to `#/dashboard`.

On PowerShell systems that allow npm scripts normally, `npm ci` and `npm run dev` also work. `npm.cmd` avoids a PowerShell execution-policy error caused by `npm.ps1` on some Windows installations.

Running npm from the parent `Lifehack Sustainability` directory produces an `ENOENT` error because that directory has no `package.json`. Alternatively, start the app from the parent directory with:

```powershell
npm.cmd --prefix ".\lifehack2026" run dev
```

## Routes

| Hash route | Screen |
|---|---|
| `#/` | Redirects to the dashboard |
| `#/register` | Create-account demo |
| `#/login` | Login demo |
| `#/dashboard` | Daily progress and primary Create Post action |
| `#/sort` | Create Post photo and bin-selection flow; the path is retained temporarily for compatibility |
| `#/result` | Classification guidance, points, crew progress, and unlock result |
| `#/crew` | Crew membership, feed, reactions, and invitations |
| `#/league` | Weekly cohort leaderboard and cosmetics |
| `#/profile` | Editable profile and My Posts history |

Unknown routes display an in-app not-found state.

## Demo data and persistence

The frontend currently uses `src/features/ecocrew/scan-service.js` as a mock adapter. It stores demo data under the `localStorage` key `ecocrew-demo-state`, including:

- daily post count and daily points;
- lifetime profile points, which do not reset;
- weekly league points and the active Singapore week key;
- the latest result;
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
- The backend owns canonical points, daily limits, membership, streaks, and unlocks.
- Keep mock responses aligned with [CONTRACTS.md](./CONTRACTS.md) while real services are developed.
- See [DEVPLAN.md](./DEVPLAN.md) for product priorities, ownership, milestones, and remaining work.

## Team ownership

- **Person 1 - Backend:** Supabase schema/RLS/Storage, Edge Functions, VLM adapter, scoring, quotas, streaks, and backend tests.
- **Person 2 - Frontend platform:** application bootstrap, shared router/layouts/components/styles, authentication integration, settings, and global accessibility/session behavior.
- **Person 3 (Irfan) - Product pages:** dashboard, Create Post flow, result, crew, activity, invitations, league, cosmetics, profile pages, feature-specific styling, and end-to-end user journeys.

Coordinate changes to shared routing, global Sass, and API shapes with the relevant owners before merging.
