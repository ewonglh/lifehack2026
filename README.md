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

Bootstrap JavaScript plugins should be imported only by the component that uses them; do not add jQuery or a global Bootstrap bundle.
