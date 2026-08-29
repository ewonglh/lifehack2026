# LifeHack 2026

A Bootstrap-powered recycling competition web application, built with Vite, native ES modules, and Sass.

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer

Confirm your local versions:

```shell
node --version
npm --version
```

## Get started

From a clean clone, install the versions locked in `package-lock.json`:

```shell
npm ci
```

Use `npm install` only when intentionally changing dependencies; commit the resulting `package-lock.json` update with the related `package.json` change.

Start the development server:

```shell
npm run dev
```

Open <http://localhost:3000>. Vite provides hot module replacement while the server is running.

## Configure Supabase

The app can run in persistent local mock mode while the database schema is being developed. Mock mode uses browser localStorage and does not contact Supabase.

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

## Validate a change

Run the same checks used in CI:

```shell
npm test
```

This lints the SCSS in `src/` and creates a production build in `dist/`.

To inspect that production build locally:

```shell
npm run build
npm run preview
```

Then open <http://localhost:4173>.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000. |
| `npm run build` | Create an optimized production build in `dist/`. |
| `npm run preview` | Serve the existing production build on port 4173. |
| `npm run lint:styles` | Lint application SCSS. |
| `npm test` | Lint SCSS and create a production build. |

## Project layout

- `src/` contains browser code, layouts, components, feature modules, pages, and Sass.
- `public/` contains static assets copied unchanged into production builds.
- `supabase/` is reserved for database migrations and Edge Functions.
- `tests/` is reserved for unit, integration, and end-to-end tests.

The application uses hash routes, so static hosts do not need server-side SPA rewrite rules. Core frontend routes are `#/`, `#/auth`, `#/auth/callback`, `#/onboarding`, `#/dashboard`, `#/friends`, `#/profile`, and `#/settings`.

Bootstrap JavaScript plugins should be imported only by the component that uses them; do not add jQuery or a global Bootstrap bundle.
