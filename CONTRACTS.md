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
4. Earn bounded progress for the player and crew.

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

### 3.2 Crews

- A player can see a crew only if they are an active `crew_members` record.
- Crew owners can invite/remove members and configure crew-level settings.
- A player may leave a crew without deleting their personal scan history.
- Historical crew totals remain intact when someone leaves, but private player data is not exposed after departure.
- The product should define a small initial maximum crew size (for example, 8) and enforce it server-side.

### 3.3 Invites and contacts

- Contact import is optional, consent-based, and never required to play.
- Store only the minimum invite metadata needed; do not persist an entire address book by default.
- Invite links are revocable, expire, and may be single-use or rate-limited.
- A manual share link is the baseline path. Facebook/Google integrations are enhancements, not dependencies.

### 3.4 Images and activity sharing

- Item photos are private by default.
- The social feed shares an activity summary (for example, “Ari completed a recycling action”), not the photo, unless the user explicitly chooses otherwise.
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
  actionType: "correct_sort" | "prep_step" | "daily_first" | "mission" | "streak_bonus";
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
- Ties use a documented tie-breaker (for example, earliest completion time, then shared rank).
- A crew’s relevant league is the default view; worldwide ranking is secondary.
- Rankings need not be real-time; label refresh time honestly.

## 6. API contracts

### 6.1 Classify-and-score request

```ts
type ClassifyAndScoreRequest = {
  idempotencyKey: string;
  imageStoragePath: string;
  userSelectedBin: DisposalBin;
  locale: string;
  crewId?: string;
};
```

Validation rules:

- Requesting user owns the image path.
- File type/size limits are verified server-side.
- `crewId`, if supplied, belongs to the requesting user.
- Bin values are enum-validated.
- A request is rate-limited before calling the VLM.

### 6.2 Response

```ts
type ClassifyAndScoreResponse = {
  scanEventId: string;
  classification: ClassificationResult;
  outcome: "confirmed" | "needs_confirmation" | "unknown";
  awarded: Array<{ actionType: string; points: number }>;
  dailyPointsRemaining: number;
  crewUpdate?: {
    weeklyPoints: number;
    missionProgress: number;
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
| Scan image bytes | Private Supabase Storage bucket |
| Classification and score events | Postgres, created through trusted function |
| Mission/rules configuration | Versioned server-side configuration/table |
| UI cache | Client query cache only; disposable |

### 7.2 Access controls

- RLS is enabled on every user-data table.
- Direct client writes are limited to safe profile preferences and uploads to the user-owned path; sensitive mutations go through Edge Functions/RPCs.
- Storage policies ensure users can access only their own original images unless explicitly shared.
- Service-role credentials exist only in server-side runtime.

### 7.3 Retention and deletion

- Define a retention period for raw images; prefer automatic deletion after classification where feasible.
- Deletion of an image should not require deleting an aggregated, non-identifying score event unless legally required.
- Deleting a profile should revoke access immediately and cascade/anonymize data according to a documented policy.

## 8. UI and design system contracts

- Bin names and icons are always paired; color alone never conveys meaning.
- Loading states show progress and retain the image-selection context.
- Every primary view has loading, empty, error, and offline/degraded states.
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
| `sort_submitted` | selected bin, locale, confidence band | Is the interaction understandable? |
| `sort_completed` | outcome, points, duration band | Is the loop fast and satisfying? |
| `classification_corrected` | model bin, final bin, reason optional | Where is model guidance failing? |
| `crew_invite_created/joined` | crew ID, invite channel | Does the social hook work? |
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
