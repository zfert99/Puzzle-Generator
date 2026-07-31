# Daily Restructure — Type-as-Slot (one daily per puzzle type) + Killer 4×4

> **Status:** 🚧 In progress (living document — the canonical plan for this initiative; the
> `~/.claude/plans` scratch file is superseded by this doc). Each **Step** below carries its spec
> *and* its progress/step-log. Only the process-rules groundwork (Step 1) has shipped; no daily
> code changed yet.
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

### Step 2 — Killer 4×4 generator (easy-only) — de-risk ✅ Done · build ⏸ Deferred

**Spec.** Add a `DIFFICULTY_CONFIG_4` for Killer with **`easy` only** in `src/features/engine/killer/`
(alongside the 6×6/9×9 configs in `killer-sudoku.ts`; a new *size*, not a new engine — the exact
solver and `cage-combinations` already support 4-digit grids). Add the `(killer, 4, easy)` profile
row (Step 3's profile table). Mirror the `.md` doc; add generation tests; run `benchmark-killer.ts`.
Killer stays eligible only for the easy-4×4 mini slot and any 6×6 slot (per the model's eligibility).

**Progress — de-risk ✅ Done 2026-07-31; generator build ⏸ deferred (awaiting go-ahead).**

- *Process:* Throwaway spike (4000 attempts × 4 cage-configs) measuring unique-solution yield +
  min-tier grading at 4×4; recorded in
  [killer-4x4-feasibility.md](research/killer-4x4-feasibility.md). Spike deleted (never committed).
- *Learnings:* 4×4 Killer is **easy-only** — cheap/reliable to generate (~0.04–0.09 ms/attempt) but
  tiers 4–5 = 0 and tier 2/3 < 3%, because Killer has no givens (only cage sums) so a 16-cell grid
  collapses to tier-1 logic. Keisan already fills the operations-graded 4×4 niche (easy = `+ − ÷`;
  medium/hard add `×`). → build easy-only + eligibility-constrained roller (folded into the model).
  This *reduced* scope vs. the assumed full 4×4 ladder.
- *Blockers:* The finding contradicted the plan assumption ("build Killer 4×4 → eligible for all 4×4
  mini slots"); surfaced to the owner, who confirmed easy-only before proceeding.

### Step 3 — Migration `0004` + registry reshape + cron roller — ⏳ Not started

**Spec.**

- **Migration `0004`** — add `variant` to `daily_puzzles` (`text`, `'classic'|'killer'|'calc'`) in
  `src/lib/db/schema.ts` + `src/lib/db/migrations/`. **Backfill** from historical keys via
  `getDailyBoard` (every past key → one variant, incl. legacy `'killer'`); assert no null
  post-migration; then `NOT NULL`. Serve reads `variant` from the row (Step 4).
- **Reshape `daily-row.ts`** from one flat `DAILY_BOARDS` into **(a) a slot list** (standard + mini
  slots + eligibility) and **(b) a profile table** keyed on `(variant, size, difficulty)` supplying
  `minSolveMs` + `botTimeMs` (values already exist in current rows — move, don't invent; add
  `(killer,4,easy)`). **CI/test assertion:** every eligible `(variant,size,difficulty)` has a profile
  row (eligibility ⊆ profile coverage).
- **Slot keys / leaderboard identity:** key standard slots by **difficulty rung** (reuse
  `easy…extreme`); mini slots by mini difficulty (e.g. `mini-easy/medium/hard`). "Today's hard
  leaderboard" is one shared board whose *type* varies by day (intentional within-day-only trade).
  **Retire** the now-unused keys (`killer-*`, `calc9-*`, `killer6-*`, `calc4-*`, `calc6-*`,
  `mini4-*`, `mini6-*`) from generation but keep them **readable** for archived rows (the existing
  legacy-`'killer'` pattern). Confirm final key strings at implementation.
- **Cron roller** — `generateDailyPuzzles` (`dailies.service.ts`) rolls the per-day constrained
  assignment over the slot list, generates each, stores with `variant`; `seedBotSolves` → 6 boards.
  Retry + fall back to another eligible option on generator failure (never leave a slot empty; alert
  on fallback). `cron/daily/route.ts` — drop the stale "19 boards" comment; reduce `maxDuration`
  (120 s) if the 6-board run allows.
- **Tests** — update `dailies.service.test.ts`, daily-row tests, any "30"/"19" count assertions →
  slot+profile model + roller (distinct-difficulty invariant, eligibility respected,
  fallback-never-empty) + the profile-coverage assertion. `npx vitest run` green. Mirror the touched
  `.md` docs (`daily-row.md`, `dailies.service.md`, `schema.md`).

**Progress —** *(not started)*

### Step 4 — Serve route + UI labels + section collapse — ⏳ Not started

**Spec.**

- **`src/app/api/daily/route.ts`** — read `variant` from the row (stop deriving from key); size still
  from `grid.length`; cage interpretation keys off stored `variant`. Mirror `route.md`.
- **UI labels** compose from difficulty + `variant` (e.g. "Hard · Killer"): `formatDailyKey`
  (`daily-row.ts`), `DailyExperience.tsx` picker/sections, `LeaderboardView.tsx` tabs. Sections
  collapse from four (Classic/Killer/Minis/Keisan) to **Standard** + **Minis**. Update mirrored
  `.md`s.

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
   ([/api/me/bests](../src/app/api/me/bests/route.ts)) blend old classic-only with mixed future.
   Mitigation: scope cross-date bests by stored `variant`, or segment at the cutover date — decide
   before migration `0004`.
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
