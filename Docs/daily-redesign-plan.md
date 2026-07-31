# Daily Restructure — Type-as-Slot (one daily per puzzle type) + Killer 4×4

> **Status:** 🚧 In progress (living document — the canonical plan for this initiative; the
> `~/.claude/plans` scratch file is superseded by this doc). Each **Step** below carries its spec
> *and* its progress/step-log. **The restructure is live:** Step 1 (process rules), Step 2 (Killer
> 4×4 generator), Step 3a (migration `0004` — stored `variant`), and Step 3b (registry reshape +
> cron roller + read-path cutover + the functional picker/tabs) are all done — `/daily` now rolls
> **6 boards/day** (3 standard + 3 mini) instead of 30. Remaining: Step 4 (UI polish — most of it
> landed early with 3b) and Step 5 (archive X/N counts).
>
> **This supersedes the earlier "11-slot random-type ladder + medals" design.** That model fixed a
> *difficulty* ladder and rolled *type* per slot; the owner chose the **inverse, simpler** model
> (fix the *type* per slot, randomize the *difficulty*). The infra that survives unchanged (stored
> `variant` column, registry → slot-list + profile-table, retire old keys read-only, medal/economy
> hooks) is carried forward; the prior version's risk analysis is preserved in §Risks.

This doc is a self-contained handoff: read it cold and you have the full background, the model, the
locked decisions, every step (with spec + progress), the risks, and the verification plan needed to
continue.

## Why (background & required knowledge)

- **The problem:** `/daily` grew into a **30-board wall** (`DAILY_BOARDS` in
  [daily-row.ts](../src/lib/db/daily-row.ts)): classic 9×9 ×5, Killer 9×9 ×5, 15 minis, Keisan 9×9
  ×5. Every night the cron generates all 30 (incl. the slow Extreme tiers); with a small player
  base most of those 30 leaderboards sit empty. A daily should be a **ritual with a clear win
  condition**, not a 30-item menu. (Docs/cron still say "19" in places — stale, predates the Keisan
  ladder; fixing those strings is part of this work.)
- **The two related asks** (this initiative): (1) a **pre-merge workflow rule** so every PR passes a
  repeatable gate, and (2) the **daily restructure** that shrinks the wall and generalizes it so the
  next two puzzle types plug in with no daily-system surgery.
- **How the daily works today** (accurate as of this plan):
  - **Precomputed & stored, not seeded-PRNG.** Vercel Cron hits `GET /api/cron/daily` at 00:00
    UTC; `generateDailyPuzzles` ([dailies.service.ts](../src/features/dailies/dailies.service.ts))
    maps `DAILY_BOARDS`, dispatches by `board.variant`, bulk-inserts to Neon/Drizzle
    `daily_puzzles`. Idempotent on `UNIQUE(date, difficulty)` + `onConflictDoNothing`. **The stored
    row is the single source of truth** — every player reads the same row.
  - **The registry key IS the identity.** `daily_puzzles.difficulty` stores the board `key` (e.g.
    `killer-expert`), doubling as API param, leaderboard key, and idempotency handle. **The key
    currently encodes the puzzle type** — the single biggest thing this restructure changes.
  - **Variant is derived from the key**, not stored: the serve route
    ([daily/route.ts](../src/app/api/daily/route.ts)) looks type up via `getDailyBoard(key)`; grid
    size from `grid.length`; cage interpretation (Killer sum vs. Keisan op+target) keys off the
    variant.
  - **Per-board tuning in the registry:** `minSolveMs` (anti-cheat floor) + `botTimeMs` (Sudoku
    Bot's beatable time), keyed per board.
  - **Completion & leaderboard:** `solve_attempts` (one ranked attempt per user per puzzle);
    leaderboard is already **same-day-only** (`/api/solve` hardcodes today's UTC date). Medals /
    gold-days / badges are **designed but unbuilt**
    ([social-progression-economy-plan.md](social-progression-economy-plan.md)).
- **Types today:** `classic` (Sudoku), `killer` (sums), `calc` (Keisan / Calcudoku, operator
  cages). Engines in `src/features/engine/{sudoku.ts, killer/, calc/}`. All three grade the full
  9×9 ladder; at small sizes they differ (see Step 2 and
  [killer-4x4-feasibility.md](research/killer-4x4-feasibility.md)).

## The model — type-as-slot

**One daily slot per puzzle TYPE; the DIFFICULTY is the randomized axis.** N types → N standard
slots + N mini slots. **Interim now (3 types): 3 standard + 3 mini = 6 boards/day** (down from 30);
end state (5 types): 5 + 5 = 10.

- **Standard set (9×9):** one slot per type (`classic`, `killer`, `calc`). Each day, draw **3
  distinct** difficulties from `{easy, medium, hard, expert, extreme}` and assign one to each type
  (a random *injection*; a full 5-rung *bijection* once 5 types exist). Every type supports the full
  9×9 ladder → no eligibility gaps.
- **Mini set:** one slot per type. Difficulties from **`{easy, medium, hard}` only** (no
  expert/extreme minis). **Size follows difficulty:** easy → 4×4, medium → 4×4, hard →
  random(4×4/6×6). **Eligibility** (respected by the roller): `classic`/`calc` ∈ all 4×4 e/m/h + all
  6×6 e/m/h; `killer` ∈ easy-4×4 **only** (Killer 4×4 is easy-only — Step 2) + any 6×6 slot. A valid
  type→slot matching always exists (classic/Keisan cover medium/hard-4×4).
- **No anti-monotony cap** — one-slot-per-type makes types distinct by construction (drops the old
  plan's cap-3 machinery).
- **Selection = constrained roll at cron time.** The stored row is the source of truth, so the cron
  rolls a valid assignment, generates, stores — no date-seeded PRNG. It must **retry, then fall back
  to another eligible (type/difficulty/size)** on generator failure so a slot is never empty.

## Locked decisions (2026-07-31, with owner)

- **Standard:** 3 distinct types × 3 distinct random difficulties (of 5), 9×9. Scales to a 5-rung
  bijection at 5 types.
- **Minis:** 3-tier only (e/m/h). Size: easy/medium = 4×4, hard = random(4×4/6×6).
- **Killer 4×4 = easy-only** (de-risked — [feasibility doc](research/killer-4x4-feasibility.md)); the
  operations-graded arithmetic 4×4 niche is already covered by Keisan.
- **Archive:** ship **per-day completion counts (X/N) only**. Post-day completable badges, day-of
  gold "star", and unranked past-day completion tracking are **deferred to Phase 9** (already
  designed in the economy plan). Leaderboard stays same-day-only (already true).
- **Code-review rule:** documented checklist + existing skills (shipped in Step 1).

---

## Steps

Each step is its own PR, gated by the AGENTS.md Pre-Merge / Pre-PR Checklist. Spec + progress live
together under each step. Status key: ✅ done · 🚧 in progress · ⏳ not started · ⏸ deferred.

### Step 1 — Process rules (pre-merge / living-docs / devlog) — ✅ Done (PR #42)

**Spec.** Add three top-level rule sections to `AGENTS.md` (BEGIN/END fenced), + Update Log entry:

- **Pre-Merge / Pre-PR Checklist** — one ordered gate, shaped by
  [solo-dev-ai-qa-code-review-playbook.md](research/solo-dev-ai-qa-code-review-playbook.md): (1)
  keep the slice small (< ~400 LOC); (2) doc audit in the same PR (mirrored `.md` per touched
  `.ts`/`.tsx`, roadmap + README status, **the living plan doc's step-log**, `Docs/research/*`
  roadblock records, markdownlint); (3) benchmarks + tests (engine benchmarks when core solving
  logic changed; always `npx vitest run` + `npm run lint`); (4) code review = judgment not
  defect-hunting (authz, economy invariants, AI-logic re-derivation, migration safety; run
  `/code-review` and `/security-review`; verify new packages exist; authorize → validate (Zod) →
  mutate); (5) merge
  only when 1–4 + CI green.
- **Living Planning Docs Rules** — planning/impl docs are repo-resident, self-contained handoff docs:
  background + research links up front, a numbered step list with a step-log (process / learnings /
  blockers) appended per completed step. Folded into the pre-PR doc audit.
- **Build Log (Devlog) Rule** — ship something big → write a narrative devlog to the `Biscuit-Website`
  repo (biscuitlab.net) at `/log` (`src/content/log/<slug>.mdx`). Show-don't-announce,
  story-not-changelog, GIFs/numbers, weekly-to-biweekly, lightweight. Evidence:
  [devlog-blog-portfolio-strategy.md](research/devlog-blog-portfolio-strategy.md).
- Import both research docs; add a **"Solo-dev QA hardening (Stage 1–3)"** roadmap backlog entry (the
  deferred *physical*-gate work: PR template + branch protection, AI reviewer, axe/Lighthouse CI, Zod
  authorize→validate→mutate + idempotency/rate-limit on economy endpoints, fast-check property tests,
  Stryker mutation testing, gitleaks).

**Progress — ✅ Done 2026-07-31 (commit `63a09ba`, [PR #42](https://github.com/zfert99/Puzzle-Generator/pull/42)).**

- *Process:* All three AGENTS.md rules + Update Log entry; imported both research docs; added the
  roadmap backlog entry. Docs-only, markdownlint clean.
- *Learnings:* The QA playbook reframed the gate — push defect-finding onto tests/types/automation,
  reserve the human pass for authz / economy invariants / AI-logic verification / migration safety.
  The *physical* gate is higher-value-but-deferred → recorded in the roadmap, not built now.
- *Blockers:* Two `markdownlint` MD037 false-positives from bold `$`-amounts on wrapped lines →
  resolved by unbolding those amounts.

### Step 2 — Killer 4×4 generator (easy-only) — de-risk ✅ Done · build ✅ Done

**Spec.** Add a `DIFFICULTY_CONFIG_4` for Killer with **`easy` only** in `src/features/engine/killer/`
(alongside the 6×6/9×9 configs in `killer-sudoku.ts`; a new *size*, not a new engine — the exact
solver and `cage-combinations` already support 4-digit grids). Add the `(killer, 4, easy)` profile
row (Step 3's profile table). Mirror the `.md` doc; add generation tests; run `benchmark-killer.ts`.
Killer stays eligible only for the easy-4×4 mini slot and any 6×6 slot (per the model's eligibility).

**Progress — de-risk ✅ Done 2026-07-31; generator build ✅ Done 2026-07-31.**

- *Process (de-risk):* Throwaway spike (4000 attempts × 4 cage-configs) measuring unique-solution
  yield + min-tier grading at 4×4; recorded in
  [killer-4x4-feasibility.md](research/killer-4x4-feasibility.md). Spike deleted (never committed).
- *Process (build):* Added `DIFFICULTY_CONFIG_4 = { easy: { solveCap: 2, minSize: 1, maxSize: 3,
  maxSingles: 8 } }` and wired size `4` into `DIFFICULTY_CONFIGS`; widened `KillerGenOptions.gridSize`
  and `generateKillerBatch` to `4 | 6 | 9` (batch ladder now a per-size `LADDERS` table: 4×4 = easy
  only). Added two tests (4×4 easy: 16 cells covered, unique, no givens, tier-capped; medium/hard/
  expert/extreme at 4×4 throw `not available at 4×4`) — all 22 killer-sudoku tests green. Added a 4×4
  Easy benchmark row; mirrored `killer-sudoku.md` + `benchmark-killer.md`. **The `(killer,4,easy)`
  profile row is deferred to Step 3**, where the profile table is actually created (it doesn't exist
  yet).
- *Learnings:* 4×4 Killer is **easy-only** — cheap/reliable to generate (measured **0.15 ms/puzzle**
  end-to-end, matching the spike's ~0.04–0.09 ms/attempt) but tier 2/3 < 3% (tiers 4–5 are *not*
  evidence — the solver gates them to 9×9, so they were never attempted; see the correction in the
  feasibility doc),
  because Killer has no givens (only cage sums) so a 16-cell grid collapses to tier-1 logic. Keisan
  already fills the operations-graded 4×4 niche (easy = `+ − ÷`; medium/hard add `×`). No `scoreBand`
  needed — easy-only has no adjacent tier to stay disjoint from. This *reduced* scope vs. the assumed
  full 4×4 ladder.
- *Blockers:* The de-risk finding contradicted the plan assumption ("build Killer 4×4 → eligible for
  all 4×4 mini slots"); surfaced to the owner, who confirmed easy-only before proceeding. No blockers
  in the build.

> **Step 3 was planned in detail on 2026-07-31 (with owner) and split into 3a + 3b.** A ripple-map
> pass (an `Explore` agent inventoried every consumer of the daily key/section shape) surfaced that
> the *read* paths — the serve route, the solve-time floor, and the bot-seed — all infer the puzzle
> *type from the key today* (`getDailyBoard(key).variant`, `MIN_SOLVE_MS[key]`, `botTimeByKey[key]`).
> The moment the roller writes a rung-keyed row whose type is rolled, those readers misread it
> (wrong cage interpretation, wrong/`undefined` plausibility floor, wrong bot time). So the
> read-path cutover **cannot lag into Step 4** — it rides with the roller in 3b. The **migration is
> cleanly separable and lands first (3a)** to de-risk the backfill in isolation. Owner decisions
> (2026-07-31): (1) peel migration into its own PR (3a→3b); (2) variant-scope cross-date bests
> (Risk #4). Read-path/consumer inventory lives in the ripple map; the affected files are named per
> sub-step below.

### Step 3a — Migration `0004` (add + backfill `variant`) — ✅ Done (committed, PR open)

**Spec.** Safe and standalone: add the stored `variant` column and start *writing* it, while nothing
*reads* it yet — so the cron keeps producing the same 30 rows and behavior is unchanged. Lands before
3b to de-risk the backfill (Risk #3) on its own.

- **`schema.ts`** — add `variant: text('variant').$type<'classic' | 'killer' | 'calc'>().notNull()`
  to `daily_puzzles`. Fix the now-stale column comments (the `difficulty` comment still lists only
  `easy|…|extreme`; the `cages` comment still claims the Killer key is the literal `'killer'`).
- **Migration `0004`** — **hand-authored** (drizzle would emit a bare `ADD COLUMN … NOT NULL` that
  fails on existing rows — the "read the generated SQL by hand" case). Run `db:generate` to produce
  the file + snapshot + journal entry, then replace the SQL body with the additive sequence:

  ```sql
  ALTER TABLE "daily_puzzles" ADD COLUMN "variant" text;
  UPDATE "daily_puzzles" SET "variant" = 'classic'
    WHERE "variant" IS NULL
      AND ("difficulty" IN ('easy','medium','hard','expert','extreme') OR "difficulty" LIKE 'mini%');
  UPDATE "daily_puzzles" SET "variant" = 'killer'
    WHERE "variant" IS NULL AND ("difficulty" = 'killer' OR "difficulty" LIKE 'killer%');
  UPDATE "daily_puzzles" SET "variant" = 'calc'
    WHERE "variant" IS NULL AND "difficulty" LIKE 'calc%';
  ALTER TABLE "daily_puzzles" ALTER COLUMN "variant" SET NOT NULL;
  ```

  The closing `SET NOT NULL` **is** the "assert no null post-migration" gate — any historical key
  that escapes every pattern leaves a NULL and aborts the migration. Additive-only (no destructive
  change → no reverse-SQL/backup needed), but dry-run on a Neon branch first.
- **`toDailyPuzzleRow`** — emit `variant` derived from the puzzle, not the registry:
  `const variant = 'variant' in puzzle ? puzzle.variant : 'classic'` (`NewDailyPuzzle` picks up the
  column automatically). Registry stays the 30-board array; nothing reads `variant` yet →
  backward-compatible.
- **Tests + docs** — `daily-row.test.ts`: `toDailyPuzzleRow` sets the right `variant` for classic /
  killer / calc. Mirror `schema.md` + `daily-row.md`. `npx vitest run` + lint + markdownlint.

**Progress — ✅ Done 2026-07-31 (branch `feat/daily-restructure-step3`, commit `9ed2404`).**

- *Process:* Added `variant text NOT NULL` to `schema.ts`; declared it, ran `db:generate` (emitted the
  unsafe bare `ADD COLUMN … NOT NULL`), then **hand-authored** `0004_safe_pyro.sql` to the safe
  add-nullable → backfill (classic / killer / calc by key pattern) → `SET NOT NULL` sequence, keeping
  drizzle's snapshot + journal (which already encode the final NOT NULL state). `toDailyPuzzleRow`
  now emits `variant` from the puzzle. Full suite 355 green, `npm run build` clean (caught nothing
  this time, but run regardless — eslint doesn't type-check), lint + markdownlint clean. Docs:
  `schema.md`, `daily-row.md`.
- *Learnings:* `drizzle-kit generate` runs offline and does **not** prompt on a NOT-NULL add — it
  just emits the naive (unsafe-on-existing-rows) SQL, so the hand-edit is mandatory and the
  snapshot/journal it writes are still correct to keep. The `SET NOT NULL` at the end *is* the
  no-null assertion (Risk #3) — no separate `RAISE` block needed.
- *Blockers / open:* The migration is **committed but not applied** — `db:migrate` runs under the
  privileged DB role; dry-run on a Neon branch before prod. `variant` has no reader until 3b, so
  applying it early is harmless.

### Step 3b — Registry reshape + roller + read-path cutover — ✅ Done

**Spec.** The atomic flip to type-as-slot. Because the roller writes rung-keyed rows whose *type*
varies, every reader that infers type from the key switches to the stored `variant` + profile table
**in this same PR** (serve route, solve floor, bot seed). Larger than the ~400-LOC target and
accepted as such — the cutover can't be half-shipped without a broken daily; the bulk is the roller +
its tests (low-risk LOC). Files/lines per the ripple map.

- **`daily-row.ts` reshape:**
  - **Slot list** — 5 standard slots keyed by rung (`easy…extreme`, reusing classic keys; 3 of 5
    populated/day) + 3 mini slots keyed `mini-easy` / `mini-medium` / `mini-hard`. A slot carries
    `key`, kind (`standard` | `mini`), and (minis) its fixed difficulty.
  - **Profile table** — `PROFILE[(variant,size,difficulty)] → { minSolveMs, botTimeMs }`, values
    **moved verbatim** from the 30 current rows + the new `(killer,4,easy)` = **31 entries**.
    `getProfile(variant,size,difficulty)`.
  - **Eligibility** — `eligible(variant,size,difficulty)`: standard = 3 types × 9 × 5 rungs; minis:
    classic/calc ∈ {4,6}×{e,m,h}, killer ∈ {(4,easy)} ∪ {6}×{e,m,h}.
  - **Keys** — `isDailyDifficulty` accepts the new slot keys **and** all legacy keys (`killer-*`,
    `calc*`, `mini4-*`, `mini6-*`, `killer6-*`, legacy `killer`) for archive replay (keep a
    `LEGACY_KEYS` set). `formatDailyKey` stays non-broken for both (the "Difficulty · Type" polish is
    Step 4).
  - **CI coverage assertion** — a test iterating the eligible set asserts `getProfile` returns a row
    for each (eligibility ⊆ coverage — Risk #1).
- **`dailies.service.ts` roller (`generateDailyPuzzles`, injectable `rng` for deterministic tests):**
  - **Standard** — shuffle `{easy,medium,hard,expert,extreme}`, take 3; pair each with a distinct
    type (all types cover 9×9 → no eligibility constraint). Store `key = rung`, `variant = type`,
    `size = 9`.
  - **Minis** — enumerate every valid `(type→slot permutation × hard-slot size ∈ {4,6})` filtered by
    `eligible`, pick one uniformly. Guarantees killer lands only on easy-4×4 or a 6×6 hard slot; a
    valid config always exists (classic/calc cover medium/hard-4×4). Store `key = mini-<diff>`,
    `variant = type`, `size = rolled`.
  - **Generate + fallback** — per slot: generate; on throw, bounded retry, then fall back to another
    `eligible` option not colliding with placed slots; `logger.warn` on fallback (Risk #2 — never
    empty). Realistically only the slow extreme tiers are at risk (timeout, not throw).
  - **`seedBotSolves`** — SELECT today's rows (`id`, key, `variant`, `grid`); derive `size =
    grid.length`, `difficulty = key` (standard) or `key.slice(5)` (mini) → `getProfile(...).botTimeMs`.
    Drop `botTimeByKey`.
  - Result count = **6** (3 standard + 3 mini).
- **Read-path cutover (rides with the roller):**
  - **Serve** `daily/route.ts` — read `variant` from the row; drop the `getDailyBoard(key).variant`
    inference. Size still from `grid.length`.
  - **Solve floor** `solve-rules.ts` / `solve.service.ts` — `isImplausiblyFast` takes the puzzle's
    `(variant,size,difficulty)` → `getProfile(...).minSolveMs` (the solve route already fetches the
    row, so it has `variant` + `grid`). Retire the `MIN_SOLVE_MS` key-map (keep the legacy `killer`
    floor only if an archived-key path still needs it).
  - **Bot seed** — via profile (above).
- **`cron/daily/route.ts`** — drop the stale "19 boards" comment; `maxDuration 120 → 60` (worst case
  ≈ one Killer-extreme ~5.5 s + fast minis).
- **Picker / leaderboard tabs (functional only)** — `DailyExperience.tsx` + `LeaderboardView.tsx`
  iterate `DAILY_BOARDS` by `section` (30 pills) today; point them at the slot list so the daily shows
  the 6 real slots and the leaderboard exposes rung + mini tabs. Section-collapse to **Standard +
  Minis** and "Difficulty · Type" labels are the Step 4 polish.
- **Bests (Risk #4 — resolved: variant-scope)** — `getPersonalBests` → `GROUP BY (difficulty,
  variant)`; update `PersonalBest` + its `LeaderboardView` consumer to the `(rung, variant)` shape.
- **Tests** — rewrite `daily-row.test.ts` (slot list + profile coverage + eligibility + key validity
  incl. legacy), `dailies.service.test.ts` (roller: distinct standard rungs, mini eligibility,
  fallback-never-empty, 6 rows, bot seed via profile — inject RNG), `solve/route.test.ts` (new slot
  keys + profile floors), `attempts.service.test.ts` (variant-scoped bests). Mirror `daily-row.md`,
  `dailies.service.md`, `route.md`, `solve-rules.md`. `npx vitest run` + lint + markdownlint;
  no benchmark (no core-solver change).

**Progress — ✅ Done 2026-07-31 (branch `feat/daily-restructure-step3b`).**

- *Process:* Rewrote `daily-row.ts` to slots + `PROFILE` (31 rows) + `isEligible` + a pure
  `rollDailyAssignment(rng)`; built the roller into `generateDailyPuzzles` with a retry→fallback that
  can never leave a slot empty; cut the three readers over to the stored `variant` (serve route,
  `isImplausiblyFast`, bot-seed) plus variant-scoped `getPersonalBests`; added **`GET
  /api/daily/slots`** + a shared `slotLabel` so the picker and leaderboard tabs render the day's real
  boards as "Difficulty · Type"; `maxDuration` 120→60. Tests rewritten across five files (367 green);
  build + lint + markdownlint clean.
- *Learnings:*
  - **Two injectable seams beat mocking.** The roll takes an `rng` and the service takes a `generate`
    seam, so the roller's orchestration/fallback is tested for real in **~1.5 s** instead of paying
    real generation (the old service test spent ~60 s regenerating 30 boards, incl. a ~5.5 s
    Killer-extreme). Mocks stay at the boundary (DB + engine), per AGENTS.md §4.
  - **Enumerate-then-filter, not roll-and-retry,** for the mini assignment: build every
    `(type→slot permutation × hard-slot size)` and keep the `isEligible` ones, then pick uniformly.
    Killer-4×4-easy-only falls out for free — no retry loop, no possibility of an invalid roll.
  - **Verified end-to-end against the real engines + DB** with `npm run db:seed`: the roll produced
    `mini-easy`→Keisan 4×4, `mini-medium`→Classic 4×4, `mini-hard`→**Killer 6×6** — Killer correctly
    avoided the ineligible hard-4×4 and took the 6×6 slot.
  - **The cutover date is a visible one-day artifact:** that date already held 30 old-registry rows,
    so the 3 rolled standard rungs collided (`onConflictDoNothing`) and only the 3 new `mini-*` slots
    inserted — it now shows 33 boards. That's correct idempotency (first-write-wins, so no player's
    board changes under them) and it self-heals on the next fresh date; archived dates intentionally
    keep showing the boards they really had.
  - A stale `solve-rules.test.ts` still called the old `isImplausiblyFast(key, ms)` — it wasn't in
    the ripple map (which had focused on key/section consumers) and was caught only by the **full**
    suite, not by lint or the targeted runs. Full-suite runs stay the backstop for signature changes.
  - **The pre-merge judgment pass caught a real anti-cheat hole** (exactly the "AI logic is
    plausible-but-wrong" case the checklist targets). The first `difficultyForKey` only stripped a
    `mini-` prefix, so every *retired* key (`killer-extreme`, `calc9-expert`, …) resolved to no rung
    → no profile → the permissive 3 s default floor. Retired keys are still solvable **on the
    cutover date** (that day holds old and new rows), so a `killer-extreme` solve would have been
    validated against 3 s instead of 60 s. Fixed by resolving the rung from any key shape, with
    legacy `killer` → `medium` (which reproduces its historical 30 s floor exactly); locked in with
    regression tests asserting every retired key still gets a real profile floor.
  - **A second bug surfaced only by running the app** (dev server, per the visual-check rule): the
    slots endpoint derived `section` from the `mini-` key prefix, so every *retired* mini
    (`mini4-*`, `killer6-*`, `calc4-*`) was filed under **Standard** — and since `slotLabel` shows a
    board's size only for minis, the picker rendered a wall of indistinguishable "Medium · Classic"
    pills. **Not** a cutover-only artifact: archived dates are the permanent case. Fixed by keying
    section off the grid size (mini ⟺ < 9×9), which is correct for active and retired keys alike;
    covered by a new `slots/route.test.ts`. Tests + types were both green *before* this was found —
    a reminder that rendering-shaped bugs need the running app, not just the suite.
- *Blockers:* None. The slice exceeds the ~400-LOC target, as the spec anticipated — the read-path
  cutover can't be split from the roller without shipping a broken daily.
- *Verified in the running app (owner to confirm visuals):* `/daily`, `/leaderboard` and `/archive`
  all render the two-section layout with unambiguous "Difficulty · Type" labels and no console
  errors; the leaderboard's bot time read **3:30 = 210 000 ms**, exactly `classic-9-easy`'s
  `botTimeMs` — end-to-end proof the profile-driven bot seeding is keyed correctly.

### Step 4 — UI polish: section collapse + "Difficulty · Type" labels — ⏳ Mostly landed in 3b

**Spec.** (The serve-route `variant` read moved into Step 3b.) Pure presentation — and most of it
**shipped early in 3b**, because the picker/tabs could not stay functional on the old
`DAILY_BOARDS`-by-section rendering once the roll went live:

- ✅ **Labels** compose from difficulty + stored `variant` ("Hard · Killer") via the shared
  `slotLabel` (`features/dailies/slot-display.ts`), used by both the picker and the leaderboard tabs.
- ✅ **Section collapse** — four sections (Classic / Killer / Minis / Keisan) → **Standard** +
  **Minis**, driven by `GET /api/daily/slots`.
- ✅ **Standard-tab display decided:** show only the day's *populated* slots (3 of 5 rungs), since
  the tabs are now built from the day's real rows — which also makes the archive correct for free
  (a past date lists exactly the boards it had, retired keys included).

**Remaining (true polish, not blocking):** visual pass on the new two-section picker at desktop
width (the panel was sized for four chip rows); a one-time "the daily changed" note for returning
players (Risk #5); and deciding whether the Continue banner should show the composed label (it
currently falls back to `formatDailyKey`, since a saved key carries no variant context).

**Progress —** *(core landed with 3b; polish not started)*

### Step 5 — Archive completion counts (X/N) — ⏳ Not started

**Spec.** Archive shows **X/N completed** per day for the Standard set and the Mini set (N = that
day's slot count — 3 now, 5 later; dynamic denominator, which the economy plan's S3 per-date snapshot
anticipates). Source completions from the existing `getTodayCompletions` / attempts services; **no
new badge/star/economy state.** `ArchiveExperience.tsx`, `Calendar.tsx`. Update mirrored `.md`s.

**Progress —** *(not started)*

---

## Risks (re-cast from the prior plan; the ones that cause real breakage if skipped)

1. **Profile coverage** must cover every *eligible* `(variant, size, difficulty)` — a missing entry
   breaks solve validation for a rolled slot. Mitigation: the CI coverage assertion (Step 3).
2. **A flaky/slow generator roll must never leave a slot blank.** Mitigation: cron retries, then
   falls back to another eligible option; alert on fallback (Step 3).
3. **`variant` backfill must be exhaustive** over every historical key (incl. retired `killer-*`/
   `calc*` and legacy `'killer'`) or archive replay can't interpret cages. Mitigation: build the
   backfill map from the full historical key set; assert no null post-migration (Step 3).
4. **Historical key reuse fractures cross-date aggregates** — `easy…extreme` meant classic Sudoku
   before, mixed type after. Same-day boards fine; cross-date all-time bests
   ([/api/me/bests](../src/app/api/me/bests/route.ts)) would blend old classic-only with mixed
   future. **Resolved (2026-07-31, owner): variant-scope** — `getPersonalBests` groups by
   `(difficulty, variant)` (Step 3b), which the stored `variant` column enables. This keeps bests
   type-attributable and stays correct at the 5-type end state; the rejected alternative
   (segment-at-cutover-date) needed a magic date constant and still blended types within a segment.
   The same `(key, variant)` shape is the safe default for any other cross-date aggregate;
   `getTodayCompletions` is single-date (low risk) and `getCurrentStreak` is key-agnostic (safe).
5. **Product trade (accepted):** less per-type daily choice + noisier within-day leaderboards. Free
   play (`/play`) still offers any type/size/difficulty (unranked); a one-time "the daily changed"
   note softens the cutover.

## Ripple effects to reconcile

- **Economy plan** ([social-progression-economy-plan.md](social-progression-economy-plan.md)): its 4
  per-variant sections collapse to **two sets** (standard, minis) + `overall`. Streak scopes,
  gold-day denominators, and the payout table re-key onto this. (Medals deferred here — only the set
  shape matters now.)
- **Leaderboard identity:** a slot's type varies by day, so a board is meaningful **within a day** —
  concentrates the small player base onto 6 stable boards (→ 10 at 5 types) instead of 30. Streaks +
  future medals become the cross-day progression.
- **Seed script** ([seed.ts](../src/lib/db/seed.ts)) shares the service; update its
  expectations/tests.

## Open scaling question (not a blocker for 3+3)

At 5 types, **minis are only 3-tier**, so 5 mini slots can't map 1:1 to 3 difficulties. Resolve when
the 4th/5th type lands — options: expand mini tiers, allow mini-difficulty repeats, or fewer mini
slots than standard. The 3+3 interim maps cleanly (3 types ↔ 3 mini tiers).

## Verification (end-to-end, once Steps 3–5 land)

- **Unit/integration:** `npx vitest run` — updated daily-service / daily-row / killer tests + the
  profile-coverage assertion all green.
- **Benchmarks:** `benchmark-killer.ts` for Killer 4×4; core-solver benchmark if `HumanSolver`
  touched — review `benchmark-logs.md` against tier targets.
- **Cron/generation locally:** `npm run db:seed` (or hit the cron route) and confirm exactly **6
  rows** for the day (3 standard distinct difficulties + 3 minis with correct size-by-difficulty),
  each with a non-null `variant`, no empty slot.
- **End-to-end in the app:** `/daily` shows Standard (3) + Minis (3) with "Difficulty · Type" labels;
  `/leaderboard` tabs resolve per rung; `/archive` shows **X/N** counts per day and past days still
  replay (retired keys readable). Backfill sanity: an old 30-board date still renders.
- **CI:** lint, markdownlint, `npm test`, `npm audit --omit=dev`, CodeQL green before each merge.

## Non-goals

- No new puzzle *types* built here (types 4–5 register into these pools later).
- No medals / gold-days / crumbs economy (Phase 9); only the two-set shape is fixed early.
- No realtime/multiplayer.
