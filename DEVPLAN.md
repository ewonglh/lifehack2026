# EcoCrew — Development Plan

## 1. Product summary

**EcoCrew** is a frontend-first social sustainability game. Players receive one task from a preset list each Singapore day, upload photo evidence on the Home page, and earn progress for themselves and a small crew. Shared streaks, fair per-person leagues, and cosmetic rewards make sustainable habits feel social and repeatable.

The core product principle is **delight first, obligation second**. Recycling education is delivered inside an entertaining game loop, never as a lecture.

## 2. Hackathon objective

Deliver one polished, end-to-end loop that proves the app can be fun enough to revisit, socially motivating, and clear to use:

1. Sign in and create or join a crew.
2. Review the randomly selected daily task on Home.
3. Take or upload a photo showing the completed task.
4. Submit the evidence and receive a clear point breakdown.
5. See the completed task in My Posts.
6. Contribute to the crew's shared streak and weekly league score.
7. See the crew feed, weekly league position, and cosmetic unlock path.

Do not prioritize broad integrations or a global leaderboard before this loop is smooth and enjoyable.

## 3. Rubric strategy

| Dimension | Weight | Product response | Demo proof |
|---|---:|---|---|
| Fun and engagement | 40% | Short daily tasks, rewarding completion feedback, crew reactions, and expressive cosmetics | A user completes a satisfying daily task and sends a reaction to a teammate |
| Behaviour change | 20% | Rotate practical tasks across recycling, reuse, litter reduction, and planting | The user completes a concrete sustainable action and uploads evidence |
| Stickiness | 20% | Daily challenge, shared crew streak, fair leagues, and limited cosmetics | A crew member returns to protect the streak and improve the crew's average league score |
| Craft and usability | 20% | One primary action per screen, clear confidence/correction controls, accessible feedback, mobile-first layout | A new user finishes the loop without explanation |

## 4. Target users and jobs to be done

- **Friends and families:** make a small everyday environmental habit more social and fun.
- **Casual recyclers:** quickly determine how to dispose of confusing household items.
- **Competitive players:** contribute to a crew, rise through weekly leagues, and display earned identity items.

Primary job: *Give me one practical sustainable action each day and make completing it feel rewarding.*

## 5. Core game design

### 5.1 Daily gameplay loop

1. The Home page displays one task randomly selected from the preset task list for the current Singapore day.
2. The player takes or uploads a photo showing the completed task.
3. The player submits the evidence from Home and receives completion feedback and a point breakdown.
4. A private-by-default post summary is added to the player's profile.
5. Daily, lifetime, and enrolled-league point totals update independently.
6. The player sees a lightweight social moment: teammate activity, reaction, or challenge invitation.

### 5.2 Scoring principles

Avoid rewarding raw recycling volume alone; that can unintentionally reward consumption and unfairly advantage larger households.

Suggested points:

| Action | Points | Notes |
|---|---:|---|
| Daily task completion | 10 | Main repeatable action reward |
| Photo evidence | 5 | Rewards documenting the completed action |
| First daily verified task | 10 | Supports the daily habit |
| Helpful correction / report | 3 | Improves system trust without farming points |
| Crew streak day completed | 5 shared bonus | Every active member benefits |

Allow one rewarded task completion per Singapore day. This keeps the game fair and focuses it on habit formation.

### 5.3 Social and retention mechanics

- **Eco Crews:** private groups of 3–8 people; default social unit.
- **Shared streak:** a crew succeeds when a minimum number of members complete an action each day.
- **Leagues:** crew owners may enroll crews with at least three members. Rankings use average points per member so larger crews do not have an automatic advantage.
- **Activity feed:** celebrate milestones, not every submission. Allow quick emoji/reaction responses.
- **Cosmetics:** avatars, frames, badges, and crew banners earned through achievements and weekly placement.

## 6. Scope and priorities

### Must have (demo MVP)

- Supabase email/social authentication.
- Profile creation and a single crew creation/join flow.
- Mobile-first Home submission, result, crew, league, and reward views.
- Photo evidence analysis endpoint integration, with a mocked fallback response for reliable demos.
- Clear task-completion confirmation and evidence feedback.
- Points, daily activity, league enrollment, and shared streak persistence.
- Small seeded activity feed and weekly leaderboard.
- At least six polished cosmetic items with one visible unlock.

### Should have (if time permits)

- Contact import/invite flow with clear consent and a manual invite link fallback.
- Personal and crew achievement badges.
- Notification preferences and an in-app reminder prompt.
- A configurable task catalog with seasonal or campus-specific task sets.
- Microinteractions, haptics on mobile, and sound toggle.

### Explicitly defer

- Nationwide/global ranking at real scale.
- A full points shop economy or real-world rewards.
- Multiple institution-specific task catalogs.
- Full Facebook Friends integration. Modern platform permissions can be restrictive; build a simple invite-link/share flow first.
- Fully automated enforcement. User confirmation must remain part of the loop.

## 7. UX requirements

- The daily path should take less than 30 seconds with a typical photo.
- Always show an understandable fallback when task evidence is uncertain and let the user retry.
- Never silently punish a user for model ambiguity; show verification feedback without inventing certainty.
- Make every reward explain itself: points earned and next unlock.
- Keep social sharing opt-in per activity, with clear controls for profile visibility and deletion of task evidence.
- Ensure keyboard access, readable contrast, clear text labels, and motion-reduction support.

## 8. Technical plan

### 8.1 Proposed stack

- **Frontend:** native JavaScript ES modules, Vite, Bootstrap, Bootstrap Icons, and Sass.
- **Backend services:** Supabase Auth, Postgres, Row Level Security, Storage, and Edge Functions.
- **Vision:** VLM called from an Edge Function so API credentials are never exposed in the browser.
- **State/data fetching:** TanStack Query or equivalent; optimistic updates for task completion and reactions.
- **Deployment:** Vercel/Netlify frontend plus Supabase project.

### 8.2 Important architecture decision

The UI may be frontend-only in the sense that it needs no custom server to run, but the VLM call must be proxied through a secure Supabase Edge Function. Do not call the VLM directly from client-side JavaScript with a secret API key.

### 8.3 Data model (initial)

| Table | Key fields | Purpose |
|---|---|---|
| `profiles` | `id`, `display_name`, `handle`, `age`, `about`, `avatar_id`, `frame_id`, `privacy_settings` | Player identity, About Myself content, and preferences |
| `crews` | `id`, `name`, `owner_id`, `weekly_points`, `league` | Private competition group |
| `crew_members` | `crew_id`, `profile_id`, `role`, `joined_at` | Crew membership |
| `daily_tasks` | `id`, `title`, `guidance`, `active` | Preset sustainability task catalog |
| `task_submissions` | `id`, `profile_id`, `task_id`, `image_path`, `verification_result`, `points`, `created_at`, `profile_visible` | Auditable evidence and source for a profile post summary |
| `daily_progress` | `profile_id`, `day`, `verified_actions`, `points` | One-completion daily limit and habit tracking |
| `crew_streaks` | `crew_id`, `current_streak`, `last_completed_day` | Shared retention mechanic |
| `league_entries` | `league_id`, `crew_id`, `joined_at`, `member_count` | Eligible crew enrollment and weekly participation |
| `inventory_items` | `id`, `type`, `name`, `unlock_rule` | Cosmetics catalog |
| `profile_inventory` | `profile_id`, `item_id`, `equipped` | Earned/equipped cosmetics |

Apply Row Level Security so users can only read their own sensitive task submissions and content within crews they belong to. Store the minimum image data needed; support deletion.

### 8.4 Evidence-verification response contract

Normalize all model output into structured JSON:

```json
{
  "task_id": "recycle-plastic-bottle",
  "outcome": "verified",
  "confidence": 0.86,
  "reason": "The evidence shows the assigned recycling action."
}
```

Validate the schema before displaying it. If confidence is low or the image is unclear, ask the user to retry and label the outcome as unverified rather than inventing certainty.

## 9. Implementation milestones

### Milestone 0 — Product framing (1–2 hours)

- Name the product EcoCrew and write the one-sentence pitch.
- Select Singapore as the daily reset timezone for the demo.
- Define and review the preset sustainability task list.
- Prepare two crew personas and seeded demo activity.

### Milestone 1 — Foundation (2–3 hours)

- Initialize frontend, design tokens, Supabase project, and environment handling.
- Implement auth, profile setup, and schema/RLS migrations.
- Build responsive app shell, nav, and empty states.

### Milestone 2 — Home task submission (3–5 hours)

- Build the Home camera/upload interaction with image preview and completion checkbox.
- Implement the task-completion result reveal and point breakdown.
- Add Edge Function, evidence schema validation, and deterministic mocked fallback.
- Persist task submissions, calculate points, and prevent duplicate daily awards.

### Milestone 3 — Crew magic (3–4 hours)

- Create/join crew flow using an invite code or link; hide membership actions after joining.
- Add an invitation dropdown for X, Instagram, Telegram, and WhatsApp while retaining a copy-link fallback.
- Add shared streak, activity feed, and quick reactions.

### Milestone 4 — Progression and polish (2–4 hours)

- Implement weekly league cards and a local/mock leaderboard.
- Add cosmetics inventory, equip action, and one unlock celebration.
- Refine loading, error, empty, permission-denied, and uncertain-model states.
- Test mobile layout and accessibility essentials.

### Milestone 5 — Demo hardening (1–2 hours)

- Record/seed reliable results for a handful of known objects.
- Rehearse the exact demo path without network dependence.
- Prepare a short explanation of privacy, fairness, and VLM limitations.

## 10. Acceptance criteria

- A new user can register or sign in, join/create a crew, complete a daily task from Home, and see updated profile progress in one session.
- The task-evidence experience handles success, low confidence, and API failure without dead ends.
- Points have a visible explanation and lead to at least one meaningful reward.
- A crew streak has an understandable rule.
- The social layer works with a manual invite link even when contact integrations are unavailable.
- The app is attractive and legible on a phone-sized viewport.
- No secret VLM key is present in browser code or client environment variables.

## 11. Hackathon demo script (about 3 minutes)

1. Open EcoCrew as a player in the "Glass Guardians" crew.
2. Show the crew is one contribution away from preserving its streak.
3. Review today's task on Home, upload evidence, and receive the result reveal.
4. Show the task-completion, photo-evidence, and daily-bonus point breakdown.
5. React to a teammate or show their recent contribution.
6. Reveal a newly unlocked profile frame and the crew’s movement in its weekly league.
7. Close with the key claim: EcoCrew turns a confusing everyday decision into a social, repeatable game.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| VLM incorrectly verifies evidence | Let users retry or report results; present uncertainty; use curated demo evidence and a safe fallback state |
| Tasks are unsuitable for a user’s context | Keep the catalog configurable and provide accessible alternatives before production |
| Social API access is restricted | Use invite links and share sheets as the dependable MVP path |
| Users game submission volume | Enforce one rewarded completion per Singapore day and idempotent scoring |
| Leaderboards demotivate new users | Emphasize small crews and matched weekly leagues; make global rank optional |
| Privacy concerns over photos | Store minimally, document consent, allow deletion, and never share task evidence by default |

## 13. Post-hackathon roadmap

1. Pilot with 10–20 small crews and measure daily completion, week-two retention, correction rate, and crew invite conversion.
2. Add locality-specific rules and stronger item recognition only after validating the daily loop.
3. Test daily tasks across waste avoidance, reuse, planting, litter reduction, and recycling.
4. Evolve the cosmetic shop based on what players actually return for.
5. Explore partnerships or tangible rewards only after the social habit loop demonstrates retention.

## 14. Current implementation status (29 August 2026)

The current branch is a frontend demo. Completed behavior is backed by deterministic fixtures and browser storage unless stated otherwise.

### Implemented

- Vite/Bootstrap/Sass application shell with hash routing and mobile bottom navigation.
- Routes for register, login, Home, result, crew, league, and profile screens; the legacy `#/sort` path redirects to Home.
- Mock register/login interaction with client validation and session storage.
- Home-based daily task with camera/file selection, image preview, submission action, completion checkbox, points, shared streak, and next unlock.
- One randomly selected task per Singapore day from the preset task catalog.
- Simulated evidence analysis, task-completion result, and task-specific point breakdown.
- Browser-state normalization and service-level guards for daily caps, profile fields, crew membership, crew capacity, and one active league per crew.
- Node regression tests for task awards, cosmetic persistence, membership rules, storage recovery, and protected profile statistics.
- Automatic profile post summary after a completed daily task.
- Editable profile fields for name, handle, age, and About Myself, persisted in local storage.
- Profile statistics, cosmetic collection, empty post state, and My Posts history.
- Join and Create crew forms with locally persisted membership. Join/Create controls are hidden after membership exists.
- Owner-only Delete Crew action and member-only Leave Crew action with confirmation; both preserve personal posts and lifetime points.
- Invite dropdown with X, Instagram, Telegram, and WhatsApp actions.
- Owner-controlled NUS and SUTD demo league enrollment for crews with at least three members, limited to one active league per crew, with per-league standings and Leave League support.
- Separate daily, lifetime, and weekly point counters. Lifetime profile points never reset; league points reset each Monday at 00:00 Asia/Singapore and rankings use average points per member.
- Reusable top-right Info control on every registered screen, including authentication and not-found pages.
- Seeded activity feed with reactions, weekly crew league, and cosmetic equip interactions.
- Responsive feature styling, semantic labels, keyboard controls, and reduced-motion handling.
- Stylelint and Vite production build passing through `npm test`.

### Integration still required

- Replace mock authentication/session state with Supabase Auth and route protection.
- Replace local profile, task-submission, membership, reactions, and points state with RLS-protected Postgres data.
- Upload original photos to a private Storage bucket and use short-lived signed upload details.
- Connect the Home task-submission flow to the trusted evidence-analysis Edge Function and normalized response.
- Implement server-side scoring, daily limits, idempotency, streak transactions, league eligibility, and unlocks.
- Add low-confidence, invalid-image, offline, permission-denied, retry, and backend-failure states.
- Make profile-post visibility opt-in and add deletion/privacy controls.
- Add unit, integration, and end-to-end tests for the complete player journey.

### Terminology decision

The user-facing action is a **daily task submission** on Home. Completed evidence appears in **My Posts**. `scan-service.js` and the compatibility route `#/sort` remain temporary internal names; `#/sort` redirects to Home. New backend contracts should use task/submission terminology.

## 15. Three-person implementation ownership

### Person 1 - Backend owner

- Owns `supabase/**`, schema migrations, RLS, private Storage policies, seed data, RPCs, and Edge Functions.
- Owns evidence normalization, scoring, idempotency, daily limits, crew and league membership mutations, streaks, and canonical error codes.
- Publishes the canonical contracts and integration fixtures consumed by the frontend.

### Person 2 - Frontend platform owner

- Owns `index.html`, `src/main.js`, shared route registration, session integration, layouts, common components, global Sass, tokens, package configuration, and application-wide test setup.
- Owns real authentication integration, route guards, shared loading/error behavior, settings, and global responsive/accessibility behavior.

### Person 3 - Product-page owner (Irfan)

- Owns Home task submission, result, crew, activity, invitations, league, cosmetics, and profile page behavior.
- Owns `src/features/ecocrew/**`, relevant page modules, feature-specific Sass, mock fixtures, and the end-to-end demo journey.
- Integrates these pages against Person 1's contracts without calculating trusted production awards in the browser.

### Merge and integration order

1. Freeze normalized profile, task submission, crew membership, analysis, scoring, and error contracts.
2. Integrate Supabase Auth and profile creation.
3. Integrate crew create/join and invitation links.
4. Integrate private task-evidence upload, analysis, confirmation, and scoring.
5. Integrate posts, crew activity, reactions, streaks, league, and cosmetics.
6. Replace remaining browser persistence and run the full mobile end-to-end journey.
