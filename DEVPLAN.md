# EcoCrew MVP — Agent Brief

## Read this first

EcoCrew is a mobile-first social recycling game. Its MVP is one polished daily ritual:

> **See today’s item → photograph it → choose a disposal bin → get clear AI-assisted feedback → help the crew → earn a visible reward.**

This document is the scope boundary for implementation agents. Optimize for a reliable, delightful vertical slice that can be demonstrated in about three minutes. Do not add adjacent features unless they directly improve this loop or a task explicitly asks for them.

The app should feel like a quick game, not a recycling lesson. Education belongs in the result reveal as one useful reason and one actionable preparation tip.

## Product promise and target user

When someone is about to throw away a confusing household item, EcoCrew helps them make a better disposal decision quickly and makes the decision feel rewarding and social.

The primary audience is a small group of friends or family members. The MVP should also work for a user who has not joined a crew yet.

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

4. **Photograph or upload the item.**
   - Show a preview and a clear retry path.
   - Submit the image as multipart data to a secure backend function.
   - Keep the image in memory for the request only; never persist image binaries or image paths.

5. **Make a sorting decision.**
   - Let the player choose a bin before seeing the answer.
   - Use large, labeled controls; never communicate bin meaning by color alone.

6. **Reveal the result.**
   - The backend evaluates the assigned task and the image, not only the bin.
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

### Low confidence or unclear image

- Say that the system is unsure.
- Ask the user to check the label or choose manually.
- Do not pretend to know and do not silently punish the user.
- Treat the scan as unverified and do not award scoring points unless the product rules explicitly support a verified correction.

### AI or upload failure

- Show a human-readable error.
- Preserve the user’s ability to retry or return home.
- Use the deterministic mock response for the demo when the external model is unavailable.

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

## What is in scope

### P0 — Must work for the demo

- Supabase email or social authentication.
- Minimal profile setup with display name.
- Create/join one crew through an invite code or link.
- Deterministic daily task assignment.
- Mobile home, scan, sorting, result, crew-progress, and reward views.
- Camera or image-upload interaction with preview and retry.
- Secure Edge Function for image submission and AI validation.
- Deterministic mocked AI fallback with fixtures for known demo objects.
- Success, incorrect, low-confidence, invalid-payload, and AI-failure states.
- Metadata-only scan records; no stored task image data.
- Personal points and streak.
- Crew goal, shared streak, one repair token, and one weekly mission.
- Small seeded activity feed with one-tap reactions.
- At least one cosmetic unlock with a visible celebration.
- A lightweight weekly league/standings card. It may use seeded data; full matchmaking is not required for the demo.
- Keyboard access, readable contrast, reduced-motion support, and non-color-only bin labels.

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
| Fun and engagement — 40% | A satisfying 20-second scan, animated reveal, progress movement, and teammate reaction | Make the result reveal feel game-like and expressive; keep the round short |
| Behaviour change — 20% | The user learns the correct bin and one concrete preparation action | Make the reason and preparation tip prominent; handle uncertainty honestly |
| Stickiness — 20% | The crew is one action away from saving its streak, advancing a mission, or unlocking a cosmetic | Make the shared consequence visible immediately after the scan |
| Craft and usability — 20% | A new user finishes without explanation on a phone-sized viewport | Keep one primary action per screen and finish every loading/error/empty state |

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

Example normalized AI response:

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

## Suggested screen structure

Keep the visible product small:

1. **Home** — today’s task, crew streak, mission progress, and primary CTA.
2. **Scan** — camera/upload, image preview, and bin selection.
3. **Result** — reveal, guidance, points, and progress changes.
4. **Crew** — teammate milestone, reaction, mission, and standings card.
5. **Rewards** — unlocked item and next unlock.

These can be routes, panels, or modal steps according to the existing app structure. Avoid building separate navigation for every small state.

## Acceptance criteria

The MVP is ready when:

- A new user can authenticate, set a display name, join the demo crew, receive today’s task, and submit an image in one session.
- The typical happy path takes less than 30 seconds from the home CTA to the result.
- The player makes a visible bin choice before seeing the answer.
- The result explains the correct action and includes one actionable preparation tip.
- Success, wrong-bin, low-confidence, invalid-upload, and AI-failure states do not dead-end.
- Personal streak/points and crew mission/streak progress update visibly.
- A teammate reaction and at least one cosmetic unlock can be demonstrated.
- The weekly standings card is understandable without explaining league internals.
- The demo works with seeded/mock AI responses when the external model is unavailable.
- No secret VLM key or task image data is exposed or persisted.
- The experience is usable on a phone-sized viewport, by keyboard, and with reduced motion enabled.

## Demo script

1. Open the **Glass Guardians** mission and show the crew is one contribution away from preserving its streak.
2. Open today’s assigned task.
3. Photograph or upload a bottle and choose **Recycle**.
4. Show the reveal: correct bin, reason, “empty and replace the cap” tip, and point breakdown.
5. Show personal streak, crew streak, and mission progress moving together.
6. React to a teammate milestone.
7. Reveal the cosmetic unlock and show the crew’s weekly standings card.
8. If time permits, show the low-confidence fallback to demonstrate trust and safety.

## Post-MVP direction

Only after the daily crew ritual is stable should the product expand to locality-specific rules, richer recognition, real league matchmaking/finalization, contacts, reminders, more cosmetics, and broader leaderboards. Measure daily completion, week-two retention, correction/uncertainty rate, and crew invite conversion before expanding scope.
