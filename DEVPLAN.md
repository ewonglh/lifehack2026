# EcoCrew — Development Plan

## 1. Product summary

**EcoCrew** is a frontend-first social recycling game. Players photograph a household item, make a fast sorting decision, receive AI-assisted guidance, and earn progress for a small crew of friends or family. Weekly missions, forgiving shared streaks, and cosmetic rewards make correct disposal feel like a repeatable social ritual rather than a chore.

The core product principle is **delight first, obligation second**. Recycling education is delivered inside an entertaining game loop, never as a lecture.

## 2. Hackathon objective

Deliver one polished, end-to-end loop that proves the app can be fun enough to revisit, socially motivating, and clear to use:

1. Sign in and create or join a crew.
2. Start the daily "Sort It!" challenge.
3. Take or upload an item photo.
4. Choose the appropriate disposal bin.
5. Receive VLM-assisted feedback and a concise preparation tip.
6. Earn points; advance the crew challenge and shared streak.
7. See the crew feed, weekly league position, and a cosmetic unlock path.

Do not prioritize broad integrations or a global leaderboard before this loop is smooth and enjoyable.

## 3. Rubric strategy

| Dimension | Weight | Product response | Demo proof |
|---|---:|---|---|
| Fun and engagement | 40% | Animated sorting reveal, playful weekly theme, short rounds, crew reactions, expressive cosmetics | A user completes a satisfying 20-second challenge and sends a reaction to a teammate |
| Behaviour change | 20% | Reward correctly sorted and prepared items; give one actionable local-style disposal tip | The user learns to rinse/empty an item or sees why an item belongs in landfill |
| Stickiness | 20% | Daily challenge, shared crew streak, weekly missions, leagues, limited cosmetics, streak repair token | A crew is one action away from protecting its streak and advancing its mission |
| Craft and usability | 20% | One primary action per screen, clear confidence/correction controls, accessible feedback, mobile-first layout | A new user finishes the loop without explanation |

## 4. Target users and jobs to be done

- **Friends and families:** make a small everyday environmental habit more social and fun.
- **Casual recyclers:** quickly determine how to dispose of confusing household items.
- **Competitive players:** contribute to a crew, rise through weekly leagues, and display earned identity items.

Primary job: *When I am about to throw something away, help me make the right choice quickly and make the action feel rewarding.*

## 5. Core game design

### 5.1 Daily gameplay loop

1. The home screen presents one clear CTA: **Sort today’s item**.
2. The player photographs or uploads an item.
3. Before seeing the result, the player selects a bin: recycle, compost, return/reuse, or landfill.
4. The VLM evaluates the image and the game reveals the result with animation, points, and a one-sentence preparation instruction.
5. The activity adds to the player’s daily score, crew goal, mission progress, and streak.
6. The player sees a lightweight social moment: teammate activity, reaction, or challenge invitation.

### 5.2 Scoring principles

Avoid rewarding raw recycling volume alone; that can unintentionally reward consumption and unfairly advantage larger households.

Suggested points:

| Action | Points | Notes |
|---|---:|---|
| Correct bin selection | 10 | Main repeatable skill reward |
| Correct preparation step | 5 | e.g. empty, rinse, flatten, separate |
| First daily verified action | 10 | Supports the daily habit |
| Weekly mission contribution | 5–20 | Reward only mission-relevant actions |
| Helpful correction / report | 3 | Improves system trust without farming points |
| Crew streak day completed | 5 shared bonus | Every active member benefits |

Use a daily cap for repeat scan points. This keeps the game fair and focuses it on habit formation.

### 5.3 Social and retention mechanics

- **Eco Crews:** private groups of 3–8 people; default social unit.
- **Shared streak:** a crew succeeds when a minimum number of members complete an action each day. Include one repair token weekly.
- **Weekly missions:** rotating co-op goals with a playful theme, such as "Glass Guardians" or "Defeat the Landfill Monster."
- **Leagues:** crews compete in matched weekly cohorts, rather than only against an unreachable global top list.
- **Activity feed:** celebrate milestones, not every scan. Allow quick emoji/reaction responses.
- **Cosmetics:** avatars, frames, badges, and crew banners earned through achievements and weekly placement.

## 6. Scope and priorities

### Must have (demo MVP)

- Supabase email/social authentication.
- Profile creation and a single crew creation/join flow.
- Mobile-first home, scan, sorting, result, crew, and reward views.
- VLM photo classification endpoint integration, with a mocked fallback response for reliable demos.
- User confirmation and correction of classification.
- Points, daily activity, simple crew challenge, and shared streak persistence.
- Small seeded activity feed and weekly leaderboard.
- At least six polished cosmetic items with one visible unlock.

### Should have (if time permits)

- Contact import/invite flow with clear consent and a manual invite link fallback.
- Personal and crew achievement badges.
- Notification preferences and an in-app reminder prompt.
- Location-aware disposal rules, beginning with one supported locale.
- Microinteractions, haptics on mobile, and sound toggle.

### Explicitly defer

- Nationwide/global ranking at real scale.
- A full points shop economy or real-world rewards.
- Multiple recycling-rule jurisdictions.
- Full Facebook Friends integration. Modern platform permissions can be restrictive; build a simple invite-link/share flow first.
- Fully automated enforcement. User confirmation must remain part of the loop.

## 7. UX requirements

- The daily path should take less than 30 seconds with a typical photo.
- Always show an understandable fallback when classification is uncertain: "Not sure—what does the label say?" plus manual bin selection.
- Never silently punish a user for model ambiguity; show confidence as helpful guidance, not a score penalty.
- Make every reward explain itself: points earned, mission progress, and next unlock.
- Keep social sharing opt-in per activity, with clear controls for profile visibility and deletion of photos/scans.
- Ensure keyboard access, readable contrast, non-color-only bin labels, and motion-reduction support.

## 8. Technical plan

### 8.1 Proposed stack

- **Frontend:** React + TypeScript + Vite or Next.js; Tailwind CSS and a small animation library.
- **Backend services:** Supabase Auth, Postgres, Row Level Security, Storage, and Edge Functions.
- **Vision:** VLM called from an Edge Function so API credentials are never exposed in the browser.
- **State/data fetching:** TanStack Query or equivalent; optimistic updates for scan completion and reactions.
- **Deployment:** Vercel/Netlify frontend plus Supabase project.

### 8.2 Important architecture decision

The UI may be frontend-only in the sense that it needs no custom server to run, but the VLM call must be proxied through a secure Supabase Edge Function. Do not call the VLM directly from client-side JavaScript with a secret API key.

### 8.3 Data model (initial)

| Table | Key fields | Purpose |
|---|---|---|
| `profiles` | `id`, `display_name`, `avatar_id`, `frame_id`, `privacy_settings` | Player identity and preferences |
| `crews` | `id`, `name`, `owner_id`, `weekly_points`, `league` | Private competition group |
| `crew_members` | `crew_id`, `profile_id`, `role`, `joined_at` | Crew membership |
| `scan_events` | `id`, `profile_id`, `image_path`, `model_result`, `user_bin`, `final_bin`, `confidence`, `points`, `created_at` | Auditable recycling action |
| `daily_progress` | `profile_id`, `day`, `verified_actions`, `points` | Daily cap and habit tracking |
| `crew_streaks` | `crew_id`, `current_streak`, `repair_tokens`, `last_completed_day` | Shared retention mechanic |
| `weekly_missions` | `id`, `title`, `theme`, `target`, `start_at`, `end_at` | Rotating challenge definition |
| `mission_progress` | `mission_id`, `crew_id`, `progress`, `completed_at` | Crew mission state |
| `inventory_items` | `id`, `type`, `name`, `unlock_rule` | Cosmetics catalog |
| `profile_inventory` | `profile_id`, `item_id`, `equipped` | Earned/equipped cosmetics |

Apply Row Level Security so users can only read their own sensitive scans and content within crews they belong to. Store the minimum image data needed; support deletion.

### 8.4 VLM response contract

Normalize all model output into structured JSON:

```json
{
  "item_name": "plastic drink bottle",
  "material": "PET plastic",
  "recommended_bin": "recycle",
  "preparation_tip": "Empty and replace the cap before recycling.",
  "confidence": 0.86,
  "reason": "The image shows a clear PET beverage bottle."
}
```

Validate the schema before displaying it. If confidence is low or the image is unclear, ask the user to choose manually and label the outcome as unverified or low-confidence rather than inventing certainty.

## 9. Implementation milestones

### Milestone 0 — Product framing (1–2 hours)

- Name the product EcoCrew and write the one-sentence pitch.
- Select a single recycling ruleset/locale for the demo.
- Define four disposal bins and 10–15 representative test items.
- Prepare two crew personas and seeded demo activity.

### Milestone 1 — Foundation (2–3 hours)

- Initialize frontend, design tokens, Supabase project, and environment handling.
- Implement auth, profile setup, and schema/RLS migrations.
- Build responsive app shell, nav, and empty states.

### Milestone 2 — The sorting game (3–5 hours)

- Build camera/upload interaction with image preview.
- Implement bin-selection game UI and result reveal.
- Add Edge Function, VLM schema validation, and deterministic mocked fallback.
- Persist scan events, calculate points, and allow corrections.

### Milestone 3 — Crew magic (3–4 hours)

- Create/join crew flow using invite code or link.
- Add crew goal, shared streak, activity feed, and quick reactions.
- Seed a weekly mission and show progress animations.

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

- A new user can sign in, join a crew, complete a scan/sort, and see updated crew progress in one session.
- The scan experience handles success, low confidence, and API failure without dead ends.
- Points have a visible explanation and lead to at least one meaningful reward.
- A crew streak has an understandable rule and a visible repair token.
- The social layer works with a manual invite link even when contact integrations are unavailable.
- The app is attractive and legible on a phone-sized viewport.
- No secret VLM key is present in browser code or client environment variables.

## 11. Hackathon demo script (about 3 minutes)

1. Open EcoCrew as a player in the "Glass Guardians" weekly challenge.
2. Show the crew is one contribution away from preserving its streak.
3. Photograph a bottle, choose **Recycle**, and receive the satisfying result reveal and preparation tip.
4. Show the point breakdown updating the crew goal and streak.
5. React to a teammate or show their recent contribution.
6. Reveal a newly unlocked profile frame and the crew’s movement in its weekly league.
7. Close with the key claim: EcoCrew turns a confusing everyday decision into a social, repeatable game.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| VLM misclassifies an item | Let users confirm/correct results; present confidence; use a curated demo set and safe fallback state |
| Recycling varies by location | Clearly scope the demo to one ruleset; model guidance should be configurable by locale later |
| Social API access is restricted | Use invite links and share sheets as the dependable MVP path |
| Users game scan volume | Daily caps, varied challenges, and rewards for accuracy/preparation rather than volume |
| Leaderboards demotivate new users | Emphasize small crews and matched weekly leagues; make global rank optional |
| Privacy concerns over photos | Store minimally, document consent, allow deletion, and never share scans by default |

## 13. Post-hackathon roadmap

1. Pilot with 10–20 small crews and measure daily completion, week-two retention, correction rate, and crew invite conversion.
2. Add locality-specific rules and stronger item recognition only after validating the daily loop.
3. Test missions that reward waste avoidance, reuse, and composting alongside recycling.
4. Evolve the cosmetic shop based on what players actually return for.
5. Explore partnerships or tangible rewards only after the social habit loop demonstrates retention.
