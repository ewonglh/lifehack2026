# EcoCrew — Shared Contracts and Boundaries

This document defines the agreements between product, design, frontend, Supabase, the VLM integration, and players. It aims to keep the product fair, safe, and easy to change while the team builds quickly.

## 1. Product contracts

### 1.1 The core promise

EcoCrew makes correct disposal quicker, clearer, and more rewarding. It must not shame users, overstate certainty, or make competition more important than learning.

### 1.2 The daily-loop boundary

The supported core loop is:

1. Capture or upload an item image.
2. Make a disposal-bin choice.
3. Receive guidance and confirm/correct the result.
4. Create a profile post summary and earn bounded progress for the player and crew.

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
| Product/config data | Versioned configuration | Point values, item caps, mission definitions, cosmetic unlock rules | Hard-coded divergent rules in multiple clients |

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
- A player may leave a crew without deleting their personal scan history.
- Historical crew totals remain intact when someone leaves, but private player data is not exposed after departure.
- Only the crew owner may delete a crew. Deletion is a confirmed, trusted server transaction that invalidates invites, removes all active memberships, and removes or archives crew-scoped mission, streak, feed, and league state according to retention policy.
- Deleting a crew does not delete a former member’s personal profile, private posts, scan history, or lifetime points.
- The product should define a small initial maximum crew size (for example, 8) and enforce it server-side.
- Join and Create actions are shown only when the player has no active crew membership. The server remains responsible for preventing conflicting memberships and enforcing capacity.

### 3.3 Invites and contacts

- Contact import is optional, consent-based, and never required to play.
- Store only the minimum invite metadata needed; do not persist an entire address book by default.
- Invite links are revocable, expire, and may be single-use or rate-limited.
- A manual share link is the baseline path. The current interface offers X, Instagram, Telegram, and WhatsApp; these channels receive only a revocable invite URL and user-authored share text.
- Instagram has no direct browser-targeted share endpoint in the current prototype, so its action copies the invite link for the user to paste.

### 3.4 Images and activity sharing

- Item photos are private by default.
- The social feed shares an activity summary (for example, “Ari completed a recycling action”), not the photo, unless the user explicitly chooses otherwise.
- A **post** is the user-facing projection of a completed `scan_event`. Its default profile representation contains item name, chosen/final bin, outcome, points, and creation time, but not the original image.
- Creating a scan does not automatically make the original image public. Future image sharing requires a separate, explicit visibility choice.
- Players can delete their images and activity records, subject to clearly explained leaderboard/history effects.
- Never use submitted images for unrelated model training or marketing without separate, explicit consent.

## 4. VLM and classification contracts

### 4.1 Trust boundary

- The VLM is an **assistant**, not an authority.
- The VLM is called only from an Edge Function or equivalent trusted server boundary.
- API keys and provider-specific prompts never reach the client bundle.
- The client never assumes a raw VLM response is valid or complete.

### 4.2 Required normalized response

Every classification must be normalized and schema-validated before it reaches game logic:

```ts
type DisposalBin = "recycle" | "compost" | "reuse_return" | "landfill" | "unknown";

type ClassificationResult = {
  itemName: string;
  material: string | null;
  recommendedBin: DisposalBin;
  preparationTip: string | null;
  confidence: number; // 0–1
  localeRuleVersion: string;
  explanation: string | null;
};
```

`unknown` is a valid outcome. Do not coerce uncertainty into a recycling decision.

### 4.3 Confidence and correction

| Condition | Product behavior | Scoring behavior |
|---|---|---|
| High confidence | Reveal the recommendation and request user confirmation | Eligible for normal points after confirmation |
| Low confidence | Explain uncertainty; let the player choose a bin or retry | No accuracy bonus; optionally award participation only |
| User disagrees | Let them select another bin and optionally report why | Store correction; do not penalize by default |
| Image/API failure | Offer retry and manual education card | No scan points; never break the daily flow |

The threshold is configurable server-side (initially, for example, `0.70`) and must not be duplicated in the client.

### 4.4 Local disposal rules

- Model guidance is scoped to an explicit locale/rule version.
- The result includes `localeRuleVersion` so past scans can be interpreted accurately.
- Launch with one supported ruleset. Outside it, the UI says guidance may differ locally.
- Source-of-truth disposal rules live in curated configuration, not solely in an unversioned model prompt.

## 5. Scoring and progression contracts

### 5.1 Fairness principles

- Reward correct decisions and preparation, not raw material volume.
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
  scanEventId: string | null;
  actionType: "action_completed" | "prep_step" | "daily_first" | "mission" | "streak_bonus";
  points: number;
  scoringRuleVersion: string;
  occurredAt: string;
};
```

Player totals, crew totals, and rankings are derived from these events or updated transactionally from them. Never use a mutable browser-maintained total as the source of truth.

### 5.3 Idempotency and duplicate prevention

- Each scan submission includes an idempotency key generated by the client.
- Repeating the same request returns the original result; it does not create more score events.
- The Edge Function enforces daily caps and duplicate/rate limits.
- A correction can amend classification metadata but cannot repeatedly mint new points.

### 5.4 Streak definition

- A streak is based on a declared timezone and daily cutoff, stored per crew.
- A crew completes a day when its configured minimum number of distinct members complete a qualifying action.
- A repair token is consumed only through a trusted transaction and only once per missed day.
- The UI must state the exact completion rule and cutoff.

### 5.5 Leaderboard definition

- Weekly rankings use a fixed start/end timestamp and a score snapshot or deterministic query.
- Resetting a weekly league must not modify lifetime points, historical posts, or immutable score events; the weekly total is a windowed projection of those events.
- Ties use a documented tie-breaker (for example, earliest completion time, then shared rank).
- A crew’s relevant league is the default view; worldwide ranking is secondary.
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
  scanEventId: string;
  itemName: string;
  finalBin: DisposalBin;
  isCorrect: boolean | null;
  points: number;
  createdAt: string;
  visibility: "private" | "crew" | "public";
  imageVisible: boolean;
};

type DailyTask = {
  taskId: string;
  taskDay: string;
  title: string;
  instruction: string;
  prompt: string;
  locale: string;
  localeRuleVersion: string;
  targetObject: string;
  targetMaterial: string | null;
  targetAction: DisposalBin;
  validationMetadata: Record<string, unknown>;
};

type ClassificationResult = {
  itemName: string;
  material: string | null;
  recommendedBin: DisposalBin | "unknown";
  preparationTip: string | null;
  confidence: number;
  localeRuleVersion: string;
  explanation: string | null;
  taskPrompt: string;
  promptSimilarity: number;
  taskSatisfied: boolean;
  matchesTask: boolean;
  taskConfidence: number;
  taskReason: string | null;
  failureReason: "liquid_present" | "unrelated_item" | "recycling_context_missing" | "low_confidence" | "upload_failure" | "ai_failure" | null;
};

type CrewMembership = {
  crewId: string;
  crewName: string;
  role: "owner" | "member";
  joinedAt: string;
};
```

The profile update endpoint accepts only editable fields (`displayName`, `handle`, `age`, and `about`) plus explicit visibility preferences. It must ignore attempts to update points, streaks, roles, inventory ownership, or server-generated statistics.

Crew Create and Join mutations return the same normalized `CrewMembership` shape. Joining accepts an opaque invite token, not a trusted crew ID supplied by the browser. A successful mutation invalidates crew, mission, feed, and league queries so Join/Create controls disappear immediately.

### 6.1 Classify-and-score request

```ts
type SubmitTaskRequest = {
  image: File;
  taskId: string;
  idempotencyKey: string;
  locale: string;
  demoFixture?: "liquid_bottle" | "empty_bottle" | "unrelated_item";
};

// Legacy userSelectedBin fields may be sent by an older client for a short
// compatibility window, but they are ignored and never affect scoring.
```

Validation rules:

- The image is accepted only as ephemeral multipart data; no task image path is trusted or persisted.
- File type/size limits are verified server-side.
- The authenticated actor is derived from the session; no actor ID is accepted from the browser.
- A request is rate-limited before calling the VLM.

### 6.2 Response

```ts
type SubmitTaskResponse = {
  submissionId: string;
  classification: ClassificationResult;
  outcome: "awaiting_check_in" | "completed" | "failed" | "unknown";
  behaviorCheckIn: {
    action: "recycle_bottle";
    status: "pending" | "confirmed";
    selfReported: boolean;
    confirmedAt: string | null;
  };
};

type ConfirmActionRequest = {
  submissionId: string;
  idempotencyKey: string;
  action: "recycle_bottle";
};

type ConfirmActionResponse = SubmitTaskResponse & {
  awarded: Array<{ actionType: string; points: number }>;
  points: {
    actionCompletion: number;
    preparation: number;
    dailyBonus: number;
    total: number;
  };
  dailyPointsRemaining: number;
  crewUpdate?: {
    weeklyPoints: number;
    missionProgress: number;
    streakStatus: "advanced" | "already_complete" | "not_qualified";
  };
};
```

The frontend renders these responses; it does not recalculate awards. A successful photo validation returns `awaiting_check_in` with zero points. The self-reported confirmation operation is idempotent and is the only operation that awards preparation, action-completion, daily, streak, or crew progress. The photo validates preparation and recycling context; it does not prove that disposal occurred.

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
| `AI_FAILURE` | Offer retry/manual guidance; do not imply the item was classified |
| `DUPLICATE_REQUEST` | Rehydrate and display the original response |
| `INTERNAL_ERROR` | Apologize, provide retry, and log an opaque correlation ID |

## 7. Data and database boundaries

### 7.1 Source of truth

| Data | Canonical source |
|---|---|
| Authentication/session | Supabase Auth |
| Profile and crew membership | Postgres tables protected by RLS |
| Scan image bytes | Ephemeral Edge Function request; never persisted |
| Classification and score events | Postgres, created through trusted function |
| Mission/rules configuration | Versioned server-side configuration/table |
| UI cache | Client query cache only; disposable |

### 7.2 Access controls

- RLS is enabled on every user-data table.
- Direct client writes are limited to safe profile preferences; sensitive task mutations and any avatar upload go through Edge Functions/RPCs.
- Task photos are never placed in Storage. Avatar policies ensure users can access only their own avatar objects.
- Service-role credentials exist only in server-side runtime.

### 7.3 Retention and deletion

- Task images are discarded after classification. Avatar retention follows profile deletion and replacement cleanup rules.
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

Track only events that answer a product question. Do not log raw images, prompts, disposal explanations, contact lists, or personally sensitive text into generic analytics.

Initial events:

| Event | Required properties | Product question |
|---|---|---|
| `daily_challenge_started` | player/crew anonymized IDs, mission ID | Do players begin the loop? |
| `action_photo_submitted` | locale, confidence band, outcome | Can participants complete the preparation step? |
| `action_completed` | self-reported, points, duration band | Do participants complete the recycling action? |
| `profile_post_created` | post visibility, image-visible boolean | Do players value keeping a history of eco actions? |
| `classification_corrected` | model bin, final bin, reason optional | Where is model guidance failing? |
| `crew_created/joined` | crew ID, entry method | Do players form or join crews? |
| `crew_invite_shared` | crew ID, invite channel | Which invitation paths support crew growth? |
| `reward_unlocked/equipped` | item ID, unlock rule | Are progression rewards motivating? |

Review retention by cohort (day 1, day 7) and correction rate before expanding reward systems.

## 10. Delivery boundaries for the hackathon

### In scope

- One locale, four disposal outcomes, small private crews, seeded weekly mission, reliable mock fallback, cosmetic unlock, and mobile-friendly end-to-end flow.

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

## 12. Local mock adapter contract

When `VITE_USE_MOCK_DATA=true` in development, `src/features/ecocrew/scan-service.js` provides a disposable browser adapter. Supabase mode is the production path and keeps identity, scoring, task completion, and progress server-authoritative.

### Browser keys

- `localStorage.ecocrew-demo-state` stores profile edits, post summaries, points, daily usage, the active Singapore task day, the submitted task day, crew membership, mission progress, the last result, and reactions.
- `sessionStorage.ecocrew-demo-signed-in` records that a mock login/register action was completed.
- Neither value proves identity or authorization. They are never read in Supabase mode.

### Prototype behaviors

- The mock adapter exposes three deterministic outcomes: liquid-present bottle, empty bottle, and unrelated item.
- The browser calculates points only in local mock mode; Supabase scoring is performed by the trusted submission and confirmation RPCs.
- The browser stores lifetime points independently from daily and weekly points. It resets weekly league points on the first read after a Monday `00:00` Asia/Singapore boundary.
- A mock player may retry failed attempts throughout the Singapore calendar day. A successful photo creates a pending check-in with no points; only the self-reported confirmation completes and locks the task. Repeating the same idempotency key returns the original result.
- Players without an active crew can still earn personal points, but do not display or accrue crew weekly points or mission progress until they join or create one.
- Completing the flow creates a metadata-only profile post summary; the selected local image is previewed with an object URL and is not persisted.
- Join uses a six-character invite code and the seeded `ECO123` Glass Guardians invitation.
- Create accepts a crew name and derives a demonstration invite code locally.
- Deleting a locally created crew clears its local membership and crew-scoped demo progress. Production deletion still requires an owner-authorized atomic backend operation that removes every membership and revokes invites.
- X, Telegram, and WhatsApp open web sharing URLs. Instagram copies the invite URL because the prototype cannot target the Instagram app directly.

### Replacement rule

Each prototype mutation must be replaced by an authenticated service call before production. Do not incrementally treat local storage as a cache of trusted totals. When an API is integrated, rehydrate that complete domain (for example, crew membership and mission state together) from the server and remove the corresponding browser mutation.
