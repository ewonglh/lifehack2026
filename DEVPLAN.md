# EcoCrew — Development Plan

## 1. Product summary

**EcoCrew** is a frontend-first social recycling game. Players photograph a household item, make a fast sorting decision, receive AI-assisted guidance, and earn progress for a small crew of friends or family. Weekly missions, forgiving shared streaks, and cosmetic rewards make correct disposal feel like a repeatable social ritual rather than a chore.

The core product principle is **delight first, obligation second**. Recycling education is delivered inside an entertaining game loop, never as a lecture.

## 2. Hackathon objective

Deliver one polished, end-to-end loop that proves the app can be fun enough to revisit, socially motivating, and clear to use:

1. Sign in, create a profile, and optionally create or join a crew.
2. Receive one stable, per-user daily task based on the user’s local calendar day.
3. Start the task, take or upload an item photo, and submit it directly to the backend.
4. Receive ephemeral AI task validation, the result, points, streak status, and progression updates.
5. See individual progress when not in a crew, or crew progress, streak, and league status when in one.
6. React to teammate activity and follow the crew’s cosmetic unlock path.

Do not prioritize broad integrations or a global leaderboard before this loop is smooth and enjoyable.

## 3. Rubric strategy

| Dimension | Weight | Product response | Demo proof |
|---|---:|---|---|
| Fun and engagement | 40% | Animated sorting reveal, playful weekly theme, short rounds, crew reactions, expressive cosmetics | A user completes a satisfying 20-second challenge and sends a reaction to a teammate |
| Behaviour change | 20% | Reward correctly sorted and prepared items; give one actionable local-style disposal tip | The user learns to rinse/empty an item or sees why an item belongs in landfill |
| Stickiness | 20% | Daily challenge, shared crew streak, weekly missions, leagues, limited cosmetics, streak repair token | A crew is one action away from protecting its streak and advancing its mission |
| Craft and usability | 20% | One primary action per screen, clear confidence guidance, accessible feedback, mobile-first layout | A new user finishes the loop without explanation |

## 4. Target users and jobs to be done

- **Friends and families:** make a small everyday environmental habit more social and fun.
- **Casual recyclers:** quickly determine how to dispose of confusing household items.
- **Competitive players:** contribute to a crew, rise through weekly leagues, and display earned identity items.

Primary job: *When I am about to throw something away, help me make the right choice quickly and make the action feel rewarding.*

## 5. Core game design

### 5.1 Daily gameplay loop

1. The home screen presents one clear CTA: **Sort today’s item**.
2. The player opens the assigned task and photographs or uploads an item.
3. The client sends the image as multipart/form-data to the authenticated Edge Function; the image remains in memory only for that invocation and AI request.
4. The AI validates whether the image satisfies the task and the game reveals the validation outcome, points, failure reason (if any), and a preparation tip.
5. A successful validation records task metadata, updates the individual streak, and updates crew/league progress where applicable. A failed validation records a non-scoring attempt only.
6. The player sees a lightweight social moment: teammate activity, reaction, or challenge invitation.

### 5.2 Scoring principles

Avoid rewarding raw recycling volume alone; that can unintentionally reward consumption and unfairly advantage larger households.

Suggested points:

| Action | Points | Notes |
|---|---:|---|
| Validated task completion | 10 | Main repeatable skill reward; exact task scoring is configured by the task catalog |
| Correct preparation step | 5 | e.g. empty, rinse, flatten, separate |
| First daily verified action | 10 | Supports the daily habit |
| Weekly mission contribution | 5–20 | Reward only mission-relevant actions |
| Low-confidence scan | 3 | Rewards completing a scan while keeping uncertainty visible |
| Crew streak day completed | 5 shared bonus | Every active member benefits |

Use a daily cap for repeat task points. These are task/activity points, not crew XP. Crew XP is awarded only when a league is finalized, using the finalized crew score.

### 5.3 Social and retention mechanics

- **Eco Crews:** private groups; four active members are required before the crew can queue for a league.
- **Shared streak:** a crew succeeds when a minimum number of members complete an action each day. Include one repair token weekly.
- **Weekly missions:** rotating co-op goals with a playful theme, such as "Glass Guardians" or "Defeat the Landfill Monster."
- **Leagues:** crews compete in matched weekly cohorts, rather than only against an unreachable global top list.
- **Activity feed:** celebrate milestones, not every scan. Allow quick emoji/reaction responses.
- **Cosmetics:** avatars, frames, badges, and crew banners unlocked by crew XP and made available to current crew members.

## 6. Scope and priorities

### Must have (demo MVP)

- Supabase email/social authentication.
- Profile creation and a single crew creation/join flow.
- Mobile-first home, scan, sorting, result, crew, and reward views.
- VLM photo classification endpoint integration, with a mocked fallback response for reliable demos.
- Automatic classification result display with confidence and uncertainty handling.
- Points, daily activity, simple crew challenge, and shared streak persistence.
- Small seeded activity feed and weekly leaderboard.
- At least six polished cosmetic items with one visible unlock.
- Daily task assignment and metadata-only AI validation for both crew and non-crew users.
- A private avatar bucket with authenticated upload, replacement cleanup, and signed reads.
- League queue/matchmaking and finalization-ready league standings for crews with at least four active members.

### Should have (if time permits)

- Opt-in Google Contacts and Facebook synchronization with a manual invite-link fallback.
- Contact-based leaderboard views subject to consent and privacy rules.
- Personal and crew achievement badges.
- Notification preferences and an in-app reminder prompt.
- Location-aware disposal rules, beginning with one supported locale.
- Microinteractions, haptics on mobile, and sound toggle.

### Explicitly defer

- Nationwide/global ranking at real scale.
- A full points shop economy or real-world rewards.
- Multiple recycling-rule jurisdictions.
- Fully automated enforcement beyond the demo ruleset.

## 7. UX requirements

- The daily path should take less than 30 seconds with a typical photo.
- Always show an understandable fallback when classification is uncertain: "Not sure—check the local disposal guidance before discarding this item."
- Never silently punish a user for model ambiguity; show confidence as helpful guidance and route uncertain scans to a safe fallback state.
- Make every reward explain itself: points earned, mission progress, and next unlock.
- Keep social sharing opt-in per activity, with clear controls for profile visibility and contact-sync consent. Task images are never persisted.
- Ensure keyboard access, readable contrast, non-color-only bin labels, and motion-reduction support.

## 8. Technical plan

### 8.1 Proposed stack

- **Frontend:** JavaScript, Vite, Bootstrap, and Sass; Tailwind CSS and a small animation library.
- **Backend services:** Supabase Auth, Postgres, Row Level Security, Storage, and Edge Functions.
- **Vision:** AI task validation called from an Edge Function so API credentials are never exposed in the browser; submitted task images are held in memory only.
- **State/data fetching:** TanStack Query or equivalent; optimistic updates for scan completion and reactions.
- **Deployment:** Vercel/Netlify frontend plus Supabase project.

### 8.2 Important architecture decision

The UI may be frontend-only in the sense that it needs no custom server to run, but the VLM call must be proxied through a secure Supabase Edge Function. Do not call the VLM directly from client-side JavaScript with a secret API key.

### 8.3 Data model (initial)

| Table | Key fields | Purpose |
|---|---|---|
| `profiles` | `id`, `display_name`, `location`, `about`, `age_visibility`, `avatar_path`, `privacy_settings` | Player identity and preferences; use deployed fields rather than obsolete `country`, `bio`, or `is_public` |
| `crews` / `crew_members` | crew ownership, active membership, role, join/leave timestamps | Private groups and fixed-day membership evaluation |
| `task_catalog` | prompt, target object/material/action, locale, active status, AI validation metadata | Seeded, admin-managed task definitions |
| `user_daily_tasks` | user, task, local day, assignment state | One deterministic, stable task assignment per user per local calendar day |
| `task_submissions` | user, task, submission date, classification, validation status, recognized object, points, failure reason | Metadata-only audit trail; never store image binaries or image paths |
| `user_streaks` / `crew_streaks` | current streak, last completed day, repair tokens | Separate individual and crew streak state |
| `crew_progression` / `crew_cosmetics` | crew XP, unlocks, thresholds | Crew-owned progression; XP is credited only at league finalization |
| `crew_cosmetic_equipment` | crew member, cosmetic, equipped state | Optional member equipment, removed on departure |
| `leagues` / `league_queue` / `league_rosters` | league lifecycle, queued crews, start snapshot | Canonical league model and matchmaking queue |
| `league_daily_scores` / `league_finalizations` | roster completion, fractional scores, finalization idempotency | Seven-day scoring and protected finalization record |
| `weekly_missions` / `mission_progress` | task themes and progress | Optional co-op mission presentation layer |
| `inventory_items` | type, name, unlock threshold | Cosmetic catalog |
| `contact_consents` / `contact_provider_links` / `contact_hashes` | opt-in state, provider linkage, sync time, normalized hashed identifiers | Contact matching without raw address-book persistence |

Apply Row Level Security and database-transaction authorization so users can read only their own sensitive task records and content allowed by current crew/privacy rules. Store no task image data. Avatar files belong in a private `avatars` bucket, limited to JPEG/PNG/WebP, with user-scoped object paths and a documented size limit.

### 8.4 AI task-validation contract

Normalize all model output into structured JSON:

```json
{
  "item_name": "plastic drink bottle",
  "material": "PET plastic",
  "recommended_bin": "recycle",
  "preparation_tip": "Empty and replace the cap before recycling.",
  "confidence": 0.86,
  "reason": "The image shows a clear PET beverage bottle.",
  "task_satisfied": true,
  "failure_reason": null
}
```

Validate the schema before displaying it. The AI request must evaluate the assigned task, not merely classify a disposal bin. If confidence is low, the image is unclear, or the task is not satisfied, show a safe fallback and award zero points. `analyze-submission` may expose the same process as a non-scoring preview.

### 8.5 Backend rules and user flow

The following rules supersede the original frontend-first assumptions:

- `manage-mission` fetches or creates the stable daily task for both crew and non-crew users. Individual users can complete tasks and earn individual streak/leaderboard statistics, but never crew XP.
- A user streak increments after at least one AI-validated task on each local calendar day. A crew streak requires at least `ceil(active_member_count / 2)` assigned-task completions. Membership and completion counts use a fixed day boundary.
- A crew leader can queue only when they are the active owner, the crew has at least four active members, and it is not already queued or in an active league.
- A scheduled matchmaking job uses a fixed UTC weekly cutoff, randomly shuffles eligible crews, creates leagues of six to eleven crews, snapshots rosters, and leaves insufficient unmatched crews queued. Crew size is not a matchmaking factor.
- For each league day, `daily_score = 100 * completed_roster_members / total_roster_members`, retaining fractional precision. At league end, `final_score = sum(daily_score) * (streak_days / 7)`.
- Matchmade leagues run for seven days; the streak multiplier ranges from 0% to 100% and is applied only at finalization. `leagues` is canonical for new behavior; the existing `contests` model is legacy.
- Only the idempotent, concurrency-safe finalization transaction may close a league, persist ranks, credit crew XP, unlock cosmetics, and emit league/streak/unlock events.
- Leaving or being removed from a crew deletes that member’s crew cosmetic inventory/equipment while preserving historical task and leaderboard records. Ownership transfer preserves crew progression and cosmetics.
- `manage-profile` supports profile metadata and avatar updates. Avatar replacement uploads the new file first, then removes the prior object; reads use a signed/private URL.
- `manage-league`, `manage-cosmetics`, `manage-squad`, and `manage-activity` expose league state, current-crew cosmetics, queue/membership rules, and privacy-controlled events respectively. All mutating authorization derives the actor from the JWT and is enforced in the database transaction/RPC layer.
- Read-only leaderboards cover user performance within the current crew, crew league standings, and individual performance against matched contacts. They show contacts only when both consent and visibility rules pass; revocation removes provider access and stops matching.

### 8.6 Edge Function responsibilities

| Function | Responsibility |
|---|---|
| `create-submission` | Accept direct multipart image data, resolve the authenticated user’s daily task, validate with AI, and persist metadata only |
| `analyze-submission` | Optional direct-image, non-scoring preview endpoint |
| `manage-squad` | Manage membership and ownership; enforce queue eligibility and clear crew cosmetics on departure |
| `manage-mission` | Retrieve or create crew and individual daily tasks |
| `manage-league` | Expose queue, current league, standings, daily scores, and final results |
| `manage-cosmetics` | Read/equip cosmetics for the authenticated user’s current crew only |
| `manage-profile` | Manage profile metadata and avatar path updates |
| `manage-activity` | Preserve reactions and privacy controls for task, streak, unlock, and league events |
| Scheduled/internal job | Run weekly matchmaking and idempotent league finalization |

All mutating functions derive the actor from the authenticated JWT. Sensitive authorization and state transitions must be enforced again in the database transaction/RPC layer.

## 9. Implementation milestones

### Milestone 0 — Product framing (1–2 hours)

- Name the product EcoCrew and write the one-sentence pitch.
- Select a single recycling ruleset/locale for the demo.
- Define four disposal bins and 10–15 representative test items.
- Prepare two crew personas and seeded demo activity.

### Milestone 1 — Foundation (2–3 hours)

- Initialize frontend, design tokens, Supabase project, and environment handling.
- Implement auth, profile setup, avatar bucket, and schema/RLS migrations.
- Build responsive app shell, nav, and empty states.

### Milestone 2 — The sorting game (3–5 hours)

- Build camera/upload interaction with image preview.
- Implement assigned-task UI and result reveal.
- Add multipart Edge Function, AI task-validation schema, strict validation, and deterministic mocked fallback.
- Persist submission metadata only; record failed validations with zero points and discard image data.

### Milestone 3 — Crew magic (3–4 hours)

- Create/join crew flow using invite code or link.
- Add individual and crew streaks, crew goal, activity feed, and quick reactions.
- Seed a weekly mission and show progress animations.

### Milestone 4 — Progression and polish (2–4 hours)

- Implement league queue eligibility, weekly league cards, daily scores, and final-results states.
- Add crew XP/cosmetics inventory, current-crew equip action, and one unlock celebration.
- Add profile/settings avatar and privacy controls plus opt-in contact leaderboard state.
- Refine loading, error, empty, permission-denied, and uncertain-model fallback states.
- Test mobile layout and accessibility essentials.

### Milestone 5 — Demo hardening (1–2 hours)

- Record/seed reliable results for a handful of known objects.
- Rehearse the exact demo path without network dependence.
- Prepare a short explanation of privacy, fairness, and VLM limitations.

## 10. Acceptance criteria

- A new user can authenticate, create a profile, receive a stable daily task, upload an avatar, and submit a task image in one session.
- A non-crew user can complete a validated task and see an individual streak and leaderboard statistics without earning XP.
- The task experience handles success, failed validation, low confidence, invalid payloads, and AI failure without dead ends or persisted image data.
- Points have a visible explanation and lead to at least one meaningful reward.
- A four-member crew can queue once, enter a randomly matched six-to-eleven-crew league, and see fractional daily scoring.
- Crew streak eligibility visibly reflects the `ceil(active_member_count / 2)` rule and fixed-day membership.
- Crew XP and cosmetics are credited only once at league finalization; departure removes access while preserving history.
- The social layer works with a manual invite link even when contact integrations are unavailable, and contact results require consent and privacy eligibility.
- The app is attractive and legible on a phone-sized viewport.
- No secret VLM key is present in browser code or client environment variables.

## 11. Test plan

### Database, RPC, and Edge Function tests

- Stable one-task-per-user/day assignment, local timezone boundaries, and different assignments for different users.
- Individual completion without a crew; no XP from individual completions.
- Ownership checks prevent submitting against another user’s task.
- Failed/low-confidence AI validation records metadata and zero points; no binary or image path is stored.
- Multipart validation, unsupported payloads, AI timeout/provider failure, and duplicate submission idempotency.
- Avatar type/size, ownership, replacement cleanup, private reads, and deletion.
- Crew queue rules, owner-only operations, four-member minimum, duplicate queue prevention, random six-to-eleven crew matchmaking, and no crew-size grouping.
- Fixed-day crew membership, fractional daily score, `ceil(member_count / 2)` streak requirement, and seven-day final score multiplier.
- Concurrent/repeated finalization applies XP, cosmetics, ranks, and activity events exactly once.
- Crew departure removes crew cosmetics but preserves historical records; ownership transfer preserves progression.
- Contact consent, hashed matching, privacy filtering, and revocation.

### Frontend acceptance tests

- New user authentication, profile/avatar setup, task retrieval, multipart submission, validation result, streak, and progression states.
- Crew membership, queue eligibility, league standings, daily score, final results, cosmetics, and departure behavior.
- Contact-sync consent and contact leaderboard visibility.
- Mobile layout, keyboard access, readable contrast, non-color-only bin/task labels, reduced motion, and safe AI uncertainty fallback.

## 12. Hackathon demo script (about 3 minutes)

1. Open EcoCrew as a player in the "Glass Guardians" weekly challenge.
2. Show the crew is one contribution away from preserving its streak.
3. Open the assigned task, photograph a bottle, and receive the satisfying validation reveal and preparation tip.
4. Show the point breakdown updating the individual task and crew streak progress.
5. React to a teammate or show their recent contribution.
6. Reveal a newly unlocked profile frame and the crew’s movement in its weekly league.
7. Close with the key claim: EcoCrew turns a confusing everyday decision into a social, repeatable game.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| VLM misclassifies an item | Present confidence, use a curated demo set and safe fallback state, and retain model outputs for auditing and future evaluation |
| Recycling varies by location | Clearly scope the demo to one ruleset; model guidance should be configurable by locale later |
| Social API access is restricted | Use invite links and share sheets as the dependable MVP path |
| Users game scan volume | Daily caps, varied challenges, and rewards for accuracy/preparation rather than volume |
| Leaderboards demotivate new users | Emphasize small crews and matched weekly leagues; make global rank optional |
| Privacy concerns over photos | Store minimally, document consent, allow deletion, and never share scans by default |

## 14. Post-hackathon roadmap

1. Pilot with 10–20 small crews and measure daily completion, week-two retention, low-confidence rate, and crew invite conversion.
2. Add locality-specific rules and stronger item recognition only after validating the daily loop.
3. Test missions that reward waste avoidance, reuse, and composting alongside recycling.
4. Evolve the cosmetic shop based on what players actually return for.
5. Explore partnerships or tangible rewards only after the social habit loop demonstrates retention.
