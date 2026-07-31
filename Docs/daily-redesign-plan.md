# Daily Restructure — Type-as-Slot (one daily per puzzle type) + Killer 4×4

> **Status:** 🚧 In progress (living document — the canonical plan for this initiative; the
> `~/.claude/plans` scratch file is superseded by this doc). Each **Step** below carries its spec
> *and* its progress/step-log. Shipped so far: the process-rules groundwork (Step 1) and the Killer
> 4×4 easy-only generator (Step 2, engine only). No *daily* code has changed yet — the restructure
> proper begins at **Step 3**, now planned in detail and split into **3a** (migration `0004` — safe,
> standalone) and **3b** (registry reshape + roller + read-path cutover), followed by Step 4 (UI
> polish) and Step 5 (archive X/N).
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
  end-to-end, matching the spike's ~0.04–0.09 ms/attempt) but tiers 4–5 = 0 and tier 2/3 < 3%,
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

### Step 3b — Registry reshape + roller + read-path cutover — ⏳ Not started

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

**Progress —** *(not started)*

### Step 4 — UI polish: section collapse + "Difficulty · Type" labels — ⏳ Not started

**Spec.** (The serve-route `variant` read moved into Step 3b.) Pure presentation:

- **Labels** compose from difficulty + stored `variant` (e.g. "Hard · Killer"): `formatDailyKey`
  (`daily-row.ts`), `DailyExperience.tsx` picker, `LeaderboardView.tsx` tabs + `myBest` rendering.
- **Section collapse** — from four (Classic / Killer / Minis / Keisan) to **Standard** + **Minis**.
- Decide the standard-tab display: all 5 rung tabs vs. only today's 3 populated (archive still needs
  the full set for past days). Update mirrored `.md`s.

**Progress —** *(not started)*

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
