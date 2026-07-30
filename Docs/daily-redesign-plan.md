# Daily Redesign — Random-Type Ladder + Medals

> **Status:** 📋 Planned (design agreed, not yet built — July 2026). This document
> captures a scope change to the shipped Phase 4 daily system and its ripple into the
> planned Phase 9 economy. Per the AGENTS.md roadblock/scope-change rule, it is written
> before any code so we have a durable record of *why* the daily changed shape.

## 1. Why change

The daily grew from a focused set into a **30-board wall** (the docs still say "19" — that
count predates the Keisan ladder; see §3). Every night the cron generates all 30 (including
the ~5.5 s Extreme tiers), every board carries its own leaderboard and Sudoku Bot entry, and
with a small player base most of those 30 leaderboards sit empty. A daily should be a
**ritual with a clear win condition**, not a 30-item menu.

The goal: collapse to a small, fixed set of slots whose *puzzle type is rolled each day*, add
a completion medal, and make the medal the primary crumbs faucet for the planned economy
(Phase 9). This concentrates the player base onto a handful of shared leaderboards and gives
every day a reason to come back.

## 2. Agreed decisions

These were confirmed with the project owner before writing this plan:

1. **Randomization model:** *fixed difficulty ladder, random type per slot.* Each slot has a
   fixed difficulty; its puzzle **type** is rolled daily from the eligible pool. Type repeats
   across slots are allowed. (Chosen over fully-random and fixed-rotation — a fixed ladder
   guarantees a beginner board *and* an expert board exist every day.)
2. **Medals:** *gold + partial tiers* — bronze / silver / gold for partial→full completion of
   a set, plus a separate mini medal for the mini set.
3. **Economy:** *design the medal ledger-ready now* — an idempotent, top-up daily award so
   Phase 9 crumbs slot in without rework.
4. **Mini set composition:** *6 boards = easy / medium / hard × {4×4, 6×6}.* "Minis" =
   anything smaller than 9×9 (matching today's minis section).

## 3. Current state (accurate, as of this plan)

- **30 boards/day**, defined by the `DAILY_BOARDS` registry
  ([daily-row.ts](../src/lib/db/daily-row.ts)): classic 9×9 (5), Killer 9×9 (5), minis (15:
  4×4/6×6 classic, 6×6 Killer, 4×4/6×6 Keisan), Keisan 9×9 (5). The docs
  ([roadmap.md](roadmap.md) line ~53, [social-progression-economy-plan.md](social-progression-economy-plan.md))
  and the cron comment ([cron/daily/route.ts](../src/app/api/cron/daily/route.ts)) all still
  say "19" — **stale**; fixing that string is part of this work.
- **Precomputed and stored, not seeded-PRNG.** The Vercel Cron hits `GET /api/cron/daily` at
  00:00 UTC; `generateDailyPuzzles` ([dailies.service.ts](../src/features/dailies/dailies.service.ts))
  maps over `DAILY_BOARDS`, dispatches by `board.variant`, and bulk-inserts. Idempotency is
  `UNIQUE(date, difficulty)` + `onConflictDoNothing`. **The stored row is the single source of
  truth** — every player reads the same row, so we do *not* need date-seeded selection.
- **The registry key IS the identity.** `daily_puzzles.difficulty` stores the board `key`
  (e.g. `killer-expert`), which doubles as the API param, the leaderboard key, and the
  idempotency handle. **The key currently encodes the puzzle type** — this is the single
  biggest thing this redesign changes.
- **Variant is derived from the key**, not stored: the serve route
  ([daily/route.ts](../src/app/api/daily/route.ts)) looks type up via `getDailyBoard(key)`,
  and derives grid size from `grid.length`. `cages` jsonb is interpreted (Killer sum vs.
  Keisan op+target) by the key's variant.
- **Per-board tuning lives in the registry:** `minSolveMs` (anti-cheat floor) and `botTimeMs`
  (Sudoku Bot's "time to beat"), both keyed per board.
- **No medals exist in code.** The crumbs/achievements economy is *designed but unbuilt*
  ([social-progression-economy-plan.md](social-progression-economy-plan.md)); its S1–S3 key
  off `DAILY_BOARDS` counts and per-variant *sections* — which this redesign reshapes (§9).

## 4. Proposed model

### 4.1 Main set — 5 slots, fixed ladder, random type

| Slot key | Difficulty | Size | Type (rolled daily) |
|---|---|---|---|
| `easy` | easy | 9×9 | random of eligible |
| `medium` | medium | 9×9 | random of eligible |
| `hard` | hard | 9×9 | random of eligible |
| `expert` | expert | 9×9 | random of eligible |
| `extreme` | extreme | 9×9 | random of eligible |

### 4.2 Mini set — 6 slots, fixed ladder, random type

| Slot key | Difficulty | Size | Type (rolled daily) |
|---|---|---|---|
| `mini4-easy` | easy | 4×4 | random of eligible |
| `mini4-medium` | medium | 4×4 | random of eligible |
| `mini4-hard` | hard | 4×4 | random of eligible |
| `mini6-easy` | easy | 6×6 | random of eligible |
| `mini6-medium` | medium | 6×6 | random of eligible |
| `mini6-hard` | hard | 6×6 | random of eligible |

**11 boards/day, down from 30.** The slot keys above are **reused from the existing registry**
(the classic 9×9 keys and the classic-mini keys), so no new key strings are minted — but their
*meaning* changes from "classic Sudoku at this difficulty" to "today's board at this
difficulty, whatever type was rolled." See §7 for how history stays valid.

### 4.3 Eligibility pools (which types a slot may roll)

A type is eligible for a slot only if it has an implemented generator + grader at that
**(size, difficulty)**. Today:

| Size | Difficulty | Eligible types |
|---|---|---|
| 9×9 | easy / medium / hard / expert / extreme | Sudoku, Killer, Keisan |
| 6×6 | easy / medium / hard | Sudoku, Killer, Keisan |
| 4×4 | easy / medium / hard | Sudoku, Keisan |

> **Note — no Killer 4×4.** The current registry has Killer minis at 6×6 only. So the 4×4
> slots roll from {Sudoku, Keisan} until/unless a 4×4 Killer generator is added.

New puzzle types (Nonogram, Solitaire, …) register into these pools when their generator +
grader + anti-cheat/bot profile land — they need no daily-system changes beyond a registry
row.

### 4.4 Selection is done by the cron, at generation time

Because the stored row is the source of truth, the cron simply **rolls a type per slot from
its eligible pool, generates it, and stores it** — no date-seeded PRNG needed. Everyone reads
the stored row, so the "same board worldwide" guarantee is unchanged. (If we ever want the
roll reproducible for testing/regeneration, seed the per-slot choice by `date`; not required
for correctness.)

### 4.5 Repeat cap (anti-monotony)

Repeats are allowed, but not a whole set of one type. The roll enforces a **max of 3 of any
one type per set** for now — so the 5 main slots can never all (or 4-of-5) be the same type,
while still allowing a comfortable 3-of-a-kind day. Applied independently to the main set (5)
and the mini set (6). **Lower the cap to 2 once the eligible pools grow** (more types make a
tighter cap feasible and desirable). With today's 3 eligible 9×9 types, cap-3 is the sweet
spot; cap-2 is already feasible (e.g. 2 + 2 + 1) whenever we choose to tighten it. The 4×4
mini pool has only 2 types, so it is naturally sub-cap regardless.

## 5. Medals

- **Main medal:** bronze / silver / gold at **3 / 4 / 5** of the 5 main boards completed.
- **Mini medal:** bronze / silver / gold at **2 / 4 / 6** of the 6 mini boards completed.
- Both derive from the existing completion log — distinct completed slot keys in a set on a
  given UTC date over the set's board count. No new "medal" state is needed to *compute*
  medals; the ledger event in §6 is what makes them pay out and stay idempotent.
- UI: a per-set medal on `/daily` and a per-day badge in the archive calendar (folds into the
  planned progression S3 "gold/partial days").

## 6. Ledger-ready crumbs (Phase 9 faucet)

Design the medal award now so Phase 9's economy inherits it cleanly:

- **One award event per `(user, date, set)`**, written on the completion path (`/api/solve`
  success), never client-reported.
- **Top-up, not double-pay:** if a player improves within the same day (3 → 5 boards, i.e.
  bronze → gold), the award *upgrades* and pays only the delta. Implemented as an idempotent
  ledger row keyed on `(user, date, set)` whose amount is reconciled to the current tier —
  matching the append-only, idempotent design the economy plan already mandates.
- This becomes the **primary crumbs faucet**, replacing the economy plan's per-board flat
  payout table as the headline earn (per-board payouts can remain as a smaller component).
- Keep speed out of the medal payout (per economy-plan Risk 4) — medals reward *completion*;
  ranks reward speed.

## 7. Data model & migration

The one real schema change: **the puzzle type must be stored on the row**, because the slot
key no longer encodes it.

1. **Add `variant` to `daily_puzzles`** (`text`, `'classic' | 'killer' | 'calc'`). Migration
   `0004` (next in sequence). The serve route reads `variant` from the row instead of deriving
   it from the key; grid size stays derived from `grid.length`; cage interpretation keys off
   the stored `variant`.
2. **Backfill `variant` on existing rows** from their current registry key (every historical
   key maps to exactly one variant via `getDailyBoard`). After backfill, `variant` is
   `NOT NULL` going forward.
3. **Reuse the 11 slot keys**, freeze the rest. The main slots reuse `easy…extreme`; the mini
   slots reuse `mini4-{e,m,h}` / `mini6-{e,m,h}`. The other 19 keys (`killer-*`, `calc9-*`,
   `killer6-*`, `calc4-*`, `calc6-*`) are **retired from generation** but kept **readable** for
   archived rows — exactly the pattern already used for the legacy `'killer'` key.
4. **Re-index per-board tuning by `(variant, size, difficulty)`.** `minSolveMs`, `botTimeMs`,
   and the economy's `crumbs` base currently hang off the *key*; move them to a profile lookup
   keyed on `(variant, size, difficulty)` so a rolled type gets the right floor/bot time
   regardless of which slot it landed in. The `DAILY_BOARDS` registry is re-shaped into (a) a
   **slot list** (11 slots + eligibility) and (b) a **profile table** (per variant×size×difficulty).

No change to `solve_attempts` — attempts reference `puzzle_id`, so streaks/leaderboards keep
working across the reshape.

## 8. Leaderboard identity shift (deliberate)

Because a slot's type now varies by day, a leaderboard is only meaningful **within a day**:
"today's medium" is Keisan today, Sudoku tomorrow. That's an intentional trade — it
concentrates the small player base onto **11 stable leaderboards** instead of scattering
across 30, and makes **streaks + medals** the cross-day progression rather than
per-type-per-difficulty ladders. Within any single day, every player still shares the exact
same board, so same-day ranking stays fair. The Sudoku Bot posts on 11 boards instead of 30.

## 9. Ripple effects to reconcile

- **Progression/economy plan** ([social-progression-economy-plan.md](social-progression-economy-plan.md)):
  its "sections" model (classic / killer / minis / calc) collapses to **two sets** (main,
  minis) + `overall`. Streak *scopes*, gold-day *denominators*, and the payout table all
  re-key onto this. Variant-specific achievements ("first Killer clear", "zero-mistake
  Keisan") still work — they now read the stored `variant` column instead of parsing the key.
  This plan's §6 medal supersedes that plan's flat per-board faucet as the headline earn.
- **Cron cost:** 11 boards instead of 30 — `maxDuration` can drop (currently 120 s); confirm
  the Extreme 9×9 tiers still fit the reduced budget.
- **Seed script** ([seed.ts](../src/lib/db/seed.ts)) shares the service, so it follows for
  free; update its expectations/tests.
- **UI labels:** pickers/leaderboards currently label by static key. New labels compose from
  the row's `difficulty` slot + stored `variant` (e.g. "Medium · Keisan"). `formatDailyKey`
  and the `DailyExperience` picker need updating.
- **Archive:** past dates keep their old 30-board shape via retained keys; the per-date board
  count snapshot the economy plan's S3 already proposes handles the pre/post-cutover boundary.
- **Tests:** `dailies.service.test.ts`, `daily-row` tests, and any count-based assertions
  (the "30"/"19" denominators) get updated to the 11-slot model + eligibility.

## 10. Rollout

Forward-only cutover on a fresh branch:

1. Migration `0004` (add + backfill `variant`), registry reshape (slots + profiles +
   eligibility), cron rolls types per slot.
2. Serve route + UI read `variant` from the row; labels compose from slot + variant.
3. Medals computed on `/daily` + archive; ledger award stubbed idempotent (real crumbs land
   with Phase 9 S1, but the award event + top-up semantics ship now so the shape is fixed).
4. Fix the stale "19"/"30" strings in the docs and cron comment.
5. Old-key rows stay readable for archive; no historical leaderboard is destroyed.

## 11. Decisions & remaining open items

Resolved with the owner (2026-07-27):

- **Anti-monotony:** max **3 of any one type per set** now → **2** once pools grow (§4.5).
- **Two streaks:** a **main streak** and a **mini streak** (mirroring the two medals) — not a
  shared one. Confirms the `main` / `minis` (+ `overall`) streak scopes in §9.
- **Eligibility weighting:** **uniform** per pool for now. Option retained (e.g. bias the easy
  slot toward Sudoku so newcomers meet the familiar type first) but not implemented.

Still open (do not block the build):

- **Medal crumbs amounts:** how many crumbs bronze/silver/gold pays per set. This is a Phase 9
  *economy-balancing* number, not a mechanism decision — ship idempotent placeholder amounts
  now so the ledger event is testable, tune against real earn/spend when the shop exists.

## 12. Risks — what this could mess up

Honest downsides and failure modes of the redesign, each with a mitigation. The first three
are *product* risks (the design trades something real away); the rest are *implementation*
hazards (things the build can get wrong).

1. **Loss of per-type daily choice.** Today a Killer devotee can play a ranked Killer daily at
   their difficulty every single day. After this, their favorite type only appears when it's
   *rolled* into a slot — some days it won't show at all, or only at a difficulty they dislike.
   This is the biggest deliberate trade: we swap guaranteed per-type availability for variety +
   a tighter leaderboard. *Mitigation:* free play (`/play`) still offers any type/size/difficulty
   on demand — but unranked. If this bites, a "pick your daily type" option or a weekly
   type-guarantee could be layered back on; note it before shipping so we're not surprised by
   the complaint.

2. **"Easy" isn't equally easy across types — the gradient promise is only as good as
   cross-type difficulty parity.** A core rationale is "always a beginner board and an expert
   board each day." But an *easy Keisan* can feel harder to a Sudoku newcomer than an *easy
   Sudoku*, because each type is graded on its own scale. So the fixed ladder guarantees a
   *label* gradient, not a felt-difficulty gradient. *Mitigation:* accept it as approximate;
   revisit per-type calibration if the easy slot rolling a non-Sudoku type visibly spikes
   bounce/abandon. The (deferred) eligibility-weighting lever exists partly for this.

3. **Reduced daily content for power users; noisier leaderboard as a skill signal.** Cutting
   30 boards to 11 removes a lot of daily "stuff to do" for the most active players, and because
   a slot's type varies day to day, "today's hard leaderboard" rewards whoever is best at *that
   type today*, not a stable skill. A player strong at Sudoku but weak at Keisan ranks
   erratically. *Mitigation:* this is a casual daily, not a ranked ladder — medals and the two
   streaks are the real cross-day progression; ranks are a within-day flourish. State it so the
   expectation is set, not discovered.

4. **Gold gated on all-types competence.** A full-set gold now requires clearing whatever types
   were rolled — a player who simply can't do (say) extreme Keisan can never gold that day
   regardless of Sudoku skill. *Mitigation:* the partial tiers (bronze/silver at 3/4) are
   exactly the softener; keep them, and don't make gold the *only* rewarded outcome.

5. **Historical key reuse fractures cross-date aggregates.** We reuse `easy…extreme` /
   `mini4-*` / `mini6-*` but change their meaning at the cutover: before, `easy` was always
   classic Sudoku; after, it's a random type. Same-day leaderboards are unaffected (per
   `(date, key)`), but anything that aggregates a key *across dates* — e.g. all-time personal
   bests ([`/api/me/bests`](../src/app/api/me/bests/route.ts)) — now blends classic-Sudoku
   history with mixed-type future under one label. *Mitigation:* scope cross-date bests by the
   stored `variant` (not the slot key), or segment "all-time" at the cutover date. Decide before
   migration `0004`, since it affects what the backfill needs to preserve.

6. **Streak bootstrap at cutover — don't reset everyone to day 1.** Moving to two set-scoped
   streaks means existing users' streaks must be *bootstrapped* from history, mapping old
   sections to new sets (classic/killer/calc 9×9 → main; all minis → mini). Get this wrong and
   every player's visible streak resets on launch day — punishing exactly the habit the feature
   rewards. *Mitigation:* the computed streak (`streak.service.ts`) already reads history; use it
   as the bootstrap oracle (this is the economy plan's S2 approach) and test the mapping across
   the boundary.

7. **Anti-cheat floors & bot times must fully cover the rolled combinations.** `minSolveMs` /
   `botTimeMs` move from per-key to a `(variant, size, difficulty)` profile lookup. A missing
   entry for any *eligible* combination means either false cheat-rejections (floor wrong) or a
   nonsensical bot time — and a rolled slot with no profile could break solve validation
   outright. *Mitigation:* a build/test assertion that every eligible `(variant, size,
   difficulty)` has a profile row (eligibility ⊆ profile coverage), run in CI.

8. **A flaky/slow generator roll can leave a slot blank.** With 30 fixed boards a single
   generator failure was isolated; with random selection, rolling onto a type whose generator
   occasionally fails or times out (Keisan/Killer 9×9 extreme are the slow tiers) could leave a
   *whole slot* empty for the day. *Mitigation:* the cron must retry, and on repeated failure
   **fall back to another eligible type** for that slot rather than storing nothing — a daily
   slot must never be empty. Add a monitored alert when a fallback fires.

9. **The `variant` backfill must be exhaustive over every historical key.** Every row ever
   written — including the retired `killer-*`/`calc*` keys *and* the legacy `'killer'` key — must
   map to a variant, or archive replay of those days can't interpret its cages and the board
   breaks. *Mitigation:* build the backfill map from the full historical key set (not just the 11
   surviving slots) and assert no row is left with a null `variant` post-migration.

10. **Economy-plan coupling — build order matters.** The progression plan (S1–S3) is written
    against 4 per-variant sections and a flat per-board faucet. If someone builds S1 before
    reconciling it to the 2-set + medal model, they build against the wrong shape. *Mitigation:*
    the reshape note now at the top of that plan makes this a hard prerequisite; treat "reconcile
    S1–S3" as a gate, not a follow-up.

11. **Player confusion at the cutover.** Returning users lose the familiar 30-board sectioned
    picker and may ask "where did the Killer daily go?" *Mitigation:* a one-time "the daily
    changed" note in the UI, and lean on free play as the answer for "I just want to play type
    X."

None of these is a blocker, but 5, 6, 8, and 9 are the ones that cause *real breakage* if
skipped — they belong on the implementation checklist, not just this doc.

## 13. Non-goals

- No new puzzle *types* are built here (Nonogram/Solitaire are future pools).
- No realtime/multiplayer.
- Phase 9's shop/friends/battles are untouched; only the *faucet* shape is fixed early.
