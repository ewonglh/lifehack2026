# EcoCrew — Shared Contracts and Boundaries

This document defines the agreements between product, design, frontend, Supabase, the VLM integration, and players. It aims to keep the product fair, safe, and easy to change while the team builds quickly.

## 1. Product contracts

### 1.1 The core promise

EcoCrew makes practical sustainable actions easier to repeat and more rewarding. It must not shame users, overstate evidence certainty, or make competition more important than positive habit formation.

### 1.2 The daily-loop boundary

The supported core loop is:

1. Receive one assigned sustainability task for the current Singapore day.
2. Complete the task and capture or upload photo evidence from Home.
3. Submit the evidence for verification and receive a clear outcome and point breakdown.
4. Create a profile post summary and earn bounded progress for the player and any enrolled crew league.

Anything outside that loop—national rankings, large reward economies, contacts synchronization, many local rulesets—is secondary. It must not block a player from completing the loop.

### 1.3 Time and effort budget

- A typical daily action should take **under 30 seconds**.
- A player should not need to create content, invite friends, or browse a shop to receive value.
- The app should show one primary next action at a time.

## 2. Ownership boundaries

| Area | Owner | Responsibility | Must not own |
|---|---|---|---|
| Frontend | Client application | Interaction, rendering, local UI state, accessibility, optimistic UI | API secrets, final score decisions, authorization decisions |
| Supabase Auth | Supabase | Identity/session lifecycle | Public profile design or crew business rules |
| Supabase Postgres + RLS | Database | Canonical user, crew, progress, and inventory state; access control | Model inference or visual presentation |
| Edge Functions | Server boundary | Secret VLM calls, schema validation, score calculation, trusted mutations | Long-lived UI state or client-only animation logic |
| VLM provider | External service | Image interpretation as advisory input | User identity, authorization, final irreversible game decisions |
| Product/config data | Versioned configuration | Point values, daily task definitions, league rules, cosmetic unlock rules | Hard-coded divergent rules in multiple clients |

**Rule:** the browser treats all score-like data as display data until a trusted server-side function confirms it.

## 3. Identity, membership, and privacy contracts

### 3.1 Identity

- `auth.uid()` is the canonical player identifier.
- A `profiles` record is created once per authenticated user.
- Display names are unique only within a crew; use stable IDs internally.
- Do not use email addresses as public identifiers.
- Editable profile fields currently include display name, handle, age, and About Myself text.
- Age is self-reported, is not used to make automated eligibility decisions, and must have an explicit visibility setting before production launch.
- About Myself is untrusted user content: escape it when rendering, apply length limits, and include it in account deletion/export behavior.

### 3.2 Crews

- A player can see a crew only if they are an active `crew_members` record.
- Crew owners can invite/remove members and configure crew-level settings.
- A player may leave a crew without deleting their personal task-submission history.
- Historical crew totals remain intact when someone leaves, but private player data is not exposed after departure.
- Only the crew owner may delete a crew. Deletion is a confirmed, trusted server transaction that invalidates invites, removes all active memberships, and removes or archives crew-scoped streak, feed, and league state according to retention policy.
- Deleting a crew does not delete a former member’s personal profile, private posts, task-submission history, or lifetime points.
- The product should define a small initial maximum crew size (for example, 8) and enforce it server-side.
- Join and Create actions are shown only when the player has no active crew membership. The server remains responsible for preventing conflicting memberships and enforcing capacity.
- A crew may have only one active league entry. Only its owner may enroll or leave it, and enrollment requires at least three active members in the current demo.

### 3.3 Invites and contacts

- Contact import is optional, consent-based, and never required to play.
- Store only the minimum invite metadata needed; do not persist an entire address book by default.
- Invite links are revocable, expire, and may be single-use or rate-limited.
- A manual share link is the baseline path. The current interface offers X, Instagram, Telegram, and WhatsApp; these channels receive only a revocable invite URL and user-authored share text.
- Instagram has no direct browser-targeted share endpoint in the current prototype, so its action copies the invite link for the user to paste.

### 3.4 Images and activity sharing

- Task-evidence photos are private by default.
- The social feed shares an activity summary (for example, “Ari completed a sustainability task”), not the photo, unless the user explicitly chooses otherwise.
- A **post** is the user-facing projection of a completed task submission. Its default profile representation contains task identity, outcome, points, and creation time, but not the original image.
- Creating a task submission does not automatically make the original image public. Future image sharing requires a separate, explicit visibility choice.
- Players can delete their images and activity records, subject to clearly explained leaderboard/history effects.
- Never use submitted images for unrelated model training or marketing without separate, explicit consent.

## 4. VLM and evidence-verification contracts

### 4.1 Trust boundary

- The VLM is an **assistant**, not an authority.
- The VLM is called only from an Edge Function or equivalent trusted server boundary.
- API keys and provider-specific prompts never reach the client bundle.
- The client never assumes a raw VLM response is valid or complete.

### 4.2 Required normalized response

Every verification response must be normalized and schema-validated before it reaches game logic:

```ts
type TaskEvidenceResult = {
  taskId: string;
  outcome: "verified" | "needs_retry" | "unknown";
  confidence: number; // 0–1
  reason: string;
};
```

`unknown` is a valid outcome. Do not coerce uncertain evidence into a verified completion.

### 4.3 Confidence and correction

| Condition | Product behavior | Scoring behavior |
|---|---|---|
| High confidence | Confirm that the assigned task is represented in the evidence | Eligible for configured task and evidence points |
| Low confidence | Explain uncertainty and let the player retry with clearer evidence | No verification points until verified |
| Wrong task shown | Remind the player of the assigned task and allow a retry | No points; do not consume the daily completion |
| Image/API failure | Preserve context and offer retry | No points; never break the daily flow |

The threshold is configurable server-side (initially, for example, `0.70`) and must not be duplicated in the client.

### 4.4 Task catalog and verification scope

- Daily task definitions live in versioned server-side configuration.
- Verification is scoped to the task assigned to that player for that day.
- Task wording and evidence guidance must be available to the verifier in a trusted prompt/configuration.
- The client must not substitute another task identifier to obtain points.

## 5. Scoring and progression contracts

### 5.1 Fairness principles

- Reward verified sustainable actions and supporting evidence, not raw submission volume.
- Cap repeatable points per day and per action type.
- A player’s lifetime profile total starts when the account is created and does not reset between league weeks.
- League points belong to one explicit weekly window and reset at its boundary. The initial demo boundary is Monday at `00:00` in `Asia/Singapore`.
- Player-facing score explanations must match server calculations.
- No client can directly write points, streaks, rankings, or unlocked inventory.
- Scoring rules are versioned so score changes can be understood and audited.

### 5.2 Canonical score event

The trusted action produces an immutable score event:

```ts
type ScoreEvent = {
  id: string;
  playerId: string;
  crewId: string | null;
  taskSubmissionId: string | null;
  actionType: "task_completion" | "photo_evidence" | "daily_first" | "streak_bonus";
  points: number;
  scoringRuleVersion: string;
  occurredAt: string;
};
```

Player totals, crew totals, and rankings are derived from these events or updated transactionally from them. Never use a mutable browser-maintained total as the source of truth.

### 5.3 Idempotency and duplicate prevention

- Each task submission includes an idempotency key generated by the client.
- Repeating the same request returns the original result; it does not create more score events.
- The Edge Function enforces daily caps and duplicate/rate limits.
- A retry or verification correction cannot repeatedly mint new points.

### 5.4 Streak definition

- A streak is based on a declared timezone and daily cutoff, stored per crew.
- A crew completes a day when its configured minimum number of distinct members complete a qualifying action.
- The UI must state the exact completion rule and cutoff.

### 5.5 Leaderboard definition

- Weekly rankings use a fixed start/end timestamp and a score snapshot or deterministic query.
- Resetting a weekly league must not modify lifetime points, historical posts, or immutable score events; the weekly total is a windowed projection of those events.
- Ties use a documented tie-breaker (for example, earliest completion time, then shared rank).
- A crew’s relevant league is the default view; worldwide ranking is secondary.
- League comparisons use average weekly points per active member so larger crews do not receive an automatic advantage.
- Rankings need not be real-time; label refresh time honestly.

## 6. API contracts

### 6.0 Shared frontend models

The frontend mock adapter and future Supabase services should normalize data to these shapes. Database column names may use snake case, but service adapters expose consistent camel case to page modules.

```ts
type Profile = {
  id: string;
  displayName: string;
  handle: string;
  age: number | null;
  about: string;
  location: string;
  avatarId: string | null;
  frameId: string | null;
  ageVisibility: "private" | "crew" | "public";
};

type ProfilePost = {
  id: string;
  taskSubmissionId: string;
  taskId: string;
  taskTitle: string;
  points: number;
  createdAt: string;
  visibility: "private" | "crew" | "public";
  imageVisible: boolean;
};

type CrewMembership = {
  crewId: string;
  crewName: string;
  role: "owner" | "member";
  memberCount: number;
  joinedAt: string;
};
```

The profile update endpoint accepts only editable fields (`displayName`, `handle`, `age`, and `about`) plus explicit visibility preferences. It must ignore attempts to update points, streaks, roles, inventory ownership, or server-generated statistics.

Crew Create and Join mutations return the same normalized `CrewMembership` shape. Joining accepts an opaque invite token, not a trusted crew ID supplied by the browser. A successful mutation invalidates crew, feed, and league queries so Join/Create controls disappear immediately.

### 6.1 Verify-task-and-score request

```ts
type VerifyTaskAndScoreRequest = {
  idempotencyKey: string;
  imageStoragePath: string;
  taskId: string;
  crewId?: string;
};
```

Validation rules:

- Requesting user owns the image path.
- File type/size limits are verified server-side.
- `crewId`, if supplied, belongs to the requesting user.
- `taskId` references the task assigned to that player for the current Singapore day.
- A request is rate-limited before calling the VLM.

### 6.2 Response

```ts
type VerifyTaskAndScoreResponse = {
  taskSubmissionId: string;
  post: ProfilePost;
  verification: { outcome: "verified" | "needs_retry" | "unknown"; reason: string };
  awarded: Array<{ actionType: string; points: number }>;
  dailyPointsRemaining: number;
  crewUpdate?: {
    weeklyPoints: number;
    streakStatus: "advanced" | "already_complete" | "not_qualified";
  };
};
```

The frontend renders this response; it does not recalculate awards.

### 6.3 Error contract

All endpoints return a stable error code and safe user message:

| Code | Client response |
|---|---|
| `UNAUTHENTICATED` | Ask the user to sign in again |
| `FORBIDDEN` | Explain they do not have access; do not reveal private resource details |
| `INVALID_IMAGE` | Ask for a new photo or supported format |
| `INVALID_INVITE` | Keep the Join form open and request a valid, current invite |
| `CREW_FULL` | Explain that the crew has reached its member limit |
| `ALREADY_IN_CREW` | Refresh membership and hide Join/Create controls |
| `HANDLE_TAKEN` | Keep profile edits and request another handle |
| `RATE_LIMITED` | Explain when to try again; preserve the user’s current screen |
| `MODEL_UNAVAILABLE` | Offer retry/manual guidance; do not imply the item was classified |
| `DUPLICATE_REQUEST` | Rehydrate and display the original response |
| `INTERNAL_ERROR` | Apologize, provide retry, and log an opaque correlation ID |

## 7. Data and database boundaries

### 7.1 Source of truth

| Data | Canonical source |
|---|---|
| Authentication/session | Supabase Auth |
| Profile and crew membership | Postgres tables protected by RLS |
| Task evidence image bytes | Private Supabase Storage bucket |
| Evidence verification and score events | Postgres, created through trusted function |
| Daily task and league configuration | Versioned server-side configuration/table |
| UI cache | Client query cache only; disposable |

### 7.2 Access controls

- RLS is enabled on every user-data table.
- Direct client writes are limited to safe profile preferences and uploads to the user-owned path; sensitive mutations go through Edge Functions/RPCs.
- Storage policies ensure users can access only their own original images unless explicitly shared.
- Service-role credentials exist only in server-side runtime.

### 7.3 Retention and deletion

- Define a retention period for raw images; prefer automatic deletion after verification where feasible.
- Deletion of an image should not require deleting an aggregated, non-identifying score event unless legally required.
- Deleting a profile should revoke access immediately and cascade/anonymize data according to a documented policy.

## 8. UI and design system contracts

- Bin names and icons are always paired; color alone never conveys meaning.
- Loading states show progress and retain the image-selection context.
- Every primary view has loading, empty, error, and offline/degraded states.
- Every page exposes a keyboard-accessible Info control near its top-right corner with a concise explanation of the page’s purpose.
- Animations enhance feedback but respect `prefers-reduced-motion`.
- Touch targets are at least 44×44 CSS pixels where practical.
- Design tokens define color, spacing, type, radii, and motion; feature screens do not introduce arbitrary one-off values.
- All reward modals have a clear dismissal action and do not trap the player away from the next action.

## 9. Analytics contracts

Track only events that answer a product question. Do not log raw images, prompts, verification explanations, contact lists, or personally sensitive text into generic analytics.

Initial events:

| Event | Required properties | Product question |
|---|---|---|
| `daily_challenge_started` | player/crew anonymized IDs, task ID | Do players begin the loop? |
| `task_evidence_submitted` | task ID, confidence band | Is the interaction understandable? |
| `task_completed` | outcome, points, duration band | Is the loop fast and satisfying? |
| `profile_post_created` | post visibility, image-visible boolean | Do players value keeping a history of eco actions? |
| `task_evidence_retried` | task ID, reason | Where is evidence guidance failing? |
| `crew_created/joined` | crew ID, entry method | Do players form or join crews? |
| `crew_invite_shared` | crew ID, invite channel | Which invitation paths support crew growth? |
| `reward_unlocked/equipped` | item ID, unlock rule | Are progression rewards motivating? |

Review retention by cohort (day 1, day 7) and correction rate before expanding reward systems.

## 10. Delivery boundaries for the hackathon

### In scope

- One daily task catalog, small private crews, fair weekly league ranking, reliable mock fallback, cosmetic unlock, and mobile-friendly end-to-end flow.

### Out of scope unless the core loop is complete

- Real nationwide/global competitive integrity.
- Arbitrary object recognition guarantees.
- Automated friend-graph importing.
- Cash-value redemptions, shipping, payments, or legal prize rules.
- Public photo feeds or content moderation infrastructure.

### Definition of done

The feature is done only when it is usable in success and failure states, persists correctly under authenticated access control, has no exposed secrets, and can be demonstrated without relying on an unseeded external response.

## 11. Team decision rules

When an implementation choice is unclear, choose the option that:

1. Protects trust and privacy.
2. Keeps the daily loop under 30 seconds.
3. Makes a player’s next action obvious.
4. Preserves fairness among different households and activity levels.
5. Can be demonstrated reliably at the hackathon.

Record deviations from these contracts with a short reason, owner, and expiry/review date.

## 12. Current frontend prototype contract

Until Supabase integration is complete, `src/features/ecocrew/scan-service.js` provides a disposable browser adapter. This section documents its behavior so it is not mistaken for the production security model.

### Browser keys

- `localStorage.ecocrew-demo-state` stores profile edits, post summaries, points, daily task state, crew and league membership, the last result, cosmetics, and reactions.
- `sessionStorage.ecocrew-demo-signed-in` records that a mock login/register action was completed.
- Neither value proves identity or authorization. Route access is not currently guarded.

### Prototype behaviors

- Evidence analysis currently uses a deterministic delayed mock response.
- The browser currently calculates demo points and cosmetic progress.
- The browser stores lifetime points independently from daily and weekly points. It resets weekly league points on the first read after a Monday `00:00` Asia/Singapore boundary.
- Completing the flow creates a profile post summary in local storage; the selected local image is previewed with an object URL and is not persisted.
- Join accepts any invite string of at least three characters and maps it to the seeded Glass Guardians crew.
- Create accepts a crew name and derives a demonstration invite code locally.
- Deleting a locally created crew clears its local membership and crew-scoped demo progress. Production deletion still requires an owner-authorized atomic backend operation that removes every membership and revokes invites.
- X, Telegram, and WhatsApp open web sharing URLs. Instagram copies the invite URL because the prototype cannot target the Instagram app directly.

### Replacement rule

Each prototype mutation must be replaced by an authenticated service call before production. Do not incrementally treat local storage as a cache of trusted totals. When an API is integrated, rehydrate that complete domain (for example, crew membership and league state together) from the server and remove the corresponding browser mutation.
