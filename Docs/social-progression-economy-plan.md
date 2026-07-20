# Social / Progression / Economy — Implementation Plan

> **Status:** 📋 Planned, implementation-ready (v2, July 2026 — grounded against the shipped
> codebase: better-auth users, `solve_attempts`, the 19-board daily registry, and the
> AGENTS.md §6 security posture). v1 of this plan sketched the systems; v2 pins schemas to
> real tables, names the integration points, and gives each slice a gate.

## 1. Overview

This update layers progression, a single soft currency, and social features on top of the
puzzle platform. Three systems feed one another:

- **Progression** (achievements, streaks) generates currency and status.
- **Economy** (currency, shop, inventory) gives that status somewhere to go.
- **Social** (profile, friends, battles) gives it an audience.

Design principles locked for v1:

- **Currency is earned from play, never bought.** Closed loop → balancing stays simple.
  Monetization, if ever, hangs off the shop later without touching the earn side.
- **The server is the only mint.** Every earn event originates from the already-shipped
  server-validated completion path (`/api/solve` — grid checked against the stored
  solution, server-computed time, plausibility floors). No client ever posts an amount.
- **Flavor: this is Biscuit Lab — the currency is “crumbs” 🍪.** (Rename is one constant;
  decide finally at S1.)

## 2. Grounding in the shipped codebase (what v1 of this plan predated)

| Plan concept | Shipped reality to build on |
|---|---|
| “users” table | better-auth `user` (TEXT ids) in `auth-schema.ts` — all FKs are `text` |
| “puzzle completion events” | `solve_attempts` rows written by `/api/solve` (`completed`, server `time_ms`, `mistakes`, unique per user×puzzle) — the ONLY trusted earn trigger |
| “puzzleType 'killer_sudoku' / 'kakuro'” | The **daily-board registry** (`daily-row.ts`): 19 keys/day in three sections (classic / killer / minis) — KenKen adds a fourth. Achievements + streaks key off board keys and sections, not invented type strings |
| “each type publishes fixed 5 levels/day” | Sections have different sizes (classic 5, killer 5, minis 9). Gold-day denominators come from `DAILY_BOARDS` counts, never hardcoded |
| new `dailyCompletions` table | **Not needed** — `solve_attempts ⋈ daily_puzzles` already IS the completion log (date, key, time, mistakes). Derive; don’t duplicate state |
| “streaks” table | A computed-on-read streak already ships (`streak.service.ts`). Freezes need STORED state, so S2 introduces `streak_state` and the computed version becomes its bootstrap/verification oracle |

## 3. Slices

| Slice | Scope | Depends on | New infra |
|---|---|---|---|
| **S1** | Crumbs ledger + achievements engine | `/api/solve` hook | none |
| **S2** | Stored streaks, flame tiers, freezes | S1 | none |
| **S3** | Archive gold/partial days (calendar badges) | S2 | none |
| **S4** | Cosmetics shop + inventory + equip | S1 | none |
| **S5** | Profile page + friends + friend streaks | S1–S4 | none |
| **S6** | Async battles (beat a friend’s run) | S5 | none |
| **S7** | Live battles (real-time) | S6 | **yes — realtime layer** |

### S1 — Crumbs ledger + achievements engine

- **Migration** (`0004`): `currency_transactions` (append-only, signed, `reason` +
  `source_id`, indexed by user), `achievements` (seeded statically — key, name, category,
  `reward_crumbs`, criteria params), `user_achievements` (PK user×achievement).
  **No balance column** — balance = `SUM(amount)` per user (materialize later only if
  measured slow; a portfolio-scale ledger sums in microseconds with the index).
- **Service** `progression.service.ts`: `onDailyCompleted(db, userId, attempt, board)` —
  called from `/api/solve` inside the existing success path. Computes payout, writes the
  transaction, evaluates achievement criteria (pure functions over the attempt + counts),
  grants + pays achievements. Idempotent by construction: `solve_attempts` is unique per
  user×puzzle, and payout transactions carry `source_id = attempt.id` with a unique index.
- **Payout formula** (v1): `reward = base(board) × (1 + min(streak, 10) × 0.05)` where
  `base` lives in the daily-board registry as a new `crumbs` field per board (easy 10 …
  killer-extreme 60; minis 5–15). Streak multiplier caps at +50%.
- **Achievement seed set (~20)**: Firsts (first classic/killer/mini/expert/extreme clear),
  Mastery (zero-mistake per section, sub-N-minute per difficulty band), Consistency
  (streaks 7/30/100), Volume (lifetime 25/100/500 per section). **No backfill** (decided):
  achievements start at launch.
- **API**: `GET /api/progression` (balance, recent transactions, achievements —
  session-scoped, BOLA-safe by construction: userId only ever from the session).
- **UI**: crumbs count in the header AccountBadge area; achievement toast on unlock
  (reuse the juice layer’s stamp/sticker components); achievements list on the profile
  (placeholder page until S5).
- **Gate:** unit tests for payout idempotency (double-solve pays once), criteria functions,
  and ledger math; E2E: complete a daily signed-in → crumbs visible.

### S2 — Streaks, flames, freezes

- **Migration** (`0005`): `streak_state` (PK user×scope, where scope is a SECTION —
  `classic` | `killer` | `minis` | later `kenken` — plus an `overall` scope), columns:
  current, longest, `last_completed_date`, `freezes_available`. `streak_freeze_log`
  (append-only audit).
- **Semantics**: a scope’s day counts when ANY board in that scope is completed that UTC
  day (overall = any board at all). The existing computed streak (`streak.service.ts`)
  stays as the verification oracle in tests and seeds `streak_state` on first write per
  user (bootstrap from history — cheap, and avoids a “everyone resets to day 1” launch).
- **Freezes**: earn 1 at every 7-day milestone (max held 3); purchasable at 100/250/500
  crumbs scaling with held count; **auto-consume** inside the same daily-continuity check
  that updates `streak_state` (runs on completion write, not a cron — no new scheduled
  jobs). Every consume/earn/purchase is a ledger + freeze-log row.
- **UI**: flame with 5 tiers (3/7/30/100/365) on header + profile; freeze count + purchase
  in the streak popover.
- **Gate:** property tests — computed-oracle vs stored-state agreement over simulated
  histories incl. freeze consumption; purchase path rejects insufficient balance
  server-side.

### S3 — Archive gold / partial days

- **No migration.** Gold/partial per (user, date, section) derives from
  `solve_attempts ⋈ daily_puzzles`: distinct completed keys vs the section’s board count
  **on that date** (denominator = boards that actually existed that day — pre-expansion
  dates had 5/1/0, the registry history handles it; store a tiny
  `daily_board_counts(date, section, count)` snapshot written by the cron from launch
  day, backfilled once from existing rows).
- **UI**: the existing archive calendar gains per-day badges (gold ring / “3∕5” fraction,
  per-section tabs). Gold day pays a small crumbs bonus (ledger reason `gold_day`,
  idempotent on (user, date, section)).
- **Gate:** unit tests on denominators across the expansion boundary dates.

### S4 — Cosmetics shop + inventory

- **Migration** (`0006`): `cosmetic_items` (seeded statically: key, category
  `board_skin` | `number_style` | `profile_theme` | `avatar_hat` | `avatar_accessory`,
  rarity, price), `user_inventory` (PK user×item, `equipped`).
- **Purchase** is a single transaction: balance check + ledger debit + inventory insert,
  all server-side, `FOR UPDATE`-safe via one SQL statement per step in a Drizzle
  transaction. BOLA: inventory/equip mutations scope by session userId only.
- **Board skins must not compromise readability** — skins recolor the existing token
  system (they are token-set overrides, exactly like the dark theme), never per-cell art.
  Equip = a `data-skin` attribute the token CSS already knows how to serve.
- **Launch set**: ~12 items (4 board token-sets, 3 number styles, 3 profile themes, 2
  avatar accessories) across 3 rarities — enough for the economy to mean something.
- **Gate:** purchase race test (two concurrent buys can’t double-spend), equip E2E, a11y
  contrast check per skin (the Phase 5 tooling).

### S5 — Profile + friends + friend streaks

- **Migration** (`0007`): `friendships` (PK ordered pair + status; requests are rows with
  `pending`), `friend_streaks` (pair PK, current/longest, `last_shared_date`).
- **Profile page** `/u/[username]`: public — avatar + equipped cosmetics, flames, badge
  wall, longest streaks, per-section bests (reuses leaderboard queries). Private fields
  never serialized (same posture as `solution` handling).
- **Friend streak**: alive if BOTH completed any daily that UTC day; updated in the same
  completion hook as personal streaks.
- **BOLA is the whole game here** (AGENTS.md §6 calls this the top AI-endpoint failure):
  every friendship mutation checks the session user is a member of the pair; profile
  reads expose only public projections.
- **Gate:** authorization tests per route (foreign-id spoofing rejected), friend-streak
  property tests.

### S6 — Async battles

- **Migration** (`0008`): `battles` (type `async`, board key + date OR generated-puzzle
  seed payload, creator, status), `battle_participants` (PK battle×user, server-timed
  result fields).
- Flow: challenge a friend on a specific board → they play the SAME puzzle (daily board
  by key/date, or a stored generated puzzle for free-play challenges) → server-validated
  results compared; winner banner + small crumbs stake (fixed pot from the house, not
  wagered — keeps the closed loop and avoids gambling adjacency).
- **Gate:** solution never served for an open battle the challengee hasn’t finished
  (tightens the pragmatic posture for this one surface — battles are the first place
  where seeing the solution defeats a real opponent, not just yourself).

### S7 — Live battles (separate, gated, optional)

- Needs a realtime layer (Ably/Pusher/Supabase Realtime — serverless holds no sockets).
  Decision deferred until S6 usage proves demand; nothing in S1–S6 depends on it.

## 4. Currency table (v1 baseline — tune with real data)

| Earn | Crumbs |
|---|---|
| Daily complete (classic e/m/h/ex/xt) | 10 / 15 / 25 / 40 / 60 |
| Daily complete (killer ladder) | 15 / 20 / 35 / 50 / 60 |
| Daily complete (minis) | 5–15 by board |
| Gold day (per section) | 50 |
| Achievements | 25–500 by category tier |
| Streak multiplier | +5%/day, capped +50% |

Shop anchors: common 150–300, rare 600–1200, legendary 2500+ — a daily-ish player earning
~100/day reaches a rare in ~1–2 weeks, legendary in ~a month. Watch and retune (Risk 1).

## 5. Risks

1. **Economy balancing is a workstream, not a formula** — ship S4 early enough to observe
   earn/spend before adding earn sources; the append-only ledger makes retuning auditable.
2. **Freeze abuse** — cap 3 held, scaling prices, audit log; revisit with usage data.
3. **Live battles infra** — quarantined in S7; never blocks S1–S6.
4. **Leaderboard-vs-economy double rewards** — crumbs celebrate completion, ranks
   celebrate speed; keep speed OUT of the payout formula (mastery achievements cover it
   once) so grinding slow easies stays the worst strategy, not the best.
5. **Backfill: none** (decided) — achievements/crumbs start fresh; streak bootstrap from
   history is the one deliberate exception (S2) because resetting visible streaks at
   launch would punish the existing habit the feature exists to reward.

## 6. Definition of done (S1–S6)

Signed-in players earn auditable crumbs from server-validated daily completions, unlock
achievements, hold section streaks with freezes, see gold days in the archive, spend in a
shop whose skins pass readability checks, maintain a public profile with friends and
friend streaks, and challenge friends async — with every mutation session-scoped
(BOLA-checked), every payout idempotent, and zero client-trusted amounts anywhere.
