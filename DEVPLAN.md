# EcoCrew MVP — Agent Brief

## Read this first

EcoCrew is a mobile-first social recycling game. Its MVP is one polished daily ritual:

> **See today’s item → photograph it → choose a disposal bin → get clear AI-assisted feedback → help the crew → earn a visible reward.**

This document is the scope boundary for implementation agents. Optimize for a reliable, delightful vertical slice that can be demonstrated in about three minutes. Do not add adjacent features unless they directly improve this loop or a task explicitly asks for them.

The app should feel like a quick game, not a recycling lesson. Education belongs in the result reveal as one useful reason and one actionable preparation tip.

## Product promise and target user

When someone is about to throw away a confusing household item, EcoCrew helps them make a better disposal decision quickly and makes the decision feel rewarding and social.

The primary audience is a small group of friends or family members. The MVP should also work for a user who has not joined a crew yet.

## P0 behaviour-change target

The single P0 behaviour is **correctly recycling a single-use plastic bottle after emptying it**. The other bin categories remain clearly labeled answer choices, but they are not separate behaviour-change goals for the MVP.

### User-facing daily mission

- Mission title: **Clean Bottle Check**.
- Show this instruction on both Home and Scan before image capture: **“Empty a single-use plastic bottle, hold it up to the recycling bin, and take a photo.”**
- Make clear that the bottle must contain no liquid.
- Keep the friendly mission instruction separate from the internal VLM prompt.

## The golden path

1. **Sign in and set up a profile.**
   - Use the existing Supabase authentication setup.
   - Ask only for a display name in the MVP.
   - Use an initials or generated avatar; avatar uploads are outside the core slice.

2. **Join or create a crew.**
   - Support one simple invite-code or invite-link flow.
   - Seed a four-member demo crew so the social experience is never empty.
   - A non-crew user can continue and earn individual progress.

3. **Open the daily task.**
   - Home has one dominant CTA: **Sort today’s item**.
   - Assign one deterministic task per user and local calendar day.
   - Keep the demo to one locale/ruleset and four bins: recycle, compost, return/reuse, and landfill.
   - Use **Clean Bottle Check** as the P0 hero mission and show its instruction on Home and Scan before capture.

4. **Photograph or upload the item.**
   - Show a preview and a clear retry path.
   - Submit the image as multipart data to a secure backend function.
   - Keep the image in memory for the request only; never persist image binaries or image paths.

5. **Make a sorting decision.**
   - Let the player choose a bin before seeing the answer.
   - Use large, labeled controls; never communicate bin meaning by color alone.

6. **Reveal the result.**
   - The backend evaluates the assigned task and the complete image prompt, not only the bin or object identity.
   - Show the item, recommended bin, whether the task was satisfied, confidence, a short reason, and one preparation tip.
   - Use a playful but short reveal animation.

7. **Update progress.**
   - Correct, sufficiently confident results earn points.
   - Update the user’s daily score and streak.
   - If the user belongs to a crew, update the crew goal, mission progress, and shared streak.
   - Explain every reward: what changed, how many points were earned, and what is next.

8. **End with one social moment.**
   - Show a seeded or real teammate milestone.
   - Allow one-tap emoji reactions.
   - Show the next cosmetic unlock or a simple weekly standings card.

## Required result states

The scan flow must always end in a useful state:

### Correct and confident

- Celebrate the result.
- Show the recommended bin and preparation tip.
- Award the configured points.
- Update personal and applicable crew progress.

### Wrong task or wrong bin

- Explain the mismatch in plain language.
- Give the correct disposal guidance.
- Award zero scoring points for the attempt.
- Offer a clear route back to the home screen or another allowed action.

For the P0 **Clean Bottle Check** demo, distinguish these intentional validation failures:

- A single-use plastic bottle with visible liquid fails with `failure_reason: liquid_present` and the message **“Empty the bottle first.”**
- An unrelated item fails with `failure_reason: unrelated_item` and the message **“That item does not match today’s mission.”**
- A correct bottle held toward the recycling bin with no liquid succeeds; it must not be treated as a generic object match.

### Low confidence or unclear image

- Say that the system is unsure.
- Ask the user to check the label or choose manually.
- Do not pretend to know and do not silently punish the user.
- Treat the scan as unverified and do not award scoring points unless the product rules explicitly support a verified correction.

### AI or upload failure

- Show a human-readable error.
- Preserve the user’s ability to retry or return home.
- Use the deterministic mock response for the demo when the external model is unavailable.

### Deterministic demo fixtures

The mocked-AI fallback must include these three mandatory task outcomes:

| Fixture | Expected result | User-facing outcome |
|---|---|---|
| Single-use plastic bottle with visible water, held toward the recycling bin | `task_satisfied: false`, `failure_reason: liquid_present` | Show “Empty the bottle first.” Award zero scoring points and offer retry. |
| Empty single-use plastic bottle, held toward the recycling bin | `task_satisfied: true`, `failure_reason: null` | Celebrate, show recycle guidance, award configured points, and update progress. |
| Unrelated item, such as a shoe or food container, held toward the recycling bin | `task_satisfied: false`, `failure_reason: unrelated_item` | Show “That item does not match today’s mission.” Award zero scoring points and offer retry. |

These are intentional task-validation outcomes, not upload or AI failures. Low-confidence and external-failure states remain required fallback states but are outside the core three-state showcase.

## MVP scoring and social rules

Keep scoring understandable and resistant to scan-volume farming:

- Validated task completion: **10 points**.
- Correct preparation step: **5 bonus points** when the task supports it.
- First validated action of the day: **10 bonus points**.
- Apply a daily cap to repeatable task points.
- Individual users can earn personal points and streak progress, but never crew XP.
- A crew day succeeds when at least `ceil(active members / 2)` members complete a validated task.
- Use one weekly streak-repair token in the UI.
- Reward accuracy and preparation, not the number of household items scanned.

## Behaviour measurement

Define and demonstrate a lightweight baseline-plus-follow-up measurement approach for the P0 behaviour:

- Baseline: a short, unaided bottle-sorting and preparation check before educational feedback.
- Follow-up: an equivalent check after seven days, supported by seeded data for the hackathon demo.
- Primary metric: the percentage of bottle scenarios correctly prepared and sorted.
- Secondary proxy: optional self-reported completion of the real-world bottle-recycling action.
- Provisional target: at least a 20-percentage-point improvement after seven days.
- Points, scan volume, streaks, and VLM similarity are engagement or validation signals, not proof of real-world behaviour change.
- Store only task choices, validation outcomes, prompt-similarity metadata, measurement phase, and timestamps; never store image binaries or image paths.

## What is in scope

### P0 — Must work for the demo

- Supabase email or social authentication.
- Minimal profile setup with display name.
- Create/join one crew through an invite code or link.
- Deterministic daily task assignment.
- Mobile home, scan, sorting, result, crew-progress, and reward views.
- Camera or image-upload interaction with preview and retry.
- Secure Edge Function for image submission and AI validation.
- Server-resolved **Clean Bottle Check** mission prompt shown to the user before capture.
- Deterministic mocked AI fallback with the three mandatory Clean Bottle Check fixtures.
- Success, incorrect, low-confidence, invalid-payload, and AI-failure states.
- Metadata-only scan records; no stored task image data.
- Seeded baseline/follow-up measurement view for the hackathon demo, clearly labeled as demonstration data.
- Personal points and streak.
- Crew goal, shared streak, one repair token, and one weekly mission.
- Small seeded activity feed with one-tap reactions.
- At least one cosmetic unlock with a visible celebration.
- A lightweight weekly league/standings card. It may use seeded data; full matchmaking is not required for the demo.
- Keyboard access, readable contrast, reduced-motion support, and non-color-only bin labels.
- A 2–3 minute demo video and a short written brief covering the audience, target behaviour, behaviour-change mechanic, baseline, metric, target, and measurement limitations.

### P1 — Only after the golden path is reliable

- Private avatar upload and replacement cleanup.
- More cosmetic types, achievement badges, and richer inventory management.
- Real league queueing, random six-to-eleven-crew matchmaking, seven-day scoring, and idempotent finalization.
- Location-aware rules beyond the single demo locale.
- In-app reminders and notification preferences.
- Haptics, sound, and additional microinteractions.

### Explicitly out of scope for the MVP

- Google Contacts, Facebook, or other address-book synchronization.
- Contact-based leaderboards.
- Nationwide or global rankings.
- A points shop, real-world rewards, or monetization.
- Multiple recycling-rule jurisdictions.
- Complex crew ownership transfer and departure experiences.
- Automated enforcement of real-world disposal behavior.
- A large, open-ended item-recognition catalog.

If a proposed change does not improve the daily scan, the crew consequence, or the reward moment, defer it.

## Rubric strategy

| Rubric | MVP proof | Implementation focus |
|---|---|---|
| Fun and engagement — 40% | A clear, satisfying 20-second mission with an expressive reveal, visible reward, teammate reaction, and invite flow that makes users want to use it regularly and tell friends | Make the mission and result feel game-like and expressive; show a clear next action |
| Behaviour change — 20% | The user sees the exact preparation requirement, receives corrective feedback for liquid-present bottles, succeeds with an empty bottle, and can be evaluated through baseline/follow-up measures | Make the reason and preparation tip prominent; measure the target behaviour rather than inferring it from points |
| Stickiness — 20% | Daily missions, streaks, crew consequences, weekly missions, next unlocks, and teammate milestones give users and their friends reasons to return | Make the shared consequence and next reward visible immediately after the scan |
| Craft and usability — 20% | The mission is understandable before capture, the three demo outcomes are clear, and all retry, loading, error, and accessibility states remain usable | Keep one primary action per screen and finish every loading/error/empty state |

## Minimal technical shape

Use the project’s existing frontend stack and conventions. Do not introduce a second styling system or a new state library without a clear need.

The minimum backend concepts are:

- `profiles` — display name and privacy settings.
- `crews` and `crew_members` — private group membership.
- `task_catalog` and `user_daily_tasks` — seeded tasks and stable daily assignment.
- `task_submissions` — classification and scoring metadata only.
- `user_streaks` and `crew_streaks` — separate personal and crew progress.
- `weekly_missions` and `mission_progress` — one active co-op mission.
- `inventory_items` and user/crew unlock state — the visible cosmetic reward.
- `activity_events` — milestone events and reactions subject to crew/privacy rules.

The exact schema may follow the existing project if equivalent tables already exist. Do not create duplicate models merely to match these names.

### Backend guardrails

- Derive the actor from the authenticated JWT for every mutation.
- Re-check authorization in the database transaction or RPC layer.
- Keep VLM credentials out of browser code and client environment variables.
- Validate AI output against a strict structured schema before rendering it.
- Resolve the user’s assigned task server-side; never trust a client-supplied user or task owner.
- Use a fixed local-day boundary for daily tasks and streak calculations.
- Make duplicate submissions safe and idempotent where applicable.
- Apply Row Level Security to private user and crew data.
- Never store task image binaries or image paths.

### Canonical task prompt and VLM result contract

The server-side P0 task prompt is:

> “The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.”

- The Edge Function resolves this prompt from the authenticated user’s server-side daily task.
- The client cannot replace the prompt, task, or task owner.
- The VLM scores similarity against the complete prompt and must consider the bottle, absence of liquid, and recycling-bin context.
- An object-only match is insufficient: a bottle with liquid and an unrelated item must fail.
- Use the raw similarity score for server-side validation and confidence handling; present a plain-language result in the UI rather than relying on a numeric score alone.
- `failure_reason` must use the structured values `liquid_present`, `unrelated_item`, `wrong_bin`, `low_confidence`, `upload_failure`, or `ai_failure`.

Example normalized AI response:

```json
{
  "task_prompt": "The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.",
  "prompt_similarity": 0.94,
  "item_name": "plastic drink bottle",
  "material": "PET plastic",
  "recommended_bin": "recycle",
  "preparation_tip": "Empty the bottle before recycling.",
  "confidence": 0.94,
  "reason": "The image matches an empty single-use plastic bottle held toward a recycling bin.",
  "task_satisfied": true,
  "failure_reason": null
}
```

## Suggested screen structure

Keep the visible product small:

1. **Home** — Clean Bottle Check instruction, today’s task, crew streak, mission progress, and primary CTA.
2. **Scan** — visible mission instruction, camera/upload, image preview, and bin selection.
3. **Result** — reveal, guidance, points, and progress changes.
4. **Crew** — teammate milestone, reaction, mission, and standings card.
5. **Rewards** — unlocked item and next unlock.

These can be routes, panels, or modal steps according to the existing app structure. Avoid building separate navigation for every small state.

## Acceptance criteria

The MVP is ready when:

- A new user can authenticate, set a display name, join the demo crew, receive today’s task, and submit an image in one session.
- The typical happy path takes less than 30 seconds from the home CTA to the result.
- The Clean Bottle Check mission is visible and understandable on Home and Scan before the user takes a photo.
- The player makes a visible bin choice before seeing the answer.
- The result explains the correct action and includes one actionable preparation tip.
- Success, wrong-bin, low-confidence, invalid-upload, and AI-failure states do not dead-end.
- A bottle with water fails specifically because liquid is present, with a retry path and zero scoring points.
- An empty bottle succeeds and updates personal and applicable crew progress.
- An unrelated item fails specifically because it does not match the mission, with a retry path and zero scoring points.
- Personal streak/points and crew mission/streak progress update visibly.
- A teammate reaction and at least one cosmetic unlock can be demonstrated.
- The weekly standings card is understandable without explaining league internals.
- The demo works with seeded/mock AI responses when the external model is unavailable.
- The canonical VLM prompt includes the bottle, absence of liquid, and recycling-bin context, and the three deterministic fixtures can be demonstrated.
- A seeded baseline/follow-up measurement view can be demonstrated without claiming observed impact.
- The user can see a clear reason to return and invite friends.
- No secret VLM key or task image data is exposed or persisted.
- The experience is usable on a phone-sized viewport, by keyboard, and with reduced motion enabled.

## Demo script

1. Open **Clean Bottle Check** and read the mission instruction: “Empty a single-use plastic bottle, hold it up to the recycling bin, and take a photo.”
2. Upload or photograph a bottle containing water; show the failure and **“Empty the bottle first.”** guidance.
3. Retry with an empty bottle; show successful validation, recycle guidance, point breakdown, crew progress, and reward.
4. Retry with an unrelated item; show the mission-mismatch failure and retry path.
5. Show the teammate reaction, next unlock, invite flow, and weekly standings card.
6. Briefly show the seeded baseline/follow-up measurement design and label it as demonstration data.

The three bottle/liquid/unrelated-item outcomes are the required scripted task states. Low-confidence and infrastructure-failure states remain testable fallback states but are outside the main three-state showcase.

## Post-MVP direction

Only after the daily crew ritual and the P0 measurement path are stable should the product expand to locality-specific rules, richer recognition, real league matchmaking/finalization, contacts, reminders, more cosmetics, and broader leaderboards. Continue measuring daily completion, week-two retention, correction/uncertainty rate, crew invite conversion, and the bottle-recycling outcome before expanding scope.
