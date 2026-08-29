# Person 2 Frontend Next Steps

This temporary plan follows the current vanilla JavaScript, Vite, Bootstrap, and Sass implementation. The React/TypeScript/Tailwind proposal in `DEVPLAN.md` is not adopted unless the team explicitly chooses another migration.

## 1. Lock shared product and API contracts

- Agree on the demo locale and recycling rules.
- Define the four disposal bins and representative test items.
- Confirm profile, privacy, friendship, submission, leaderboard, and error shapes.
- Confirm route names and ownership with the backend and competition owners.

## 2. Finish the frontend platform baseline

- Register the competition routes owned by the competition frontend developer:
  - `/dashboard`
  - `/sort`
  - `/result`
  - `/crew`
  - `/league`
- Mark each competition route as `private` so anonymous users are redirected to `/auth`.
- Keep `/dashboard` as a single route owned by the competition frontend developer; do not create duplicate dashboard registrations.
- Decide whether `/result` will later become `/result/:submissionId`, and reserve the dynamic route format in the hash router.
- Standardize page title, content, and lifecycle hooks.
- Complete loading, empty, error, permission-denied, and not-found states.
- Ensure the authenticated layout works on every protected route, including the five competition routes.
- Keep route registration, guards, and shared navigation under Person 2 ownership; feature page modules remain with the competition frontend developer.
- Keep Supabase calls inside service adapters rather than page components.

## 3. Replace mock identity/profile flows incrementally

- Receive the `profiles` schema and RLS policies from Person 1.
- Verify onboarding creates a profile and refreshes session state.
- Verify profile editing and privacy settings persist.
- Distinguish missing profiles from profile-query failures.
- Test session expiry and sign-out behavior.
- Keep mock mode available without adding mock-specific page logic.

## 4. Complete the friends feature against the shared contract

- Keep the current mock friends service while backend work is in progress.
- Define production adapter methods for search, request, accept, decline, remove, and list.
- Add fixtures for accepted, pending, empty, permission-denied, and failed states.
- Implement accessible UI for every state.
- Replace the adapter implementation when the backend contract is ready.

## 5. Prepare the competition-owner handoff

- Document route registration rules and page lifecycle hooks.
- Provide the competition owner with the route contract for `/dashboard`, `/sort`, `/result`, `/crew`, and `/league`.
- Require each feature page to accept `{ session, profile, profileError, navigate, params }` and to expose loading, empty, error, and recovery states.
- Provide reusable alerts, loading states, empty states, avatars, modals, status badges, and pagination.
- Provide mock fixtures for dashboard, submissions, leaderboard rows, quota, and failure states.
- Keep global tokens/styles under Person 2 ownership and competition styles under Person 3 ownership.
- Lock service interfaces before Person 3 connects real data.

## 6. Expand frontend verification

Add tests for:

- Router guards and route resolution.
- Session restoration and expiry.
- Mock/real environment selection.
- OAuth callback success and failure.
- Onboarding validation and profile persistence.
- Friends state transitions.
- Layout navigation and logout.
- Keyboard focus and form accessibility.

Run continuously:

```shell
npm test
npm run dev
```

## Completion criteria

The frontend foundation is ready for feature integration when a developer can sign in, complete onboarding, refresh the session, edit a profile, manage mock friends, sign out, and navigate to every registered feature route without blank screens or unhandled errors.

All competition routes (`/dashboard`, `/sort`, `/result`, `/crew`, and `/league`) must reject anonymous access, render inside the authenticated layout, and remain independently replaceable through their service adapters.
