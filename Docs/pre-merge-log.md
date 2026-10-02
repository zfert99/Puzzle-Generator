# Pre-Merge Log

One entry per `/pre-merge` run. **Newest first** — the entry you want is almost always the top one.

**Rotation.** Runs older than the current month move verbatim to
`archive/pre-merge-log-<yyyy-mm>.md` once this file gets long (it passed 2,500 lines in September
2026). The **Known flaky tests** table and the **Standing lessons** digest stay here; an archive
holds the runs themselves. Rotated so far: [August 2026](archive/pre-merge-log-2026-08.md).

## Why this log exists

The gate's output used to live only in a chat transcript, which meant every run re-derived what the
last one already knew. Two concrete costs, both paid on the Step 5 run of 2026-08-03 (now in the [August 2026 archive](archive/pre-merge-log-2026-08.md)):

- **Flake attribution is expensive and repeatable.** Deciding that one red test was *pre-existing*
  and not caused by the diff took ~18 full-suite runs plus isolated timing. That answer is worth
  keeping; the next person to see the same red test should read it here, not re-earn it. Hence the
  standing **Known flaky tests** section.
- **The generalizable lesson outlives the PR.** "A call-history assertion in a file with no
  `mockClear` is presumed vacuous until a deliberately-broken run proves otherwise" came out of one
  step's review pass and would otherwise have been buried in that step's step-log.

This is a log, not a ceremony. Keep entries short: a finding fixed inside the same PR gets one line,
not an essay. The durable value is in **Findings**, **Known flaky tests**, and anything that
required real work to establish — not in restating that lint passed.

## Known flaky tests

Check here before spending runs on attribution. A test listed here failing does **not** implicate
the diff under review.

| Test | Symptom | Status |
|---|---|---|
| Playwright e2e, any spec, under `fullyParallel` | A single test times out in roughly **1 run in 8** against a production build; against `next dev` it was **2 runs in 3** (measured 38/38, 35/38, 37/38). Every failure observed passed **5/5 in isolation**. Cause is server contention, not the assertions — `next dev` compiles routes on demand and parallel workers hit cold routes at once. | **Mitigated 2026-08-07.** CI now builds once and runs `next start` (`playwright.config.ts`), cutting it from ~67% to ~12% of runs; the pre-existing `retries: 2` absorbs the remainder. A red e2e test that passes solo is this, not your diff — confirm with `npx playwright test <file> -g "<title>"` before investigating further. |
| `src/features/engine/calc/calc-sudoku.test.ts` → `generateCalcSudoku > "hard leans on × …"` | Times out (`Test timed out in 5000ms`) in ~10–15% of **full-suite** runs. Solo: 261/453/640 ms. Under parallel load: measured **5738 ms** against Vitest's then-default 5000 ms. Cause was worker CPU contention against real randomized generation, not the assertions. | **✅ Resolved 2026-08-04** (`fix/keisan-test-flake`). Kept here because branches cut before that fix still hit it. Established 2026-08-03 over ~18 full-suite runs; root-caused and fixed the next day — see the 2026-08-04 entry in the [August 2026 archive](archive/pre-merge-log-2026-08.md), which found **three** distinct causes under this one test name. |

## Standing lessons (apply next run)

Rules distilled from earlier entries so they survive rotation. Each is phrased as something the next
run can check, not as the story that produced it; the story is in the dated entry (August 2026 ones
are in [archive/pre-merge-log-2026-08.md](archive/pre-merge-log-2026-08.md)).

- **A call-history assertion in a file with no `mockClear` is presumed vacuous** until a
  deliberately-broken run proves otherwise. *(08-03)*
- **Assert a break test actually broke something** before trusting the verdict on it — a no-op
  break manufactures confidence. Generalises the rule above to any guard. *(08-07)*
- **A test that cannot fail is worse than no test** — delete it rather than keep it green; a claim
  tested only on the happy path is not tested. *(08-07)*
- **Finish the ask, state what else is outstanding once, and stop.** Trailing "I can also…" offers
  turned a two-line doc fix into ~250 changed lines. *(08-07)*
- **An "empty" worktree branch can still carry finished work** — `git -C <worktree> status` before
  writing one off; commit a finished slice even if it never gets pushed. *(08-07)*
- **Gate a test on the condition it needs, not a proxy.** "A database is configured" is not "today
  has boards"; they diverged the first morning the roller was late. *(08-07)*
- **Enumerate every settled outcome of a request** — "not yet", "none", and "failed" are three
  states; a bare `.catch(() => {})` collapses the third into the first. *(08-07)*
- **Hardcoded initial state becomes a bug the moment it feeds an href.** *(08-07)*
- **A readiness probe that never succeeds looks like a suite with no tests** — assert the landing
  response is 200. "0 tests ran" and "all passed" are one glance apart. *(08-07)*
- **`reuseExistingServer` matches on port, not commit** — give a suite its own port (`E2E_PORT`)
  whenever another server might be up. *(08-07)*
- **A test runner does not see the app's `.env.local`** — a `process.env`-gated skip silently
  over-skips, and a skip reports as success. *(08-07)*
- **A module-scope throw in a rarely-hit route fails `next build`, not `next dev`** — re-measure any
  "works without X" claim under a build before it goes in CI. *(08-07)*
- **Prefer a production build for parallel e2e** — `next dev` compiles on demand, and cold routes
  under parallel workers produce timeouts that read as assertion failures. *(08-07)*
- **A red `npm audit` on a branch that touched no dependencies is a new advisory** — check the
  advisory's version range against the existing semver range before adding an `overrides` entry.
  *(08-07)*
- **A gate that enumerates its own targets silently excludes anything new** — question any
  allowlist-shaped check. *(08-07)*
- **A `.md` cited by committed code must be tracked in the same commit** — grep the diff for
  `Docs/….md` and confirm each hit is in git. *(08-07)*
- **"Committed" is not "verified"** — say in the commit message which assertions actually ran.
  *(08-07)*
- **A scheduler that can fail silently needs an assertion on its outcome, not a status code.**
  *(08-07)*
- **When you close a security gap, audit what was reaching through it.** *(08-07)*
- **When one flag answers two questions, split the flag before adding a special case.** *(08-07)*
- **A field that exists only to be compared can be replaced by the comparison** — ship the boolean,
  not the id; that is how a public endpoint leaked account ids. *(08-06)*
- **A platform guarantee with a caveat is not a guarantee until you know which side you are on**;
  when a measurement seems blocked, prefer a second entry point to a second opinion. *(08-05)*
- **A bound sized to the column is not validation** — size it to the domain (24 h; blanks × (size −
  1)), and ask "can the column hold every value this check admits?" rather than "does it look
  right?". Sweep for the *sink* (what touches the column), not the parameter name. *(08-05)*
- **Don't write "measured" next to a case you reasoned about** — and when a status code could come
  from more than one guard, read the response body. *(08-05)*
- **Never pipe `npm run lint` through `tail`/`head`** — eslint's errors sit above the final blank
  line, so `| tail -1` reads as a pass. Check the exit code or capture the whole output. *(10-01)*

---

## 2026-10-02 — Skyscrapers G8: the accessibility-tree pass over the four-sided gutter

Branch `feature/skyscrapers-g8-a11y` on `eaef117`. Diff: `skyscrapers-board.ts` (clue names),
`Board.tsx` (named corners, `aria-describedby` gutter instructions), `KeyboardHints.tsx` (the
gutter keys, from the store's variant), `BoardAnnouncer.tsx` (done marks announced); tests; an
axe journey over a started Skyscrapers board in `e2e/a11y.spec.ts`; docs. **~60 LOC of source.**

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **94 files / 917 tests green** (2 new, 1 rewritten); no entry from the Known flaky tests table fired |
| Live check | the running board (the other session's dev server on port 3000, which serves this checkout) read through the built-in browser's accessibility tree before and after: corners named, legend rows present, and a `C` → `Enter` mark produced the live-region text "Clue 4, from the top of column 3, marked done" |
| Playwright | the new axe journey was **not run locally** (that server belongs to another session); CI runs it |

### Findings

- **The tree, not the attributes, held the defects.** Every cell had a correct role, index and
  name and axe passed, yet the tree read four unnamed corners, ten words per blank cell, "open"
  (a disclosure word) for an unsolved clue, a jump key told only in a dismissable dialog, and
  silence when a mark took. All four fixed; none would have failed a lint or an axe rule (L22).
- **A live screen reader was not driven.** G8 asked for NVDA / JAWS / VoiceOver; this pass used
  the accessibility tree the browser exposes, which is what those readers consume but not how they
  phrase it. Recorded as narrowed, not closed.
- The first assertion for the live region used `getByRole('status')` — the announcer is a bare
  `aria-live` div with no role; the test reads the `[aria-live="polite"]` node directly.

### Invariants checked

- The grid still exposes N+2 × N+2 cells with `aria-rowcount`/`aria-colcount`, every row the same
  width (L5), and the gutter stays outside the Tab order (D9) — the keyboard test is unchanged.
- The existing e2e Skyscrapers spec's name regexes updated with the wording (`unsolved`), nothing
  else about its flow changed.

### Review statements

- The hosted `/code-review` has **not** been run by the agent (owner-triggered, billed); the owner
  may run `/code-review high` on the PR. `/security-review` not applicable.
- Owner ran `/code-review high` — 5 findings, all fixed in the follow-up commit: the announcer
  spoke a new same-size game's reset of the done flags as a clue event (now re-based when
  `edgeClues` changes, with a test); the announcer hand-rolled the inverse of `clueFlatIndex`
  (now `clueFromFlatIndex` beside it); the new axe journey checked the rules dialog once instead
  of calling `dismissRulesIfShown` (a race); the plan's V2 a11y bullet and the D9 decision row
  still described the pre-G8 names; the un-mark announcement was untested.

### Lessons

- **Read the accessibility tree before reading the ARIA attributes** — a minute with the
  browser's tree dump shows what a listener will hear; axe and the type-checker cannot.

---

## 2026-10-02 — Skyscrapers R1: the fifth daily type, with the first non-9×9 standard

Branch `feature/skyscrapers-r1` on `4c5fb42`. Diff: `schema.ts` (`DailyVariant` + `StoredSkyscraperClue`),
`daily-row.ts` (sizes, profiles, the 5-rung bijection, `sectionForKey`, the clue store/restore pair),
`dailies.service.ts` dispatch, `/api/daily` (`clues`), `/api/daily/slots`, `DailyExperience`,
`ContinueBanner`, `attempts.service.ts` + `/api/me/progress` (section in SQL), `slot-display.ts`,
`useDaily.ts`, the cron comment; tests; docs. **~200 LOC of source**; no migration.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **93 files / 915 tests green** (12 new, 9 rewritten); no entry from the Known flaky tests table fired |
| Dry run | five seeded days through the real engines with no database: 8 rows / 8 distinct keys every day, every profile present, Skyscrapers in both sections, 0.7–10.5 s per day against the cron's 60 s |
| Live seed | **not run from the workstation** (L25 — the shared database; a Skyscrapers row before the serving code deploys would be served as a classic board of zeros); the first cron after deploy is the round-trip |

### Findings

- **"Standard = 9×9" was a coincidence written in four places.** `isEligible` always read the
  type's own standard size, but `/api/daily/slots`, the playing label, the continue banner and the
  archive progress aggregate each filed a board as a mini iff it was smaller than 9×9 — correct
  until the first 6×6 standard. All four now call `sectionForKey` (key first; size only for retired
  keys whose prefixes lie), and the aggregate carries the same rule as a SQL `CASE`, grouping by
  section instead of size (L21).
- **The owner's D5 call was forced by E5's tier sets, and recorded as such.** Only the 6×6 offers all
  five rungs, and the roll's bijection needs every type on the whole ladder; the mini-only and
  7×7-minus-easy alternatives were put to the owner with that reasoning.
- **A fifth size type leaked into the Sudoku-family dispatch.** `DailySize` admitting 5 made
  `generateKillerSudoku(…, { gridSize: slot.gridSize })` a type error; the two branches narrow back
  to 4/6/9 with a comment, since `SIZES` never hands them a 5.
- The scratchpad dry run first failed with `MODULE_NOT_FOUND`: `daily-row.ts` imports `@/…` aliases
  that `tsx` cannot resolve from outside the repo — `--tsconfig tsconfig.json` fixes it (noted for
  the next spike that imports a `lib/` module).
- **`/code-review high` (owner-run, on the PR): 7 findings, all fixed in-PR.** The one with teeth:
  the generation fallback for a failed STANDARD slot drew its size pool from `SIZES[*].standard`,
  which now contains a 6, and `isEligible(type, 6, hard)` is true for any type with a 6×6 mini — a
  failed 9×9 `hard` Killer could have been replaced by a 6×6 Killer mini board under the standard
  key. A standard slot now falls back only to other types at their standard sizes (tested). Also:
  `restoreSkyscraperClues` skips an unknown side; the SQL section rule reads its rung list and mini
  prefix from the registry; the unused clue-count alias is gone; the daily route's payload is a
  `switch`; the progress route's doc matches the code.

### Invariants checked

- `isEligible ⟺ getProfile` over the whole five-type space (the Risk #1 tripwire) with the new rows.
- Every roll: 8 slots, 8 distinct keys, all 5 rungs, every type at its own standard size, 3 distinct
  mini types, Skyscrapers only ever 5×5 in a mini and 6×6 in a standard — over 300 seeds.
- A stored Skyscrapers row round-trips its clues exactly (store → restore), an out-of-range stored
  index is ignored, and the route serves `clues` with neither `cages` nor `runs`.
- Retired keys still file by size (the archive-day regression test is unchanged and green).

### Review statements

- The owner ran `/code-review high` on the PR (7 findings, fixed above); the agent did not launch
  it. `/security-review`: the daily tables are shared, public and read-only to clients; the progress
  aggregate's `user_id` stays in the JOIN condition (asserted) — not required beyond that.

### Lessons

- **Grep for the consequences of a convention before trusting "the mechanism already supports it".**
  The registry supported a 6×6 standard; four consumers did not.
- **A scratch script that imports a repo module with path aliases needs the repo's tsconfig** —
  `npx tsx --tsconfig tsconfig.json <script>`.
- **When a table gains a value that used to be constant, re-read every pool built FROM that table,
  not just every rule that reads it.** The fallback pool was correct by construction while all
  standards were 9; the review, not the type-checker, found the 6 leaking across sections.

---

## 2026-10-02 — Skyscrapers E5: exactly the requested tier, per-size tier sets, the hub card

Branch `feature/skyscrapers-e5` on `93056d5`. Diff: `skyscrapers.ts` in its final form (exact-tier
generation, `SKYSCRAPERS_TIERS_BY_SIZE`, the batch contract) with tests; the generator's `exactTier`;
both routes (refuse unoffered levels, generate, 503 on the batch budget); the `/play` picker's
per-cell tier sets; the print form's configurator and size-aware lock note; the hub card;
`benchmark-skyscrapers.ts` and 12 log rows; `selectSkyscrapersBatch` deleted; docs. **~300 LOC of
source.**

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean (one unused import removed) |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **93 files / 906 tests green** (12 new, 7 rewritten); no entry from the Known flaky tests table fired |
| Benchmarks | `benchmark-skyscrapers.ts` 10 per cell: 6×6 easy / medium / hard **57 / 32 / 40 ms** (gate 200), expert 201, extreme 52; 7×7 459 / 297 / 704 / 311 (medium–extreme); 5×5 11 / 9 / 43. **Fuzz: 1,500 generated puzzles, 0 unsound, 0 non-unique, 0 label mismatches** |
| Playwright | hub and play specs updated (Skyscrapers card; generated clue counts) but **not run locally** — the port-3000 server belongs to another session; CI runs them against a production build |

### Findings

- **The lock note lied for Skyscrapers.** `DifficultyConfigurator` said "Expert and Extreme are
  only available for 9×9 grids" whenever a tier was locked; at 5×5 Skyscrapers that is false, and
  at 7×7 the locked tier is *easy*. The note is variant-aware now and names the offered list.
- **The picker's lock was a boolean about the top of the ladder.** Skyscrapers locks the bottom at
  7×7, so `topTiersLockedFor` became `tiersFor(variant, size)` returning the list, and the clamp
  on switching type/size picks the nearest offered tier instead of hard-coding `'hard'`.
- **The form's shared counts state would have sent `easy: 2` for a 7×7.** The configurator shows a
  locked input as 0 but the state still holds the default; the submit zeroes the tiers the size
  does not offer (asserted in the form test).
- The plan's "bands disjoint per size" gate has no object: tiers are ordinal technique levels (as
  Kakuro's E5 found). Recorded as not applicable rather than quietly ticked.
- **`/code-review high` (owner-run, on the PR): 7 findings, all fixed in-PR.** The one with
  weight: the client-rendered menu and form imported `SKYSCRAPERS_TIERS_BY_SIZE` from
  `skyscrapers.ts`, which carries the generator and both solvers — the table lives in the types
  module now. Also: a typed not-offered error instead of a message substring; E4's generation
  stats back in the route log (`generateSkyscrapersDetailed`); the 7×7 easy lock and clamp
  asserted in the e2e spec; the picker's cast-and-fallback replaced by `isSkyscrapersSize`; the
  shared `MAX_EXTREME` cap applied; the batch's retry path tested through a `generateOne` seam.

### Invariants checked

- Every served puzzle's label is re-derived from the finished puzzle by the classifier and equals
  the request (asserted at every offered cell); a level a size does not offer is refused by the
  entry point, both routes and the picker — four places, one table.
- Every generated puzzle in the 1,500-puzzle fuzz is unique by the exact solver and every logical
  placement equals the solution.
- The batch's out-of-time error is distinct from a caller's not-offered error (asserted).

### Review statements

- The owner ran `/code-review high` on the PR (7 findings, fixed above); the agent did not launch
  it. `/security-review`: the routes validate closed lists before any work and hold no auth/data
  access — not required.

### Lessons

- **A value the client reads must live in a module the client can afford.** Check what a
  client-side import drags along before exporting a constant from an engine entry point; the
  types module is where shared tables belong.
- **A lock on a ladder is a list, not a boolean.** The first type that locks the *bottom* tier
  breaks every "top tiers locked?" flag at once; carry the offered list from the engine to the
  picker, the form and the routes.

---

## 2026-10-02 — Skyscrapers E4: the generator behind "New puzzle"

Branch `feature/skyscrapers-e4` on `65fbacc`. Diff: `skyscrapers-generator.ts` (fill →
repair-with-restart → tier-bounded removal → verify → label) with tests and mirrored doc;
`SKYSCRAPERS_SIZES` in the types module; a Skyscrapers branch in `/api/puzzle` with an unbounded
fallback; `usePuzzle` without the fixture short-circuit; menu copy; the e2e spec's clue-count
assertion; docs (plan E4 step-log, log, roadmap, index, status). After the review: `skyscrapers.ts`
(the entry point with the serving policy) and a generic `shuffle`. **~370 LOC of source.**

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **93 files / 901 tests green** (16 new, 2 rewritten); no entry from the Known flaky tests table fired |
| Benchmarks | the slice's gate (100 generations per size and level, 60 at 7×7): **0 failures**; mean 5×5 7–10 ms · 6×6 34–51 ms · 7×7 391–782 ms, **except 7×7 easy 3.5 s** (45/60 via the unbounded fallback — a tier-set question for E5, L19). Unbounded medians 6 / 20 / 221 ms |
| Playwright | the Skyscrapers spec was updated (any clue count in [N − 1, 4N]) but **not run locally** — the only server on port 3000 belongs to another session and may not serve this branch; CI runs it against a production build |

### Findings

- **The gate's own wording hid a tier-set decision.** "0 failures in 100 per size" passes, but a
  7×7 *easy* request is honourable one square in fifty; a generator bounded to the request either
  spends its budget or fails. The route now gives up after 12 squares whose all-clue floor sits
  above the target and serves an unbounded puzzle with its real label and `fallback: true` in the
  log — degrade honestly, decide in E5 (L19).
- **The first hook test asserted the behaviour being removed.** `usePuzzle`'s "serves the fixture
  without touching the network" went red when the short-circuit left; it now asserts the fetch
  body. The e2e spec pinned the fixture's 15 clues for the same reason.
- **`maxRounds` 10 was not enough for 6×6 easy** (6/100 failures: a 25% floor rate to the tenth
  power); 40 rounds and the floor-miss cutoff took it to 0/100 with 3 fallbacks.
- **`/code-review high` (owner-run, on the PR): 9 findings, all fixed in-PR.** The one with
  weight: the bounded-then-fallback serving policy sat in the route controller (AGENTS.md §1);
  it is `skyscrapers.ts` / `generateSkyscrapers` now, with a test per level and one for the
  7×7-easy fallback path. Also: `maxRestarts` bounds a climb that never counts a swap (the
  cyclic squares of prime order have no intercalate); `removeClues` returns the classifier's
  label so the generator no longer re-derives it; the final uniqueness verify — the identical
  call the removal had just made — is gone; `shuffle` is generic; `randomLatinSquare` throws on a
  failed fill; JSDoc on six interfaces.

### Invariants checked

- Every generated puzzle is unique by the exact verifier (not the budgeted count), has no givens
  (D3), validates, and carries the classifier's own label (D7) — asserted per size.
- With a target, removal never exceeds it (asserted on 6×6 medium × 6 seeds and the route's 6×6
  hard); every kept clue after unbounded removal is load-bearing (blanking any breaks uniqueness).
- Same seed → same puzzle, end to end.

### Review statements

- The owner ran `/code-review high` on the PR (9 findings, fixed above); the agent did not launch
  it. `/security-review`: the route's new branch validates the two inputs against closed lists
  before any work and holds no auth/data access — not required.

### Lessons

- **Read a yield gate against the floor rate per cell, not per size.** "0 failures per size" was
  true and still left one (size, level) cell that fails three times in four; the per-cell table is
  the one to look at.
- **A "final verify" must use a different budget or a different solver than the step before it,
  or it verifies nothing.** Name what the second check knows that the first did not before adding
  it.

---

## 2026-10-02 — Skyscrapers E3b: the line-scan re-tier

Branch `feature/skyscrapers-e3b-retier` on `de2d1a3`. Diff: `skyscrapers-logical-solver.ts` (the
per-line scan split into `lineScan` ≤ 3 / `lineEnumeration` ≤ 12 / `lineFilter`, computed once per
candidate state and cached), `skyscrapers-score.ts` (two weights), the 5×5 fixture's label
(hard → easy), tests, mirrored docs, the plan's E3b slice + D6, the log, the findings addendum,
roadmap / index / status, the sample booklet. **~90 LOC of source.**

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **91 files / 883 tests green** (2 new, 5 rewritten); no entry from the Known flaky tests table fired |
| Benchmarks | classify on the fixtures **0.24 / 5.1 / 4.5 ms** (5 / 6 / 7) after the review's per-line scans — faster than the flat ladder's 0.4 / 6.7 / 6.3; the first cache (whole-grid rescan) had read 0.6 / 9.2 / 8.0 — against the 20 ms gate. **Acceptance (E3's scripts re-run):** 6×6 all-clue floor T1 74 · T2 183 · T3 6 · T4 7 · T5 28 of 300 (was 1 / 1 / 273); tier-bounded yields 6×6 28 / 85 / 58 / 15 / 53%, 5×5 90 / 55 / 8 / 8 / 20%, 7×7 0 / 28 / 58 / 8 / 68% |

### Findings

- **The fixtures test caught the relabel, as designed.** The 5×5's typed `'hard'` failed the
  re-grade the moment the bands landed; it is `'easy'` now (three scans of ≤ 3 arrangements). The
  drift guard from the E2 review paid for itself on the next slice.
- **Two tests were about the wrong thing once the weaker band existed.** The clue-2 pattern case
  (a 1 placed under a clue of 2) now has only two arrangements left, so `lineScan` fires first —
  correctly; the test disables the scan to test the named pattern. My first `lineScan` case used
  clues 3 and 2 on a 4×4 row, which sum to N + 1, so `facingSum` fired; clues 3 and 1 isolate the
  scan.
- **The re-tier moved the scarcity rather than removing it** (L18): hard is now the rare 5×5 tier
  (8%) and easy 7×7 does not exist (0 / 40). Both recorded as per-size tier-set inputs for E5, not
  patched here.
- **`/code-review high` (owner-run, on the PR): 9 findings, all fixed in-PR.** The one with
  weight: the first scan cache rescanned every clued line on every candidate change (+37%
  classify). Per-line dirty flags set by a single candidate write path (`setCandidates`; the
  forcing-chain trial adopts candidates through it) made the re-tiered solver *faster* than the
  flat one. Also: unclued lines out of the scan (one array shape, AGENTS.md §5); an ordered
  `LINE_BANDS` table instead of hand-derived bounds; boundary tests at 3 / 4 / 12 arrangements;
  stored removable masks; the one-arrangement hint's grammar; JSDoc on both cuts; parentheses.

### Invariants checked

- The ladder still asks for the weakest technique first: `lineScan` sits after the Latin singles
  in tier 1, `lineEnumeration` after reachability in tier 2 (order test extended).
- Soundness unchanged: the fuzz and fixture placements still equal the exact solution; a line with
  no surviving arrangement is a contradiction in every band.
- The scan cache is keyed on a `version` bumped by every `restrict` and `place`, so a band never
  reads a stale scan (the three bands share one computation per candidate state).

### Review statements

- The owner ran `/code-review high` on the PR (9 findings, fixed above); the agent did not launch
  it. `/security-review` not required.

### Lessons

- **A cache keyed on a global version is a cache that rescans everything.** Key it on what a
  write actually touches (here: the two lines through a cell) and route every write through the
  one method that marks it — the same change fixed the speed and the invalidation-by-convention.
- **When a weaker technique is added below an existing one, re-check every test that disables
  techniques to isolate a rule** — the new rung fires first and turns those tests into tests of
  the new rung.

---

## 2026-10-02 — Skyscrapers E3: the yield spike (docs-only slice)

Branch `feature/skyscrapers-e3` on `226a7fa`. Diff: `Docs/research/skyscrapers-feasibility-findings.md`
(new), the plan's E3 step-log and D4/D12 rows, the log (journal, D4/D12, G3/G5/G7/G12, L15–L17, a
measurements row), roadmap, index, status. **No source changed** — the spike ran as throwaway
scripts in the scratchpad, per the plan's "no production code".

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` · `npx vitest run` | not re-run — no `.ts`/`.tsx` in the diff; `main` at `226a7fa` was green |
| Benchmarks | the slice *is* the measurement: repair 0.1 / 0.2 / 3.6 ms median at 4–6; 7×7 24/50 plain vs **30/30 with restart (178 ms median)**; 9×9 0/8; tier-bounded yields at 6×6 0/0/85/10/73% (T1–T5); all-clue floor 273/300 at T3 |

### Findings

- **Roadblock, surfaced not patched (AGENTS.md Roadblock & Research Rules).** Easy and medium
  6×6 Skyscrapers cannot be generated under the E2 tiering: with every clue present, 91% of random
  unique squares already need tier-3 line filtering, and removal only moves a puzzle up. The
  findings doc (§3c) names the cause (a catch-all technique tiered flat), measures the fix
  (line-filter steps mostly scan 1–6 arrangements; re-tier by scan size gives ≈ 5 / 57 / 24%
  easy / medium / hard at the 6×6 floor) and leaves the call to the owner before E4.
- **The first pass could not explain its own zero.** Forty tier-bounded attempts per tier showed
  0% easy at 6×6 with no cause; a 300-square all-clue floor histogram (one supplementary minute)
  explained it. Logged as L17: measure the floor before measuring removal.
- **The plain 7×7 repair climb was a false negative for the design, not for the size.** 24/50 in
  20 s read as "7×7 is marginal" until the objective was inspected: every square sat at the count
  cap, so the climb had no gradient. Restart-after-40 + cap 20 → 30/30 in 178 ms median (L16).
- **9×9 is measured out, not assumed out:** 0/8 repairs in 60 s each, 60–100 ms per count,
  130–470 ms per classify (every random all-clue 9×9 `unrated`). D4's alternative is closed with
  numbers.

### Invariants checked

- Guess count is 0 by construction (the ladder has no guessing tier); every "accepted" puzzle in
  the tables is unique (count = 1) **and** finished by the ladder at the stated tier.
- The G4 numbers (already-unique 74 / 34 / 8 / 0%) and G5's N − 1 floor (3 at 4×4, 4 at 5×5)
  replicated by an independent script, not copied.

### Review statements

- The hosted `/code-review` has **not** been run by the agent (owner-triggered, billed); the owner
  may run it on the PR — it is a docs-only diff. `/security-review` not applicable.

### Lessons

- **A yield spike's first number is the ceiling, not the yield.** For any generator that only
  ever *removes* information (clues, givens, cells), the grade of the fully informed instance
  bounds what removal can reach; histogram that first, then measure removal under it.
- **A climb that fails half the time is a question about the objective before it is a question
  about the size.** Check whether the objective is saturated (sitting at its cap) before
  concluding the instance is hard.

---

## 2026-10-02 — Skyscrapers E2: the logical solver, classifier and scorer

Branch `feature/skyscrapers-e2` on `99b1387`. Diff: `skyscrapers-logical-solver.ts` (14 named
techniques in five tiers, `classifySkyscrapers` / `measureSkyscrapers` / `explainSkyscrapersHint`)
and `skyscrapers-score.ts`, with tests and mirrored docs; the fixtures relabelled by the classifier
at import; the Skyscrapers hint deducer explains first; `HintNote.technique` widened; the dev badge's
`ladder:` / `metrics:` lines; copy; plan/log/roadmap/index/status; the sample booklet regenerated.
**~930 LOC of new engine source** (the ladder is the slice) plus ~110 changed lines elsewhere —
over the 400-LOC target, as E1 was; the plan slices the engine by solver, not by LOC.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 (one MD004 hit from a wrapped "+ 3" fixed) |
| `npm run lint` | clean (one unused helper removed) |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **91 files / 881 tests green** (22 new, 5 rewritten); no entry from the Known flaky tests table fired |
| Benchmarks | the slice's gate is a measurement (E5 adds `benchmark-skyscrapers.ts`): classify **5×5 0.42 ms · 6×6 6.7 ms · 7×7 6.3 ms** warm over 100 runs against the 20 ms gate (0.47 / 7.4 / 7.0 before the review's precomputation); cold first call 19 ms (the lazy table build) |

### Findings

- **The plan's "every T1–T4 technique fires on at least one fixture" gate is not met by the
  fixtures and is recorded as such.** `facingSum`, `reachability`, `nakedSubset`, `hiddenSubset`
  and `xWing` fired on none of the three hand-baked puzzles; each has a minimal hand-built firing
  case as a test instead, and the coverage claim moves to E3/E4's corpora (log G7). Three puzzles
  were never going to carry it.
- **Bivalue forcing chains left the 6×6 `'unrated'`.** Its bottleneck cells were trivalue; the
  trial now covers 2–3 candidates, fewest first, and the fixture grades extreme in four chains.
  No guessing introduced — a value goes only when its supposition is proved impossible (L12).
- **The hint's precedence had to be decided, not inherited — and then decided at the right
  depth.** With the logical solver first, the E1 store test "hints the selected cell when the
  solver forces it" went red: `clueN` places its own cell before any single is considered, so the
  named step almost never landed on the selection. The first fix let the exact solver's forced
  value win for the selected cell inside the deducer; the review called it a bandaid, and the fix
  moved into the explainer — `step()` confines every placing technique to a `target`, so the
  selection is hinted *by name* and the deducer is Kakuro's shape again. Both orders are store
  tests (L14).
- **`/code-review high` (owner-run, on the PR): 10 findings, all fixed in-PR.** The two with
  weight: grading the fixtures at import ran ~30 ms of solver work in the client bundle on every
  `/play` load (typed labels now, re-graded by a test), and the deducer-level precedence above.
  Also: a repeated height was not a contradiction from the start (seen-mask per house now; a
  broken grid records zero steps); a 500-iteration explain guard under 9×9's 729 bits (N³ + 1);
  2N line/house arrays rebuilt per technique call (constructor fields; 5–10% faster); a dead
  branch; three copies of the agree-with-solution check and three line-indexing conventions each
  folded into one; an identity map; two missing JSDoc blocks.
- **A wall-clock assertion in the unit suite measured the suite.** 77 ms under parallel load for a
  7 ms solve. The test now only guards against a runaway (< 1 s); the real number is in the plan's
  step-log and the log's measurements table.
- Four of the first twenty tests were wrong, not the solver (a facing-sum count assumed every pair
  of the test square summed to N + 1 — it is four of eight; a clue-2 case forgot that
  `nearlyFilledClue` is tried first; the contradiction case needed the constructor to apply the
  board's prefix rule, which it now does via `clueStatus`, so the solver and the red clue agree).

### Invariants checked

- Every logical placement equals the exact solution on every fixture and on 25 random uniquely
  solvable 4×4/5×5 puzzles; no solve reports a contradiction on a valid board.
- A hidden single on a full permutation is sound without a `required` guard (L1, on record).
- The grade is the hardest tier *needed*: a tier-3 step never fires while a tier-1 step is
  available (ladder order asserted); the 5×5 that E1's propagator solved outright grades hard.
- A served fixture's label is the classifier's or `'unrated'`, never typed (D7): `graded()` at
  import, tiers pinned in tests, `'unrated'` on a blank board.
- A hint is placed only if it agrees with the solution (L9), on both the explained and the forced
  route; a contradictory grid yields `null` from the explainer.

### Review statements

- The owner ran `/code-review high` on the PR (10 findings, fixed above); the agent did not launch
  it. `/security-review` not required: no auth/authz/data-access change.

### Lessons

- **A coverage gate phrased over fixed test data is a claim about the data, not the code.** "Every
  technique fires on a fixture" with three fixtures was unmeetable by construction; phrase such
  gates over a corpus the slice can actually produce, and until then back each technique with its
  own minimal case.
- **When a second deducer is put in front of a first, re-run the first's behavioural tests before
  deciding they are stale.** The red "selected cell" test was the design question, not a dead
  assertion.
- **A module evaluated in the client bundle must do no work at import that a test could pin
  instead.** "Computed at import so it can never drift" is paid by every visitor; a typed value
  plus a test that recomputes it is paid once, in CI.

---

## 2026-10-02 — Skyscrapers E1: the exact solver behind the Hint button

Branch `feature/skyscrapers-e1` on `2923d95`. Diff: `skyscrapers-visibility.ts` (per-size
permutation table) and `skyscrapers-solver.ts` (line-filter exact solver, the Kakuro contract) with
tests and mirrored docs; the store's `hint` deduces for Skyscrapers; `SkyscrapersDevBadge` +
gate; store/badge tests; plan/log/roadmap/index/status. **~420 LOC of source**, the engine core
of the slice.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **89 files / 859 tests green** (27 new); no entry from the Known flaky tests table fired |
| Benchmarks | the slice's gate is a measurement, not a benchmark row (E5 adds `benchmark-skyscrapers.ts`): uniqueness verify **5×5 0.07 ms · 6×6 0.40 ms · 7×7 1.1 ms** (200 warm runs each) against the 50 ms gate; table build 1.2 / 3.5 / 9.7 ms, 205 ms at 9×9 |

### Findings

- **`/code-review high` (owner-run, on the branch): 6 findings, all fixed in-PR.** The one with
  teeth: a clue outside 0..N (a corrupt save) indexed past the bucket table and threw inside the
  Hint action — `compile` now maps it to an empty bucket (tested with 9, −1, 2.5). Also:
  copy-on-narrow survivor lists (measured ~5% per node at 7×7 and 9×9 — the copies were transient,
  not retained; the first two-closure draft was 40% slower, L11); the propagation scratch buffer
  lives in `Compiled`; a stale comment fixed; `digitOfBit` shared via `grid-utils`; the hint
  deducers moved out of the store into a registry (`hint-deducers.ts`).
- **Three of the first five solver tests were wrong, not the solver.** The "obvious" 4×4 Latin
  square is the research's own non-unique counterexample (it shares all 16 clues with a twin), so
  every uniqueness claim on it failed; "visible 4 from the right" is the *descending* permutation;
  and a 20-node budget is never reached when the limit is 2. Each was re-read against the
  measurement and corrected; the solver's answers were right throughout. L10 in the log.
- **Blank boards are a free oracle:** with no clues the solver must count every Latin square —
  12 at 3×3, 576 at 4×4 — and does. Kept as a test.
- The line filter at fixpoint solved the 5-clue 5×5 fixture outright (25/25 cells forced from
  empty): the propagator is far stronger than the research's "Easy rules", which E2's classifier
  must not mistake for human difficulty.

### Invariants checked

- The count agrees with an independent brute force (every Latin square, every present clue) on
  60 random small puzzles with random blanks; `exhausted` is `false` on all of them.
- A solver-forced hint is placed only if it **agrees with the solution** (Kakuro L9), the selected
  cell is honoured when forced, and a contradiction falls back to a reveal — three store tests.
- The 204/576 all-clue ambiguity and the G5 4×4 facts (no 2-clue subset pins the counterexample;
  some 3-clue subset pins some square) are now tests, not a research claim.
- Survivor lists are compacted in place only on a node's own copy (a child never narrows its
  parent's list) — read, and the fuzz would catch a violation as a wrong count.

### Docs sweep

New: `skyscrapers-visibility.md`, `skyscrapers-solver.md`, `SkyscrapersDevBadge.md`. Updated:
`useBoardStore.md`, `PlayExperience.md`, `skyscrapers-fixtures.md` ("owed to E1" → proven);
plan (V3 ✅, E1 step-log with the numbers, slice table, status), log (journal, L10, a measurement
row), roadmap, Docs index, project-status.

### Verified vs read

- **Verified:** tests, lint, tsc, build, markdownlint; the timings by script; the Hint button and
  the dev badge on the live board (dev server).
- **Read only:** nothing material — every claim in the slice is a test or a measurement.

### Review statements

- `/security-review`: **not run** — pure engine code and a dev-only badge; no auth, data or
  route surface.
- `/code-review`: **run by the owner** (`/code-review high`, in-session) — 6 findings, all fixed
  before merge (above).

### Lesson

- **Benchmark a hot-loop change before and after, best-of-N, with `git stash` for the baseline.**
  The first copy-on-narrow draft was 40% slower per node (two closures inside the loop); only the
  measurement said so. Five minutes of script beats a plausible story.
- **A blank-clue count is a solver oracle that costs nothing.** For any constraint type whose
  unconstrained instance has a known count (Latin squares: 12, 576, 161,280), count it with every
  clue blank — a propagation or search bug shows up as the wrong total before any fixture is
  needed.

## 2026-10-02 — Skyscrapers V3: the fixtures printable on `/generate` and in the sample booklet

Branch `feature/skyscrapers-v3` on `744754b`. Diff: `drawSkyscrapersGrid` + `generateSkyscrapersPDF`
in `pdf.service.ts`, a Zod'd Skyscrapers branch in `/api/generate`, `selectSkyscrapersBatch`
beside the fixtures, the print form's fifth toggle (no configurator until E5), hook filename,
configurator variant + size-5 row, `preview-skyscrapers.ts`, `Docs/samples/skyscrapers-sample.pdf`;
tests for each; mirrored docs + the samples index. **~230 LOC of source.**

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean |
| `npx vitest run` | **86 files / 832 tests green** (12 new); no entry from the Known flaky tests table fired |
| Benchmarks | n/a — no solver code |

### Findings

- **`/code-review high` (owner-run, on the branch): 5 findings, all fixed in-PR.** The renderer
  re-derived the gutter geometry instead of iterating the engine's `buildDisplayCells` (the helper
  L2 put there for exactly this consumer — now L9); the one-puzzle rule was enforced in three
  places (the schema's per-level `max(1)` dropped); the route's happy path is parametrised over
  5/6/7 and a content-stream test counts the drawn digits; the printed title says *hand-made* for
  an `'unrated'` fixture; the five-type toggle rows are five-column grids.
- One rule changed from the spec: with one ungraded fixture per size, the honest
  print contract is **one puzzle per request** (any level), not Kakuro V3's one-per-level — the
  route refuses more with the reason and the form offers no counts. Two lines E5 deletes.
- The renderer needed no display-coordinate code of its own: it reads clues through `clueAt`
  like the board (L2 confirmed on the second consumer).

### Invariants checked

- The route validates with Zod before anything runs (sizes 5 | 6 | 7, counts 0..1, total exactly
  1); every refusal is a 400 with the reason, asserted by five route cases. Fixture selection is
  a service function, not route logic (AGENTS.md §1).
- Puzzle pages print `grid` (empty — no givens), answer pages print `solution`; blank clues draw
  nothing; the clue digit is half the solved digit (0.3 vs 0.6 of a cell) and lighter — read by
  eye on the rasterised pages.

### Docs sweep

New: `preview-skyscrapers.md`. Updated: `pdf.service.md` (§4d), `route.md` (§1d), `PuzzleForm.md`,
`DifficultyConfigurator.md`, `usePuzzleGeneration.md`, `skyscrapers-fixtures.md`,
`Docs/samples/README.md`; plan (V2 ✅ with the owner's verdict, V3 step-log, slice table, status),
log, roadmap, Docs index, project-status. Reverse sweep for "one per level" on Skyscrapers: the
plan's V3 spec line is amended in the step-log, not rewritten.

### Verified vs read

- **Verified:** tests, lint, tsc, build, markdownlint; the 6×6 puzzle and answer pages rasterised
  with `sips` and checked (single-page renders made with `drawSkyscrapersGrid` directly — QuickLook
  rasterises only a PDF's first page, the Kakuro V3 note).
- **Read only:** the booklet as a whole on paper — handed to the owner with the sample.

### Review statements

- `/security-review`: **not run** — the route branch is Zod-validated input → a static fixture →
  a PDF; no auth, data or ownership surface.
- `/code-review`: **run by the owner** (`/code-review high`, in-session) — 5 findings, all fixed
  before merge (above).

### Lesson

- **Asserting on a PDF's content needs compression off and PDFKit's real operators.** A page
  rendered with `compress: false` exposes the content stream; PDFKit writes each single-glyph
  `text()` as `[<hh> 0] TJ` (hex glyph code, embedded-font subset), not `(…) Tj` — the first
  draft of the content test matched nothing and would have passed vacuously on `toBe(0)` had the
  expected count been 0.

## 2026-10-02 — Skyscrapers V2: playable at `/play?variant=skyscrapers` on the baked fixtures

Branch `feature/skyscrapers-v2` on `60c8c26`. Diff: store (`'skyscrapers'` variant, `edgeClues`,
`doneClues`, `toggleClueDone`, persist v6), `Board`/`Cell` (four-sided gutter, play-area frame,
`C`-key clue navigation), new `SkyscraperClueCell` + `skyscrapers-board.ts`, engine
`clueStatus`/`clueFlatIndex`, `PlayExperience`/`GridSizeSelector`/`usePuzzle`/`RulesDialog`
registration, CSS; the V0/V1 workbench route and static board **deleted**; tests across all of
it plus one E2E spec; mirrored docs. **~650 LOC of source** — over the ~400 target, the same way
Kakuro V2 was (a variant touches every surface at once); not split because each file's change is
one registration.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean (one unused test import caught and removed before this entry) |
| `npx tsc --noEmit` · `npm run build` | clean · clean (a stale `.next/types` entry for the deleted route had to be removed for `tsc` — the build regenerates it) |
| `npx vitest run` | **86 files / 820 tests green** (14 new); no entry from the Known flaky tests table fired |
| Playwright | the new Skyscrapers play spec **green** against the running dev server (`E2E_PORT=3000`, chromium); the full suite was not re-run |
| Benchmarks | n/a — no solver code |

### Findings

- **`/code-review high` (owner-run, on the branch): 7 findings, 6 fixed in-PR, 1 the owner's
  call.** The one with teeth: a mouse click on a clue cell left focus there, and the gutter
  handler then swallowed every digit typed — the click now hands focus straight back to the
  selected play cell (tested). Also: `toggleClueDone` range-checks side and index before packing
  (an index past a side's end wrapped into the next side's flags); bare `C` only (Ctrl/Cmd+C is
  copy); `edgeClues` copied on start instead of aliasing the fixture singleton; the no-op
  `.clueSatisfied` class and an identity status map removed; gap cases for the prefix rule
  tested. The seventh — ~650 LOC of source against the ~400 target — is acknowledged below.
- **A digit typed while a clue cell had focus landed on the selected play cell** — the first
  draft routed every key through the board handler. Found by the keyboard test, not by reading;
  fixed by a clue handler that runs first and swallows unmatched keys while the gutter is focused.
- Two zero-match assertions used `getAllByRole` (throws) instead of `queryAllByRole`; a BSD
  `sed` with a mid-pattern `^` silently did nothing — the Python replace is the one to trust.
- Design kept from the review of V0: corners are empty read-only gridcells, counts on the grid.

### Invariants checked

- `edgeClues` is **persisted** (it is the puzzle) and nothing is derived from it in `merge`; the
  clue verdict is read from `grid` in each clue cell's selector — asserted by the hydration test
  (clues and done marks come back; `blocked` stays `[]`).
- `doneClues` is in the **temporal** partialize — undo/redo of a mark asserted.
- The Latin lockout (`placed >= size`) and row/column-only peers at a size that has boxes for
  Sudoku (6, 4) are asserted; `maxNum = N` (no 7 on a 6×6 numpad) in the E2E spec.
- Prefix-rule verdicts asserted on the board: a 4 next to a "2" clue is violated at once; a 4
  elsewhere leaves the column's clue open; a completed correct line is satisfied.
- Persist version bumped (5 → 6) because the persisted shape changed — the rule every earlier
  bump followed.

### Docs sweep

New: `SkyscraperClueCell.md`, `skyscrapers-board.md`. Updated: `useBoardStore.md`, `Board.md`,
`Cell.md`, `PlayExperience.md`, `usePuzzle.md`, `RulesDialog.md`, `GridSizeSelector.md`,
`skyscrapers-types.md`; plan (V1 ✅, V2 step-log, slice table, status), log, roadmap, Docs index,
project-status. Deleted docs: `page.md` and `SkyscrapersBoard.md` with their sources. Reverse
sweep for `SkyscrapersBoard` / `/skyscrapers` route in live docs: only the plan's own V0/V1
history and the roadmap's dated status line, both correct as history.

### Verified vs read

- **Verified:** tests, lint, tsc, build, markdownlint, the E2E spec against the dev server, and
  the page in the browser pane (game starts from the deep link, rules dialog, gutter renders).
- **Read only:** the visual result in both themes, at 5/6/7 and at 360 px — the slice's gate,
  the **owner's** verdict (handed over with the dev server running).

### Review statements

- `/security-review`: **not run** — no auth, data or route logic (client board + fixtures).
- `/code-review`: **run by the owner** (`/code-review high`, in-session) — 7 findings, 6 fixed
  before merge (above); the slice-size finding is the owner's call.

### Lesson

- **A `tabIndex -1` control is still focusable by mouse.** "Keyboard-only" focus is a design
  intent, not a browser guarantee; a click handler on such a control must say where focus goes
  next, or the widget's key handler will act on a focus state nobody chose.
- **A keyboard model with two focus regions needs two handlers, and the inner one goes first.**
  One handler that "also" checks where focus is will leak keys into the outer region on the
  first case nobody thought of; a dedicated handler that returns `true` when it owns the key
  makes the leak impossible by construction.

## 2026-10-02 — Skyscrapers V1: types, baked fixtures, clue digits on `/skyscrapers`

Branch `feature/skyscrapers-v1` on `0c10f5f`. Diff: `skyscrapers-types.ts` grows the puzzle
shapes, config, `visibleCount` / `deriveClues` / validator; new `skyscrapers-fixtures.ts`
(three served fixtures + the 4×4 non-unique pair); `SkyscrapersBoard` takes a puzzle and draws
clue digits; the route renders the fixtures; four mirrored docs; plan/log/roadmap/index/status.
**~330 LOC of source**, inside the slice budget. Throwaway fixture-generation scripts stayed in
the session scratchpad by design (the fixtures doc says how they worked).

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean (`/skyscrapers` prerendered) — one TS error in a test helper's parameter type caught by `tsc`, fixed before this entry |
| `npx vitest run` | **86 files / 806 tests green** (27 new); no entry from the Known flaky tests table fired |
| Benchmarks | n/a — no solver code yet. The slice's measurement is in Findings |

### Findings

- **`/code-review high` (owner-run, on the branch): 6 findings, all fixed in-PR.** The one with
  teeth: the fixture parser cast its row count to `GridSize`, so a 3×3 or 8×8 fixture would have
  carried a size the union forbids into every consumer typed on it — `sudoku.ts` now exports
  `GRID_SIZES` + `isGridSize` and the parser guards (tested at 3 and 8). Also: `clueAt` makes
  blank-by-absence explicit on the board; `isLatinSquare` moved to `grid-utils.ts` and replaced
  four hand-rolled copies (three Keisan tests + Skyscrapers); `lineFor` bottom = top reversed;
  `presentClueCount` replaces an inline count; a ragged fixture row is now named in its error.
- **The slice's real output is a measurement that overturns a plan assumption.** Obtaining a
  7×7 fixture by "random Latin square + all 28 clues, reject unless unique" **never succeeded:
  0 of 94,962 squares** (each count 1–3 ms; both solutions of a sample verified independently).
  At 5×5 it took 2 squares, at 6×6 15. Plan E4 said reject-the-square is "cheap at N ≤ 7"; it
  is impossible at 7. **Repair by random intercalate swaps** (accepted when the capped solution
  count does not rise) reached a unique 7×7 in 38 steps / 192 ms. E4 amended to repair, E3 (a)
  re-pointed at the repair's cost per N, G4 resolved, L6/L7 in the log. Recorded in the plan and
  log rather than a separate research doc because the finding has a known remedy with an in-repo
  precedent (Kakuro L7/L15) and E3 is the designated measurement slice; the E3 findings doc will
  be the formal record.
- **Three throwaway counters were needed before one finished a 7×7** — a cell-by-cell
  backtracker never did, a row-permutation DFS stalled on sparse clues, and the research's
  line-filter design counted any 7×7 in milliseconds. That settles E1's design (L7).
- No fixture is fully clued (the spec asked for one): no random 7×7 can be, and the fully-clued
  case is the generator's own starting state (E4), so it is not worth a hand fixture.

### Invariants checked

- Every fixture's clues are **derived** from its square by `deriveClues` and filtered by a mask;
  a typed clue cannot disagree with its solution. `validateSkyscrapers` rejects a non-Latin
  square, a clue outside 1..N, a clue that disagrees, a wrong-length clue array, and a given that
  disagrees — each with a test that proves it bites.
- `skyscrapersGridConfig` is boxless at **every** size (a 6×6 Skyscrapers has no 2×3 boxes) and
  `maxNum = N`; asserted.
- The 4×4 non-unique pair really is two different Latin squares with identical full clue sets
  (test), so E1's counter has a canonical case that must report two.
- Labels are all `'unrated'` (D7) — asserted; no fixture carries a grade the classifier did not
  give it.

### Docs sweep

New: `skyscrapers-fixtures.md`. Updated: `skyscrapers-types.md` (full rewrite for the V1
contents), `SkyscrapersBoard.md`, `page.md`, plan (V0 ✅ with the owner's verdict, V1 step-log,
E3 (a) and E4 amended), log (journal, G4 resolved, L6/L7, a measurement row), roadmap,
Docs index, project-status. Reverse sweep for "reject the square" / "cheap at N ≤ 7": the one
live hit (plan E4) amended in place with the original struck through.

### Verified vs read

- **Verified:** tests, lint, tsc, build, markdownlint; the page renders all three fixtures with
  their clue digits and no console errors on a fresh load (dev server).
- **Read only:** the fixtures' **uniqueness** rests on the throwaway counter, not on anything in
  the repo — owed to E1, stated in the fixtures doc and the plan.

### Review statements

- `/security-review`: **not run** — no auth, data or route logic (a static noindex page).
- `/code-review`: **run by the owner** (`/code-review high`, in-session) — 6 findings, all fixed
  before merge (above).

### Lesson

- **Never `as GridSize` a number that came from data.** The union is a promise every consumer
  relies on; a cast makes it without checking. `isGridSize` is the guard — reach for it at
  every boundary where a size arrives (fixture, request, saved game).
- **A fixture slice is a measurement slice in disguise.** Making one honest fixture per size
  forced the first real yield numbers (P(unique) ≈ 50% / 7% / 0 at 5 / 6 / 7) three slices
  before E3 was scheduled to measure them — and overturned an E4 design choice while it was still
  a sentence in a plan. Treat "author a fixture by the generator's intended method" as the
  cheapest de-risk available, and read its failures as findings.

## 2026-10-01 — Skyscrapers V0: looks-only board at 5×5 / 6×6 / 7×7 on `/skyscrapers`

Branch `feature/skyscrapers-v0` on `5b6cac5`. Diff: 1 route (`src/app/skyscrapers/page.tsx`),
1 static Server Component + CSS module + 6 tests (`components/SkyscrapersBoard/`), mirrored
`.md` for both, and the plan/log/roadmap/README/index/status flips to "in progress". **~180 LOC
of source**, well inside the slice budget.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npm run lint` | clean |
| `npx tsc --noEmit` · `npm run build` | clean · clean (the build is the PR template's separate gate and **CI does not run it** — review finding 3) |
| `npx vitest run` | **85 files / 779 tests green** (9 new); no entry from the Known flaky tests table fired |
| Benchmarks | n/a — no engine code |

### Findings

- **`/code-review high` (owner-run, on the branch): 6 findings, all fixed in-PR.** The one with
  teeth: hiding the four corners left the ARIA grid with N accessible cells in its first and last
  rows against N+2 in the middle rows — a malformed grid to a screen reader. Corners are now empty
  read-only gridcells, with `aria-rowindex` / `aria-colindex` on every row and cell and counts on
  the grid. Also: the frame placement gained its missing test; the display helpers moved into the
  engine (`skyscrapers-types.ts`, per L2) instead of waiting for V1; dead per-side CSS and a
  test-only `data-size` attribute removed; `aria-readonly` kept only where it stays true in V2.
- Design call kept: lines are drawn on the play cells and the frame on the play area's edge
  cells, **not** with Kakuro's gap-as-line board background — that trick draws a line between
  every pair of cells, including gutter cells that must read as open space.
- No dark-theme override was needed (no filled blocks to re-tint); verified by reading the CSS,
  the owner's visual pass covers both themes.

### Invariants checked

None apply — a static, read-only Server Component with no store, no input, no data access, no
routes beyond a `noindex` workbench page. The ARIA skeleton (play gridcells, read-only gutter
gridcells named by reading direction, hidden presentational corners) is asserted by the tests so
V2 inherits it rather than re-deriving it.

### Docs sweep

New: two mirrored docs. Updated: plan (status, slice table, V0 step-log, D4 "planned by owner");
log (journal, D4 status); roadmap (Phase 11 status, backlog header); README row; Docs index row;
project-status. Reverse sweep for "nothing built" / "📋 Planned" on Skyscrapers lines: all live
hits flipped.

### Verified vs read

- **Verified:** tests, lint, tsc, markdownlint; the page renders at `/puzzles/skyscrapers` with
  no console errors (dev server).
- **Read only:** the visual result in both themes and at 360 px — that is the slice's gate and
  it is the **owner's** verdict, handed over with the dev server running (not self-certified).

### Review statements

- `/security-review`: **not run** — no auth, data or route logic (a static noindex page).
- `/code-review`: **run by the owner** (`/code-review high`, in-session) — 6 findings, all fixed
  before merge (above).

### Lesson

- **Hiding a cell from the accessibility tree changes the shape of its grid.** `aria-hidden` on
  a corner cell is not neutral: rows then disagree on their column count and AT reports a
  malformed table. Keep every cell of a `role="grid"` in the tree (empty and read-only if it
  holds nothing) and state the geometry with `aria-rowcount` / `aria-colcount` / `aria-rowindex`
  / `aria-colindex`.
- **The Next build is a gate of its own.** `tsc` and eslint pass code the `next build` rejects
  (route-segment and metadata rules, prerender failures), and `ci.yml` does not run the build —
  a Vercel deploy of `main` is otherwise the first place it fails.

## 2026-10-01 — Skyscrapers plan: research, implementation plan, running log, Phase 11 (docs only)

Branch `feature/skyscrapers` on `946d83f`. **No `.ts`/`.tsx` touched.** Lands the fifth puzzle
type's paper trail: `Docs/research/skyscrapers.md` (four-stream deep research),
`Docs/research/skyscrapers-research-gaps-findings.md` (G1/G2/G9/G10 answered, G5 narrowed, same
day), `Docs/skyscrapers-implementation-plan.md`, `Docs/skyscrapers-log.md`, roadmap Phase 11 +
gantt row + backlog pointer, README row 11, Docs index, project-status. Two throwaway Node
scripts (all-clue ambiguity replication; 4×4 minimum-clue enumeration) ran in the session
scratchpad by design — plan E1 turns both results into tests.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npx vitest run` · `npm run lint` · `npm run build` | not run — docs only; nothing under `src/` changed |
| Benchmarks | n/a — two measurements instead: 4×4 / 5×5 all-clue ambiguity (35.42% / 57.61%, matches the research exactly) and 4×4 minimum clues (3 suffice, 2 never) |

### Findings

- Two research claims were **wrong and corrected before landing**: the research doc said no live
  trademark surfaced (a live EU/UK "SKYSCRAPER" games-software mark exists — D1 now wires "Towers"
  as the fallback title), and it inferred Tatham flags a violated clue only on a completed line
  from a **stale GitHub mirror** (the current source flags prefix-provable violations immediately
  and has a `COL_DONE` colour — D9 amended). Both corrections are noted in the research doc's
  banner rather than silently rewritten.
- The roadmap still said the daily scales "to 5 + 5 = 10" and the Kakuro backlog header still read
  "In Progress" after Phase 10 shipped — reverse-sweep misses from R1, fixed here.
- The reuse map was built from a fresh survey of `main`, not from the Kakuro plan's table: it
  found `selectKakuroBatch` gone (E5 replaced it), the Kakuro gutter is top+left only, and ≥ 14
  hardcoded variant lists — each is now a named checklist item for V2/V3/R1.

### Invariants checked

None apply (no code). Every number in the docs was copied from script output or the research
notes, not retyped; the 4×4 counterexample pair was hand-verified against the rules.

### Docs sweep

New: three docs. Updated: roadmap (Phase 11, gantt, backlog pointer, two stale lines), README,
Docs index (two rows), project-status (plan of record + horizons), the research doc's banner and
§6. Reverse sweep for "fifth type" / "next two puzzle types" / "5 + 5": the one remaining hit
(`daily-redesign-plan.md:32`, "next two puzzle types plug in") is correct historical framing of
a plan written at 3 types and was left alone. Memory note updated.

### Verified vs read

- **Verified:** the two measurements (own scripts); markdownlint; every internal link target
  exists (markdownlint MD051 caught one bad anchor — an emoji with a variation selector changes
  the generated heading id; swapped for a plain emoji).
- **Read only:** every external claim in the research docs rests on the cited URLs and the
  researchers' confidence tags; trademark findings are web-indexed register data, not counsel.

### Review statements

- `/security-review`: **not run** — docs only.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it (and there
  is no code in this PR).

### Lesson

- **A heading with an emoji that carries a variation selector (e.g. 🏙️) breaks `#anchor` links** —
  markdownlint's MD051 generates a different fragment than the visually identical plain emoji.
  Use plain emoji in headings that anything links to, and let MD051 be the tripwire.

## 2026-10-01 — Kakuro review follow-up 9: all 6 `/code-review high` findings on R1 addressed

Branch `feature/kakuro-review-9` on `e75cd37` (main, after R1). Table in the plan (R1 → "Review
follow-up 9"); journal + a shares row in `kakuro-log.md`. ~60 code lines net (the mistake cap's
solution-aware count, the `SIZES`-driven fallback pool, the two-draw mini roll, the typed banner
label, one `DailyVariant` union), a new 60-line route test, ~30 other test lines, ~70 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 83 files, **770 passed**, 0 failed — 1 new file (`api/daily/route.test.ts`: runs / cages / neither / 404 with the service mocked at the boundary), 2 new cases (Kakuro black cells in the mistake cap; every type's hard-seat share bounded 15–35% over 600 seeds), 3 banner assertions retargeted |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Playwright `home.spec.ts` (banner on the hub) | 5 passed on the re-run; the first run's one flaky test was the known `fullyParallel` contention, retried green |
| Mini-seat shares (2 000 seeded rolls) | hard seat: classic 23.5% · killer 33.4% · keisan 19.9% · **kakuro 23.3%** (was ~half the others' by construction); any mini seat: 77 / 67 / 76 / 80% |

### Findings (the review's, with outcomes)

1. **Mistake cap counted Kakuro's black cells** → `maxPlausibleMistakes(grid, solution?)` counts
   only cells `0` in the puzzle and non-zero in the solution (648 → 400 on a 50-white 9×9;
   Sudoku family unchanged, optional arg so no caller breaks).
2. **Fallback sizes hardcoded** → derived from `SIZES` across the registered types.
3. **One-size type halved in the hard seat** → two draws (seating, then size); measured even.
   Killer's 33% is the older skew (no 4×4 medium seat) — recorded, not hidden.
4. **Banner label without type** → `slotLabel` from the saved variant/size.
5. **No route test for runs-vs-cages** → added.
6. **Variant union twice** → `DailyVariant` in `schema.ts`, re-exported by the registry.

### Invariants checked

No slot key, write, query or migration. **Anti-cheat:** the cap is the only rule touched; it can
only get *tighter* (a cell that is `0` in both grids is no longer counted) and only for Kakuro —
re-derived and tested in both directions. **Roller:** every day still valid under `isEligible`,
keys distinct, the Sudoku-family restriction still reproduces the pre-D4 set (the configuration
set is unchanged; only the pick changed). **Retired keys** untouched. **Trust boundary:** the new
route test mocks `@/lib/db/client` and the dailies service — the boundaries — never a module in
between (AGENTS.md §4).

### Docs sweep

Mirrored `.md` for every touched source file (`solve-rules`, `dailies.service`, `daily-row`,
`schema`, `ContinueBanner`, `api/daily/route`); plan review table + header; log journal +
Measurements. Reverse sweep for "pick one uniformly" / "Killer · medium" / "9×9 · medium" /
`[4, 6]` — the registry doc, the banner doc, the service doc; historical entries left as the
record.

### Verified vs read

- **Verified:** the table; the shares over 2 000 seeds; the cap on a hand-built 50-white board.
- **Read only:** the banner in a browser with a saved Kakuro board (the jsdom test covers the
  three label shapes; no saved Kakuro game exists in the pane's profile).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change (the mistake cap only
  tightens).
- `/code-review`: **run by the owner** (`high`) on R1; this is its follow-up, not re-reviewed.

### Lessons

- **A new row type can change what an old invariant means** — "0 = empty" was true for three
  types and silently false for the fourth; when a type encodes something new in an existing
  column, grep every reader of that column, not just the ones you changed.
- **"Uniform over valid configurations" is only uniform over what you enumerated** — when the
  enumeration multiplies one axis (sizes) into another (seatings), draw the axes separately or
  measure the marginals before calling it fair.

---

## 2026-10-01 — Kakuro R1: Kakuro in the daily — D4 locked, 4 standard + 3 minis seating 3 of 4 types

Branch `feature/kakuro-r1` on `fb9c8c6` (main, after review follow-up 8). Plan R1 step-log; D4
**locked by the owner** in the plan and the log; daily-redesign-plan's open scaling question
resolved; L25. ~120 code lines across `daily-row.ts` (sizes per type, 8 profile rows, the
general mini seating, Kakuro row mapping), `schema.ts` (`StoredKakuroRun`, the `$type` union),
`dailies.service.ts` (dispatch), `/api/daily` (runs), `useDaily`, `slot-display`; ~110 test lines;
~200 doc lines across 13 docs. **Phase 10's last slice.**

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **765 passed**, 0 failed — roller rewritten for four types (7 slots; 4 distinct rungs, all types; 3 distinct mini types; Kakuro only 6×6 in a mini; Kakuro reached in both sections over 300 seeds), the Sudoku-family restriction reproduces the old 6 configurations, per-type eligibility, the Kakuro row mapping; the service's counts/fallbacks at 7 |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Dry run (real engines, no DB) | five seeded days: 7 slots each, every profile present, **0.3–10.6 s per day**; slowest slot a 9×9 easy Kakuro at 9.8 s (walk down from a hard base) — inside the cron's 60 s |
| `db:seed` round-trip | **not run from the workstation** — see Findings |

### Findings

- **The gate's live `db:seed` round-trip was deliberately not run here.** The workstation's
  `DATABASE_URL` points at a Neon instance that is very likely the production database; a Kakuro
  row written before the serving code deploys would be read by the *old* `/api/daily` as a classic
  board of zeros for every player on that slot. The dry run exercised roll → engines → row →
  profile without the database; the real round-trip happens on the first cron after deploy.
  Recorded as L25.
- Self-caught: the pre-D4 configuration count is **6**, not 8 — the Killer-4×4-above-easy rule
  removes six of the twelve seatings, not four; the test now says why.
- Self-caught: the service test's `fakePuzzle` needed a Kakuro branch (runs, not cages), and five
  `6` literals became `7`.

### Invariants checked

- **A slot key is not an identity** — the roller still rolls `(key, variant, size)`; bests and
  attempts were already scoped on all three, and a Kakuro mini adds a third size (6) to
  `mini-easy`/`mini-medium` (previously always 4) — covered by that scoping, re-read in
  `attempts.service` rather than assumed.
- **Randomised inputs void `ON CONFLICT DO NOTHING`** — unchanged: the idempotency guard
  (never re-roll a populated day) is still the only thing that makes a retry safe; its test now
  expects 7.
- **Retired keys stay readable** — no key changed; the three mini keys and five rungs are the
  same, `LEGACY_KEYS` untouched, `difficultyForKey` untouched.
- **Ownership lives in the query** — no query changed.
- **Migrations:** none — `variant` is `text`, `cages` is untyped jsonb; `StoredKakuroRun` is a
  TypeScript shape only. Re-read: the old `/api/daily` would mis-serve a Kakuro row (see
  Findings) — the code and the first Kakuro row must ship in that order, which the cron
  guarantees.
- **AI-wrote-it, re-derived:** `miniConfigurations` restricted to the Sudoku family = the old
  `PERMS_3 × {4, 6}` set under `isEligible` (6) — asserted; `isEligible` for Kakuro: 9 ✓, 6 e/m/h
  ✓, 6 x/X ✗, 4 ✗ — asserted; every rolled combo has a profile (coverage test + dry run).

### Docs sweep

Mirrored `.md` for every touched source file (`daily-row`, `schema`, `dailies.service`,
`api/daily/route`, `useDaily`, `slot-display`, `DailyExperience`); reverse sweep for "6 boards" /
"3 standard" / "3 types" / "PERMS_3" / "before it joins the daily" / "Killer and Keisan both" —
the daily plan's model section and open question, the registry doc, the service doc, the route
doc, the experience doc; plan R1 step-log + D4 locked + header; log D4 + journal + L25 +
Measurements; roadmap (Phase 10 ✅), README table (✅ Done), project-status, Docs README. Historical
entries (the daily plan's step-logs, earlier pre-merge entries) left as the record.

### Verified vs read

- **Verified:** the table; the dry run; the configuration counts by hand.
- **Read only:** the live round-trip (deliberately — above); `/daily` in the browser with a
  Kakuro board (needs a row that only the deployed cron should write).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change (no query, no
  migration; one new stored variant value behind the same `variant` column).
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Seed into the environment that will serve it** — a workstation pointed at a shared database
  must not write rows the deployed code cannot read; dry-run without the DB, let the first cron
  after deploy do the round-trip. (L25)
- **Count a combinatorial set by hand before asserting its size** — "8" felt right and was wrong;
  the test comment now shows the arithmetic so the next change can check it in ten seconds.

---

## 2026-10-01 — Kakuro review follow-up 8: all 6 `/code-review high` findings on #123 addressed

Branch `feature/kakuro-review-8` on `d6775f7` (main, after review follow-up 7). Table in the plan
(E5 → "Review follow-up 8"); an A/B row in `kakuro-log.md`. ~70 code lines net (the objective
exported, a typed budget error with fair shares, the 503 branch, rng-safe nested options), ~45
test lines, ~60 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **762 passed**, 0 failed — 2 new (`tierDistance` ordering + non-constancy on the baked fixtures), 1 extended (typed budget error) |
| `npm run lint` | exit 0 (one unused-catch-binding warning caught and fixed before commit) |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Lean-signal A/B (15 identical seeded bases per cell) | capped solve vs top-tier step share, steps median / max: 9×9 expert 59/287 vs 47/437 · 9×9 extreme 132/338 vs 152/464 · 7×7 extreme 86/321 vs 99/388 |

### Findings (the review's, with outcomes)

1. **Over-budget batch = generic 500** → typed `KakuroBudgetError` (by `error.name`, no
   `extends` — AGENTS.md §1), route answers 503 "N of M generated, ask for fewer", warn-logged.
2. **Objective untestable** → `tierDistance` exported; fixture test pins 0 / ≥ 100 / strict
   ordering below / `lean` varies (54 vs 55 on the two hard fixtures; 71 for easy). The first
   draft of that test had one comparison inverted and failed — the test bit on itself.
3. **Winner-takes-all share** → fair share (4× average of what is left, ≥ 5 s), missed share
   retried, only the batch clock is the error.
4. **Nested `rng`** → `Omit<…, 'rng'>` on `repair` and `walk`, spread before the generator's.
5. **Free lean signal** → **measured, not adopted**: medians a wash, worst cases 20–50% longer.
6. **Redundant cast** → gone.

### Invariants checked

No slot key, write, query, migration or dependency. **Trust boundary:** the new 503 leaks only
the counts the client sent (N of M) and a fixed message — no stack, no internals (AGENTS.md §6);
the 500 path is unchanged for real faults. **Bound:** still 45 s per batch by construction; the
fair share cannot exceed what is left, and a retry only runs while the clock has time. **D8:**
unchanged — `tierDistance` is the same computation the closure made, now callable.

### Docs sweep

Mirrored `kakuro-generator.md` (exported objective + fixture values, the lean A/B), `kakuro.md`
(fair share, typed error, 503), `generate/route.md`; plan review table + header; log journal +
Measurements. Reverse sweep: "generic 500" in the review-7 entry and the E5 docs describe what was
— left as the record.

### Verified vs read

- **Verified:** the table; the fixture scores (printed for every fixture × target before the
  test was written); the A/B on identical seeded bases.
- **Read only:** the 503 under a real over-budget request (the route's branch is exercised only
  by the typed error; no route-level test injects a tiny budget — the service test covers the
  error, the mapping is three lines read twice).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** (`high`) on #123; this is its follow-up, not re-reviewed.

### Lessons

- **Export an objective, then test its ordering on known states** — a closure that "works" can
  hide a flat band for a whole slice; the fixture scores took one script to print and one test
  to pin.
- **A reviewer's free signal is a hypothesis too** — A/B it on the same seeds before adopting;
  this one cost 20–50% in the tails.

---

## 2026-10-01 — Kakuro review follow-up 7: all 6 `/code-review high` findings on E5 addressed

Branch `feature/kakuro-review-7` on `10f8944` (main, after E5). Table in the plan (E5 → "Review
follow-up 7"); L24 + an A/B row in `kakuro-log.md`. ~60 code lines net (the walk's easier band
re-keyed, `walk` options, a batch budget, the dead re-classify gone), ~15 test lines, ~70 doc
lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **760 passed**, 0 failed — 1 new (batch budget: throws at 0 ms, two-puzzle batch in ladder order), 2 adjusted (0 ms budget; `walk` cap in the seeded end-to-end) |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Up-walk A/B (15 identical seeded bases per cell, easy → target) | steps median / max, flat → tiered: 7×7 expert 35/162 → 19/208 · 7×7 extreme 98/360 → 86/321 · 9×9 expert 49/**1 832** → 59/**287** · 9×9 extreme 139/**886** → 132/**338**; 15/15 reached either way |

### Findings (the review's, with outcomes)

1. **Easier band constant** → keyed on tier distance, then on `lean(h)` (the share of cells the
   ladder capped at `h − 1` leaves undecided). Medians barely move — the plateau walk was landing
   anyway — the worst cases shrink 3–6×. The doc's old claim was a hypothesis nobody had checked
   (L24).
2. **No batch budget** → one 45 s budget per `generateKakuroBatch`, each puzzle handed what is
   left, a clean throw when spent; the route's generic 500 instead of a 504 mid-booklet.
3. **Walk cap borrowed from `repair.msCap`** → `walk?: WalkOptions`.
4. **Stale JSDoc** → rewritten.
5. **1 ms budget in the throw test** → 0 ms.
6. **Dead re-classify** → with a target the label is the target (the walk's accepting solve is
   the classifier's call); the classifier runs only without a target.

### Invariants checked

No slot key, write, query, migration or dependency. **D8 re-derived once more:** the walk accepts
a state only when `new KakuroLogicalSolver(shape).solve({ recordSteps: true })` — exactly what
`classifyKakuro` runs — reports `hardestTier === target`; the exact `isKakuroUnique` verify still
follows; the 15 generate-at-tier tests still re-classify every served puzzle independently and
pass. **Bound:** `/api/puzzle` 20 s per call; `/api/generate` 45 s per batch — both inside
`maxDuration = 60` by construction now.

### Docs sweep

Mirrored `kakuro-generator.md` (objective table, the flat-band post-mortem, the A/B table),
`kakuro.md` (batch budget), `generate/route.md`; plan review table + header; log journal + L24 +
Measurements. Reverse sweep for "gradient" / "50 −" / "re-derives the label": the E5 step-log and
pre-merge entry describe the flat band as it was — left as the record; this entry and the plan
table say what changed.

### Verified vs read

- **Verified:** the table; the A/B on identical seeded bases (the OLD objective inlined in a
  scratch script, the NEW one from the engine, same seeds).
- **Read only:** the 45 s batch budget against production CPU — the arithmetic (15–30 s dev) and
  the throw path are tested; a real 50-puzzle request has not been made.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** (`high`) on E5; this is its follow-up, not re-reviewed.

### Lessons

- **A gradient claimed in a doc is a hypothesis until the band's value has been seen to vary** —
  print the objective on a handful of states before trusting it; a walk that "works" can be a
  random walk. (L24)
- **Measure an A/B in steps as well as ms** — steps are CPU-independent and survive a test suite
  running alongside; the ms columns here were taken under load and say less than the steps.

---

## 2026-10-01 — Kakuro E5: the classifier in the objective — every puzzle fresh at the requested tier; hub card live

Branch `feature/kakuro-e5` on `cd61715` (main, after review follow-up 6). Plan E5 step-log
(with three recorded divergences from the spec); log journal + L22/L23 + Measurements; D12's
hub timing applied. ~190 engine lines net (`hillClimb` factored, `walkToTier`, the repair
recalibrated, `kakuro.ts` final form, `selectKakuroBatch` deleted), a 60-line benchmark, ~70
lines across the routes / form / configurator / hub / play seed, ~90 test lines, ~40 e2e lines,
~300 doc lines. **Over the ~400 LOC guide:** the walk and the surfaces that depend on it (no
fallback → the hub card can go live → the form's cap goes) are one change; split, the first
half would ship a generator the hub still hides.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **759 passed**, 0 failed — 15 generate-at-tier cases (every size × tier, label re-derived), budget throw, ladder map, `walkToTier` to easy and extreme on one base, route cases (6×6 batch + the 50/5 caps, negative count), a sampled soundness fuzz; the V3/E4 fixture-fallback tests replaced |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Playwright `play` + `home` | **14 passed** — the Kakuro spec at the 6×6 seed, the hub spec with the Kakuro card |
| `benchmark-kakuro.ts` (10 per cell, ms avg) | 6×6 51/104/37/60/72 · 7×7 401/158/283/403/124 · 9×9 **265/528/365/191/773** (e/m/h/x/X); 15 rows appended |
| Soundness fuzz (one-off, scratch) | **500 generated per size: 0 unsound steps, 0 label mismatches, 0 unsolved** at 6 (63 ms/puzzle), 7 (280), 9 (660) |
| Browser | hub shows the Kakuro card with `new!`; `/play?variant=kakuro` seeds 6×6 |

### Findings

- **E5 gate, honestly:** easy/hard 9×9 under 500 ms ✓ (265/365); **medium 9×9 528 ms — a near
  miss** on a 10-sample average that swings with repair-plateau tails (other runs of the same
  cell came in under 500); expert/extreme allowed slow ✓; 0 failures ✓; T4 populated ✓ (~25% of
  natural 9×9). Recorded in the step-log as a watch item, not papered over.
- Self-caught: the repair's count limit of 50 was a plateau — on 30 identical seeded 9×9 fills,
  200 + a 600-step stall cap took the cost per accepted puzzle from 2.0 s to 0.77 s (table in
  `kakuro-generator.md`). The E4 defaults were a guess; this one is measured (L23).
- Divergences from the spec, recorded in the step-log: no score bands (tiers are ordinal —
  D5′/G9), no per-tier density (the walk makes it unnecessary), the mini ships the full ladder,
  the deep link seeds 6×6.

### Invariants checked

No slot key, write, query, migration or dependency. **Trust boundaries:** `/api/generate`'s
Kakuro branch now runs the generator, so it gained the same `MAX_PUZZLES` / `MAX_EXTREME` caps as
the other variants (tested); `/api/puzzle` validates before generating as before. **D8
re-derived:** `generateKakuro` returns the classifier's label (re-derived after the walk, never
the walk's own solve), and `generateUniqueKakuro` discards a walked puzzle whose re-derived
label is not the target; the 15 generate-at-tier tests re-classify the served puzzle
independently. **Soundness surface:** the walk mutates digits under the same `hillClimb` the
repair uses (`start` never written; sums nudged and un-nudged); every generated puzzle in the
fuzz passed the placement/elimination sweep. **Bound:** one clock through layout, repair and
walk (`timeBudgetMs`, default 20 s); the routes' `maxDuration = 60` holds for a 50-puzzle 9×9
batch by the measured averages (~20–30 s) — the first time `/api/generate` does real Kakuro
work, so noted.

### Docs sweep

Mirrored `.md` for every touched source file (`kakuro.md` rewritten, `kakuro-generator.md`
gained the climb/walk/calibration sections, `benchmark-kakuro.md` new); reverse sweep for
"fallback" / "fixture" / "one per level" / "maxPerDifficulty" / "selectKakuroBatch" /
"bounded rejection" / "seeds 7" / "new! … Keisan": both route docs, the hook, PlayExperience,
PuzzleForm, DifficultyConfigurator, the fixtures doc, PuzzleHub; plan header + slice table +
D12 row; log D12 row; roadmap, project-status, Docs README.

### Verified vs read

- **Verified:** the table; the walk prototype (5 per cell, every size and tier); the repair
  calibration (identical seeded fills, 10 configs); the benchmark; the fuzz; the hub and the
  play seed in the browser pane; both e2e specs.
- **Read only:** production timing under Vercel's CPU for a full 50-puzzle 9×9 PDF (no such
  request has been made; the arithmetic says ~20–30 s inside a 60 s `maxDuration`).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change (the generate route's
  Kakuro branch gained caps, not trust).
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Put the grader in the objective** — rejection toward a 1–3% tier is a lottery with a
  fallback; a walk with a gradient inside each band is a few hundred cheap steps. (L22)
- **Calibrate an objective's cap on identical seeded inputs before accepting a default** — the
  repair's count limit was a 2.6× lever hiding in a number nobody had measured. (L23)
- **A 10-sample average at 9×9 is a band, not a point** — compare maxima and re-run before
  calling a 528 vs 500 a pass or a fail; write the near miss down either way.

---

## 2026-10-01 — Kakuro review follow-up 6: all 6 `/code-review high` findings on E4 addressed

Branch `feature/kakuro-review-6` on `f19c740` (main, after E4). Table in the plan (E4 → "Review
follow-up 6"); L21 in `kakuro-log.md`. ~70 code lines net (budget threading, `indexRuns`,
incremental sums, overlong-strip breaking, two dead checks gone), ~35 test lines, ~60 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **745 passed**, 0 failed — 3 new (budget kept at 300 ms / 200 ms; a 13×13 scatter passes the validator), 2 made deterministic |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Generator re-measure | 6×6 avg 23 ms (was 95), 7×7 133 ms (320), 9×9 **570–1456 ms across three runs of 30** (was 659) — the 9×9 figure is a band, not a point: a few repairs sit on plateaus to their cap. A/B on identical seeded fills: 0.63 → 0.60 ms/step at 7×7, 2.00 → 2.01 at 9×9 |

### Findings (the review's, with outcomes)

1. **Probabilistic test** → asserts the invariant (label = requested tier = classifier's; legal;
   unique), accepts `generated | fixture`; seeded tests get a cap no runner hits. (L21)
2. **Budget checked between attempts only** → one clock threaded into every repair; last resort
   gets one more budget; bounded by `2 × timeBudgetMs` by construction; tested.
3. **Dead checks** → removed; coin steering only for edges-inward.
4. **Index built twice** → `indexRuns`.
5. **Objective rescans per step** → sums nudged in place. **The premise overstated the gain**: the
   solution count is the step's cost; measured ~0–5%. Kept (simpler, no per-step grid copy).
6. **Scatter ignores `MAX_RUN_LENGTH`** → overlong strips broken with an interior black; 13×13
   layout test green.

### Invariants checked

No slot key, write, query, migration or dependency. The repair now mutates its working copy and
the run sums in place — re-derived: `start` is never written (copied once), the two sums through
the mutated cell are nudged by `new − old` and un-nudged on rejection, and every end-to-end test
still passes `validateKakuroRuns` (sums match the grid) and `isKakuroUnique`. The route's bound:
budget 6 s → worst case 12 s + one verify/classify, inside `maxDuration = 60` by construction.

### Docs sweep

Mirrored `kakuro-generator.md` (index, incremental sums with the honest measurement, budget,
overlong rule, measured band) and `kakuro.md` (two budgets); plan review table + header; log
journal + L21. Reverse sweep: "cannot hang past its maxDuration" in the E4 pre-merge entry was the
claim finding 2 corrected — left as the record it is (this entry says what changed).

### Verified vs read

- **Verified:** the table; the A/B on identical seeded fills; three 9×9 runs of 30.
- **Read only:** nothing new — no UI change.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** (`high`) on E4; this is its follow-up, not re-reviewed.

### Lessons

- **A test of a sampled outcome asserts the invariant, not the sample** — make the sampled part
  deterministic or assert only what holds on every runner; never park a fixable test in the
  flaky table. (L21)
- **Measure a review's efficiency claim before and after on identical inputs** — "the scan is
  on the hot path" was plausible and ~0%; the number belongs next to the fix so the next reader
  does not chase it again.

---

## 2026-10-01 — Kakuro E4: generator (scatter layouts, fill, repair-to-unique) — "New puzzle" real at 6/7/9

Branch `feature/kakuro-e4` on `0620201` (main, after review follow-up 5). Plan E4 step-log;
log journal + G3 amendment + L19/L20 + Measurements; new research record
`research/kakuro-layout-method-findings.md`. ~330 new engine lines (`kakuro-generator.ts`,
`kakuro.ts`), ~160 test lines, ~80 lines across the route / hook / board / e2e, ~250 doc lines.
**Over the ~400 LOC guide:** the generator and its entry point are one unit — a layout without
the repair is not a puzzle, and the route switch is what makes it visible; splitting would ship
an engine nothing calls.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 82 files, **742 passed**, 0 failed — 17 new (12 generator: both layout methods at every size, unreachable target → null, seed reproducibility, fill legality, repair convergence + cap, end to end 6/7/9; 3 entry point: common tier fresh, zero-budget fallbacks honest at 7×7 and 6×6, default size; 2 route) + 1 hook test retargeted to the network |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Playwright `play.spec.ts` | 7 passed (a second run clean; the first had the known `fullyParallel` flakes, retried green) — the Kakuro spec no longer reads fixture clue values |
| Benchmarks | no `human-solver`/`sudoku` change; the generator's own numbers are in `kakuro-generator.md` → Measured (6×6 95 ms avg, 7×7 320 ms, 9×9 659 ms; 0 failures in 90) |
| Browser | `/play?variant=kakuro` → 6×6 · hard → Play: a fresh generated board, header "Hard · 6×6" (the classifier's label) |

### Findings

- **Plan divergence, recorded, not improvised:** the prescribed edges-inward layout method
  repairs to unique 5/10 at 9×9 vs 10/10 for the random-pair scatter method (7×7: 7/10 @ 569 ms
  vs 9/10 @ 39 ms) — ~30% more all-white 2×2 blocks from its forced edge bands; a block-breaker
  knob did not move it. Scatter ships as the default, edges-inward stays as an option; research
  doc written before the switch was made the default.
- Self-caught: the scatter's per-placement orphan check ran the full validator (60–700 ms per
  9×9 layout, most of the pipeline) → O(1) neighbourhood check, validate once (L20).
- Self-caught: a fixed 2 s repair cap wasted 2 s on every stuck 6×6 → cap scales with N².
- Self-caught: `shuffle` mutates in place — the digit list is copied per call.

### Invariants checked

No slot key, write, query, migration or dependency. `/api/puzzle` Kakuro branch validates
difficulty against `KAKURO_LADDER` and size against `KAKURO_SIZES` before generating; the rate
limit precedes it; the generator is bounded at every level (layout attempts, fill nodes, repair
steps + wall clock, rounds, rejection attempts + budget) and the final fallback is bounded too,
so the route cannot hang past its `maxDuration`. **D8 re-derived:** every served label is
`classifyKakuro`'s — the request never becomes the label; the honest-fallback test proves it
with a zero budget at both a fixture size and a fixture-less size. **Soundness surface:**
generated puzzles pass `validateKakuroRuns` and `isKakuroUnique` in every end-to-end test; the
label path is the existing classifier, untouched.

### Docs sweep

New mirrored `kakuro-generator.md` and `kakuro.md`; `usePuzzle.md`, `PlayExperience.md`,
`route.md` (puzzle) updated; reverse sweep for "no generator yet" / "hand-made" / "served from
fixtures" — the board's visible copy, the hook doc, the PlayExperience comment and doc, the
plan header and slice table, project-status, roadmap, Docs README; `/api/generate`'s
`selectKakuroBatch` left as is (E5 switches it — recorded as owed).

### Verified vs read

- **Verified:** the table; every yield number (scratch scripts, three sizes, both methods); the
  board in the browser pane; the Kakuro e2e twice.
- **Read only:** production behaviour of the rejection budget under Vercel's CPU (the 6 s budget
  is well inside `maxDuration = 60`; the fallback rate is logged as `source` for E5 to read).

### Review statements

- `/security-review`: **not run** — a new validated branch on the existing unauthenticated,
  rate-limited route; no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Adopt a published method only after checking its objective is yours** — build it, measure
  it against the stand-in, keep both behind a knob. (L19)
- **A validator inside a placement loop is O(N²) per placement** — check the neighbourhood,
  validate once. (L20)
- **Scale a wall-clock cap with the problem size** — one cap for 6×6 and 9×9 either starves
  the large or stalls the small.

---

## 2026-10-01 — Kakuro review follow-up 5: all 8 `/code-review high` findings on V3 addressed

Branch `feature/kakuro-review-5` on `99d97b9` (main, after V3). Table in the plan (V3 → "Review
follow-up 5"); L18 in `kakuro-log.md`. ~90 code lines net (a service, a shared digit helper, the
ladder constant, the active-size prop), ~40 test lines, ~60 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 80 files, **725 passed**, 0 failed — 5 new (route defaults + non-numeric count; `selectKakuroBatch` ×2; the note derived from the ladder) |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Rendering | classic solution grid, Keisan answer grid and the Kakuro 9×9 answer page re-rasterised after `drawCenteredDigit` — identical placement; `kakuro-sample.pdf` regenerated byte-identical, so not re-committed |
| Benchmarks | not applicable |

### Findings (the review's, with outcomes)

1. **"9×9 only" note read classic's size for every variant** → the form passes the active
   variant's size; the note derives from the ladder offered. Pre-existing since Killer (wrong in
   both directions); V3 had layered a Kakuro exception on it.
2. **One-per-level clamped ×3** → submit-time clamp removed.
3. **`isWhite` vs `whiteMaskOf`; centring ×3** → reused / one helper.
4. **Selection in the route** → `selectKakuroBatch` service (AGENTS.md §1).
5. **`variant` inside the logged `counts`** → five numbers under `counts`.
6. **Puzzle page ignored `grid`** → honoured like the other renderers.
7. **Schema defaults untested** → two route tests.
8. **Ladder typed ×3** → `KAKURO_LADDER` / `KakuroLevel` in `kakuro-types.ts`.

### Invariants checked

No slot key, write, query, migration or dependency. Trust boundary unchanged (same Zod schema;
the service runs after validation and throws only on a programmer error the schema already
prevents — tested). `DifficultyConfigurator`'s `gridSize` widened to `SelectableSize`; the 7×7
fallback row exists only for Kakuro, which always passes `difficulties` explicitly.

### Docs sweep

Mirrored `.md` for all 7 touched source files; plan review table + header; log journal + L18.
Reverse sweep for "one()" / "KAKURO_DIFFICULTIES" / "KAKURO_LEVELS" / "findKakuroFixture per
level" — only the three mirrored docs named them; fixed there.

### Verified vs read

- **Verified:** the table; the three re-rasterised grids; the byte-identical sample.
- **Read only:** the browser — the form's visible change is the note's condition, covered by the
  jsdom test both ways.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** (`high`) on V3; this is its follow-up, not re-reviewed.

### Lesson

- **A prop every caller passes from the same stale variable is a bug waiting for its third
  caller** — when a shared component's input only makes sense per caller, pass the caller's
  value and derive the display from what is actually offered. (L18)

---

## 2026-10-01 — Kakuro V3: printable Kakuro — renderer, booklet, `/api/generate` branch, form toggle

Branch `feature/kakuro-v3` on `18a8c70` (main, after review follow-up 4). Plan V3 step-log;
log journal. ~150 code lines (`drawKakuroGrid` + `generateKakuroPDF`, the Zod-validated route
branch, the form section, `maxPerDifficulty` on the configurator, the clue helpers moved into
the engine), ~25-line preview script, ~90 test lines, a 38 KB sample PDF, ~150 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 80 files, **720 passed**, 0 failed — 6 new (PDF parity + page count; route happy path/filename, count > 1, Sudoku-family size, all zeros; the form's Kakuro path incl. the state clamp) |
| `npm run lint` | exit 0 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Playwright `home` + `a11y` (the `/generate` specs) | 28–30 passed; the `/daily` confirm-modal responsive test was flaky in both runs (passed on retry) — the known `fullyParallel` server-contention flake, not this diff |
| Benchmarks | not applicable — no solver change |
| Dev server | `POST /puzzles/api/generate` `{variant:'kakuro', gridSize:9, easy/medium/hard:1}` → 200 `application/pdf` 13.7 KB; `easy:2` → 400 "at most 1 puzzle per level"; `gridSize:6` → 400 "must be 7 or 9" |

### Findings

- None open. One self-caught in the browser: switching to Kakuro left the inputs showing `2`
  against `max=1` (the clamp was submit-only) → counts clamped in state on the toggle as well;
  test asserts the input reads 1.

### Invariants checked

No slot key, write, query, migration or dependency (`zod` was already a dependency; first use in
this route). **Trust boundary:** the Kakuro branch is the route's first Zod-validated body —
size and counts are rejected with a message before anything renders; no generation runs, so the
Extreme/total caps do not apply and the schema's `max(1)` is the only ceiling. **Visual:** the
7×7 easy puzzle page and the 9×9 easy answer page rasterised and checked by eye (gutter, shaded
blocks, diagonals, down sum upper-right / across sum lower-left, digits centred). The clue
picture now has one source (`buildClues` in the engine) for board and paper; the board's tests
pass unchanged through the re-export.

### Docs sweep

Mirrored `.md` for all 9 touched source files + `preview-kakuro.md` (new); samples README; the
reverse sweep for "V3 (PDF) … next" / "V3 stays queued" (plan header, step-log title, roadmap,
project-status ×2, Docs README) — E1's "taken ahead of V3" lines are history and stay.

### Verified vs read

- **Verified:** the table; both rasterised pages; the three curl cases; the form in the browser
  pane (toggle, sizes, clamped counts).
- **Read only:** the download itself in the browser (not clicked — a download needs the owner's
  go-ahead); the `curl` response is the same bytes.

### Review statements

- `/security-review`: **not run** — a new validated read-only branch on an unauthenticated,
  rate-limited route; no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **`sips`/QuickLook render only a PDF's first page.** To eyeball page N, draw that page alone
  with the renderer (a scratch script in the repo tree so `pdfkit` resolves) and rasterise that —
  cheaper than installing poppler, and it checks the renderer, not the booklet loop.
- **Move a helper on its second consumer.** The clue picture lived in board code until the PDF
  needed it; the board's own doc had already called it a puzzle concept.

---

## 2026-10-01 — Kakuro review follow-up 4: all 8 `/code-review high` findings on #115 + #116 addressed

Branch `feature/kakuro-review-4` on `cc9a953` (main, after E3). Table in the plan (E2b → "Review
follow-up 4"); B9 + L17 + a Measurements row in `kakuro-log.md`. ~220 code lines (the chain
engine's propagation pulled into a class over a shared workspace), ~90 test lines, two re-baked
fixtures, ~120 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 80 files, **714 passed**, 0 failed — 4 new (both g-link directions on raw contexts, inconsistent context, the original 7×7 pinned at 3) + 2 rewritten (bound, contradiction run) |
| `npm run lint` | exit 0 |
| `npm run build` | green (after one TS fix in a test: `Run.id` is a number) |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not the tiered benchmark (no `human-solver`/`sudoku` change); ad hoc, same puzzles before/after: 9×9 corpus classify **31.6 → 16.9 ms**, 7×7 corpus 3.7 → 4.1 ms, served extremes ~9 / ~18 ms |

### Findings (the review's, with outcomes)

1. **g-link one-way** (B9) → both directions in `scan()`, facts included. This changed the
   grades: `*_CHAINS` need 3 (was 4), the experts 2–3, the two served extremes 3–4 → **graded
   expert**, re-searched (0.3 s / 50 s) and re-baked at chains of 5 / 6. Corpus regrade (fresh
   repaired fills, graded by both engines): 7×7 unrated 2 → 0, extreme 9 → 4 of 36; 9×9 unrated
   5 → 3, extreme 8 → 8 of 23. Bound of 4 still splits the tiers; the ceiling of 12 is still
   reached at 9×9 — stays E5's question.
2. **Facts fixpoint per target** → established once in `prepareChainWorkspace`, snapshot restored
   per target. Also seeds every open variable into the first scan so a raw context's g-link facts
   are found (the fixture tests never needed it; the hand-built tests did).
3. **D5′ row stale / §3e "add g-whips"** → D5′ reworded and marked confirmed with D6′; §3e has a
   dated addendum with the regrade; §6 counts fixed.
4. **Unreachable "forced two ways" branch** → asserting a forced truth throws if it fails.
5. **`contradictionRun` test weak; cell branch untested** → asserts on the contradiction clause
   only, both kinds found on the 9×9 original.
6. **Inconsistent context "proves" things** → `ChainWorkspace.inconsistent`; all targets `null`.
7. **§6 13×13 counts** → fixed.
8. **`trueCombo` zeroed on a fresh workspace** → `fill(-1)`.

### Invariants checked

No slot key, write, query, migration or dependency. Soundness surface touched, so re-run: the new
links re-read (the contrapositive "no holder → combination false" and the forward "required digit
with one holder → placed" are both the g-link's definition, sound for any true combination;
falsifying a combination is not a forced truth so it does not count toward the length); "suppose
the truth at every white cell → never a contradiction" on all 12 fixtures (incl. the re-baked
extremes); placement/elimination sweeps on fixtures + random unique grids — all green. Re-derived
by hand: a forced truth the scan returns is still open by construction, so the throw in (4) is an
invariant, not a reachable error path.

### Docs sweep

Mirrored `.md` for `kakuro-chains.ts` (model, facts, workspace, measured) and
`kakuro-fixtures.ts`; reverse sweep for "one-way"/"no g-link"/"exactly 12" — the plan's "Noted:
exactly 12" paragraph carries a closed note (not rewritten), the log's D5′ row and findings §3e
updated, `project-status.md` and the plan header moved on.

### Verified vs read

- **Verified:** every number above (bound2/bound3/regrade scripts in the session scratchpad);
  both corpora graded by both engines on identical puzzles.
- **Read only:** the browser — no UI change.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** (`high`) on #115 + #116; this is its follow-up, not
  re-reviewed.

### Lessons

- **A one-way link is half a link.** Before setting a bound from chain lengths, list every link
  of the model and check each is applied in both directions — the bound, two fixtures and a
  measured distribution were all built on the half. (L17)
- **A review finding that changes a rating is a re-measurement, not a fix.** Keep the generation
  script and grade the same corpus with both engines before and after; "all tests pass" said
  nothing here until the extreme fixtures failed their own label.

---

## 2026-10-01 — Kakuro E3: yield measurement spike (docs only)

Branch `feature/kakuro-e3` on `132e24a`. **No `.ts`/`.tsx` touched** — the measurement script
lives in the session scratchpad by design (plan E3: "throwaway, not committed"; §6 of the
findings doc says how to regenerate). Lands `Docs/research/kakuro-feasibility-findings.md`
and the decisions it settles (D6′ sizes, G6) in the plan, log, index, roadmap and status.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`) | exit 0 |
| `npx vitest run` · `npm run lint` · `npm run build` | not run — docs only; nothing under `src/` changed |
| Benchmarks | the spike *is* the measurement: 10 size × density configs, 2,000 random fills, ~190 repair climbs |

### Findings

- The plan's E3 gate had three parts: **9×9 < 1 s passes at ≥ 34% black** (fails at 29%);
  **mini < 200 ms passes** (3–24 ms); **13×13 < 5 s fails** (0/3 repairs in 60 s at 33%, 1/3 in
  32 s at 39%) — deferred per the plan's own rule, not a re-slice.
- The first 13×13 attempt ran **unbounded for 52 minutes** before being stopped: its objective
  (count up to 50 solutions of a 103-cell grid) burnt the node budget on every step. Re-run with
  a 60 s cap per attempt in 6 minutes — same answer. L16.
- The stand-in layout generator **saturates near 34% black at 9×9**, so the high-density 9×9
  regime is unmeasured; recorded as the findings' open question 1 for E4.

### Invariants checked

None apply (no code). Numbers in the doc were copied from the script's JSON output, not
retyped; the two 7×7 fixture-era measurements already in the log were left as they are.

### Docs sweep

New research doc; plan D6 row + E3 step-log + slice table; log journal, D6′, G6, L15/L16, a
measurement row; `Docs/README.md` status; roadmap and project-status lines. Reverse sweep for
"E3 next" / "mini pending E3" / "6×6 or 7×7": all live hits updated.

### Verified vs read

- **Verified:** every number by the script's own output (saved in the scratchpad results file).
- **Read only:** nothing — but the layouts were *random*, not the plan's edges-inward ones, so
  the yield figures are for a stand-in generator and E4 must re-measure on its own layouts.

### Review statements

- `/security-review`: **not run** — docs only.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it (and there
  is no code in this PR).

### Lesson

- **Give a measurement loop a wall-clock cap before the size you expect to be slow**, not after
  it has been running for an hour.

---

## 2026-10-01 — Kakuro review follow-up 3: all 8 `/code-review` findings on E2b addressed

Branch `feature/kakuro-review-3` on `d0baa0c` (main, after E2b). Table in the plan (E2b → "Review
follow-up"); B8 in `kakuro-log.md`. ~245 code lines (the chain engine rewritten around a shared
workspace), ~60 test lines, ~70 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 80 files, **710 passed**, 0 failed — 3 new (bound off-by-one, contradiction run, length-0 facts case) + 1 retargeted |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run; ad hoc: both original chain fixtures 25 → 19 ms, extreme 7×7 35 → 30 ms, extreme 9×9 32 → 17 ms after the workspace change |

### Findings (the review's, with outcomes)

1. **Combos re-filtered per target** → one workspace per step (`prepareChainWorkspace`).
2. **Facts pre-pass not iterated** (B8) → facts to a fixpoint (runs, cells, and what they force).
3. **Chain step's `run` arbitrary** → `contradictionRun` recorded; tested.
4. **Tests reached a private via cast** → `chainContext()` public.
5. **Per-candidate allocation** → same workspace.
6. **No g-link** → in the scan: a true combination's digit with no holder is a contradiction,
   with one holder it is forced. Every fixture keeps its tier and every soundness sweep stays
   green; the 7×7 extreme's chains re-route and one is now exactly 12 — the tier-5 ceiling.
   Recorded in the plan and log as something E5's distribution must look at.
7. **Lock rule ×3** → `topTiersLockedFor(variant, size)`.
8. **Ceiling untested** → a test learns a chain's length L on the extreme 7×7 and asserts bound
   L finds it, bound L − 1 does not.

### Invariants checked

No slot key, write, query, migration or dependency. The rewrite touched the engine's soundness
surface, so the three checks from the E2b entry were re-run unchanged: links re-read (the new
g-link is the "required digit must land somewhere" implication, sound by the definition of a
true combination), "suppose the truth at every white cell → never a contradiction" on all 12
fixtures, and the placement/elimination sweeps on fixtures + random unique grids. Also re-read:
a raw-context target that the facts already exclude now returns a length-0 chain rather than
`null` — an elimination the solver would have made at tier 1, never an unsound one.

### Docs sweep

Mirrored `.md` for the 4 touched source files; "g-whips left out" removed from the chain doc;
plan review table, log journal + B8.

### Verified vs read

- **Verified:** the table; all 12 fixtures re-graded with identical tiers and 0 unsound steps.
- **Read only:** the browser (unit + e2e-level only).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** on E2b; this is its follow-up, not re-reviewed.

### Lesson

- **A per-call "prepare" inside a function that is called in a loop is a hoist waiting to
  happen** — give the loop a workspace argument from the start when the prepared data is a
  function of state the loop does not change.

---

## 2026-10-01 — Kakuro E2b: forcing chains (tiers 4–5), full ladder served at both sizes

Branch `feature/kakuro-e2b` on `7e42ef1` (main, after review follow-up 2). New:
`kakuro-chains.ts` (the redundant-variable model and the forcing-chain search), two ladder
techniques (`shortChain` T4 ≤ 4 links, `longChain` T5 ≤ 12), four new served fixtures (expert /
extreme at 7×7 and 9×9), the two original fills graded expert, the Kakuro menu unlocked at every
level. ~340 code lines, ~155 test lines, ~185 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 80 files, **707 passed**, 0 failed — 17 new/rewritten (chain engine 4, tier separation 1, classify/stall/hint rewrites, fixtures) |
| Playwright `e2e/play.spec.ts` (Kakuro spec, dev server) | passed (now asserts expert/extreme enabled at 7×7) |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | none exist for Kakuro yet (E5). Measured ad hoc: classify ~7 ms (expert), ~35 ms (extreme 7×7); hint ~1 ms; both chain fixtures ~25 ms |

### Findings

None blocking. Established while building:

- **Both original fills need chains of exactly 4** after the tier-3 standstill (not 3 — tested
  at bounds 1..8), so `CHAIN_TIER4_MAX_LENGTH = 4` sits on the measured edge. Provisional until
  E5's distribution; the four searched expert/extreme fills (chains 4 / 6, 10 / 4 / 8, 7) agree.
- **A raw chain context missed a chain** that depended on a run with a single combination the
  masks did not yet reflect — the 3×3 unit test caught it. Single-combination runs are now
  asserted as facts before the supposition (not counted), and a target the facts already exclude
  is a chain of length 0.
- **The 7×7 extreme was the first random fill the search tried** (0.07 s): at this layout,
  "needs long chains" is not rare — the easy ones were the hard search (L7 reversed for the top
  tier). Logged under Measurements.

### Invariants checked

No slot key, write, query, migration or dependency. Soundness of the chain engine is the risky
AI-written logic; checked three ways: (1) every link in `assertCell`/`assertRun` re-read against
the binary model (digit vs other digits of the cell, digit vs same digit in run-mates, digit vs
combinations lacking it; combination vs other combinations, combination vs digits outside it);
(2) a direct test supposes the TRUE digit of every white cell on all 12 fixtures at the tier-3
standstill and asserts no chain is ever found; (3) the existing soundness sweeps (every placement
= solution, no elimination removes a solution digit) now run with chains enabled on all fixtures
and random unique grids. D10 (no guessing): a chain is suppose-and-derive over sound links to a
contradiction — a proof — and the solver still never branches.

### Docs sweep

Mirrored `.md` for the new module and the 7 touched ones. Reverse sweep for "chains not built
yet" / "E2b … next" / "beyond tier 3": badge, hook, menu and solver docs updated; plan status and
slice table; log D5′ applied, journal, L14, two measurement rows; roadmap + project-status lines.
D5′ remains "owner confirmation open" on the braid-not-whip reading.

### Verified vs read

- **Verified:** the table; in the browser — extreme 7×7 from the picker, header "extreme · 7×7",
  badge "ladder: extreme (tier 5) … shortChain×5 longChain×2".
- **Read only:** a chain-based hint in the browser (explanations checked in node only); light
  theme.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lesson

- **Test a chain engine by supposing the truth.** "Suppose the solution's digit at every cell and
  assert no contradiction is ever derived" is a one-loop test that catches any unsound link, and
  it is far cheaper than reasoning about each link's soundness in review.

---

## 2026-10-01 — Kakuro review follow-up 2: 7 of 8 `/code-review` findings on E2a fixed, 1 recorded

Branch `feature/kakuro-review-2` on `2c63408` (main, after E2a). The owner ran the hosted
`/code-review` over #112 and asked for the same treatment as last time. The finding-by-finding
table is in the plan (E2a → "Review follow-up"); B6/B7 and L13 in `kakuro-log.md`.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 79 files, **690 passed**, 0 failed — 4 new/rewritten (hidden-pair positive case, complete-run contradictions, two preferred-cell cases on the chain fixture) |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run — the exact solver is untouched; the logical solver's per-step cost is the deferred finding below |

### Findings (the review's, with outcomes)

1. **Detoured hint explained a board the player didn't have** (B7) → no detour by default.
   Replacing it with "honour the selection only if it is the very next placement" would have
   lost most selected-cell hints (cell order decides which of several singles goes first), so
   preferred-cell mode now runs **eliminations ahead of placements** and places the preferred
   cell the moment it is deducible — every lead-up line is then true of the visible board.
2. **Complete-but-wrong runs never contradicted** (B6) → constructor validation; tested.
3. **No positive `hiddenSubset` test** → a hand-built 28-in-four case (required {8,9}); it also
   turned out that eliminations-first mode fires the hidden pair live on the chain fixture.
4. **Per-step rescan cost** → **skipped, recorded** in `kakuro-logical-solver.md` ("Known cost,
   deferred to E5"): ~6 ms per 9×9; E5's < 500 ms gate decides whether the dirty-flag rewrite is
   needed.
5. **Recording side-channel in `step()`** → techniques return the step.
6. **Fourth mask→digits copy** → `grid-utils.maskToDigits`, re-exported by `board-utils`.
7. **Non-null assertion** → removed.
8. **Badge ran four solves; `classifyKakuro` always measured** → `metrics` opt-in.

### Invariants checked

No slot key, write, query, migration or dependency. Re-derived: the eliminations-first ordering
cannot change *what* is deduced, only the order (every elimination is sound on its own), so the
hint's technique attribution stays honest; the constructor's new checks only ever set
`contradiction`, never place or eliminate. The soundness sweeps (all fixtures + random unique
grids) still pass unchanged.

### Docs sweep

Mirrored `.md` for the 6 touched source files (`grid-utils.md`, `board-utils.md` gain the shared
helper). Reverse sweep for "detour" / "short detour": store doc and solver doc rewritten;
historical entries left. Plan: review table under E2a; log: journal, B6, B7, L13.

### Verified vs read

- **Verified:** the table; the preferred-cell behaviour on the chain fixture ((3,6) honoured over
  (3,5); an unreachable preference lands elsewhere with no phantom placements).
- **Read only:** the browser (unit + e2e-level only this time).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** on E2a; this is its follow-up, not re-reviewed.

### Lesson

- **"Prefer the selected cell" is an ordering question, not a search question.** The honest
  implementation reorders *eliminations* ahead of other placements; detouring through
  placements the board doesn't have is the tempting wrong answer.

---

## 2026-10-01 — Kakuro E2a: logical solver T1–T3, classifier, metrics, scorer, explained hints

Branch `feature/kakuro-e2` on `ca373a8` (main, after the review follow-up). E2 re-sliced into
E2a (this) and E2b (the chain engine, next). New: `kakuro-logical-solver.ts`, `kakuro-score.ts`,
`HintNote.tsx`; fixtures re-cut to easy/medium/hard per size (+ the two originals as `*_CHAINS`
test fixtures); the Kakuro menu gets the difficulty picker, the header the classifier's grade,
the Hint a named technique with a lead-up. ~1,150 non-test code lines (the solver is ~620 of
them), ~325 test lines, ~280 doc lines — **well over the ~400 guideline**; the eight techniques,
the classifier and the fixtures that prove tier separation are one unit, and the hint wiring is
the visible acceptance. E2b will be its own slice.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 79 files, **686 passed**, 0 failed — 35 new (logical solver 15, fixtures 4 reworked + 2, store 0 changed, badge 2, hook 0 changed, e2e 1 extended) |
| Playwright `e2e/play.spec.ts` (dev server) | **9 passed** incl. the Kakuro spec, now asserting the grade in the header and the explained hint |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | none exist for Kakuro yet (plan: E5). Measured ad hoc: classify a 9×9 ≈ 6 ms; the exact solver's search was not touched |

### Findings

- **B5 (fixed before any test existed):** the first hidden-pair draft was unsound — it borrowed
  Sudoku's "every digit is present in the unit" assumption, which a Kakuro run does not have —
  and placed a wrong digit on the 7×7 on the very first run. Caught by running the solver on the
  fixtures and checking every placement against the solution *before* writing tests; the rule
  now only considers digits every remaining combination requires, and soundness tests pin it.
- The original two fixtures are **not finishable by T1–T3** (27 / 29 cells undecided). Not a bug
  — they were hill-climbed for uniqueness only — but it meant the ladder could not grade a single
  served puzzle. Resolved by hill-climbing new fills with the ladder itself as the objective
  (one per tier per size); the originals stay as E2b's acceptance material.
- The random-grid soundness fuzz found only ~2 unique grids per 120 trials; the loop now caps at
  1,500 trials and stops at 30 unique (sub-ms each, ~0.3 s total) — budgeted up front per the
  previous entry's lesson.

### Invariants checked

No slot key, write, query, migration or dependency. AI-written logic re-derived where it could be
plausible-but-wrong:

- **Soundness, mechanically:** for every fixture and ~30 random unique grids, every placement
  equals the solution and no elimination removes the solution's digit at that cell. This is the
  test that would have caught B5.
- **Tier separation is real, not nominal:** the medium 7×7 is *not* solved with `maxTier: 1`, the
  hard 7×7 *not* with `maxTier: 2` (tested) — so "hard" means tier-3 work was necessary.
- **Labels cannot drift:** every served fixture's baked `difficulty` is re-derived by
  `classifyKakuro` in a test.
- **The "required" guard** on hidden single/pair re-read against the combination semantics: a
  digit in the AND of all open combinations must be placed in the run; a digit in only some need
  not be. Locked candidates deliberately omitted (two runs meet in one cell → hidden single).
- **Hint honesty:** the explained hint is still checked against the solution before placing
  (unchanged from E1/review), and the `preferCell` detour includes the earlier placements in the
  lead-up rather than hiding them.

### Docs sweep

Mirrored `.md` for all 13 touched/new source files. Reverse sweep for `KAKURO_FIXTURE_7X7` /
`KAKURO_FIXTURE_9X9` (renamed `*_CHAINS`): tests repointed; `kakuro-fixtures.md` rewritten;
historical step-logs left. "Placeholder difficulty" wording removed from the hook, header and
menu docs. Plan: E2 split, E2a step-log, slice table; log: journal, B5, L12, two measurement
rows; roadmap + project-status lines.

### Verified vs read

- **Verified:** the table; in the browser — hard 7×7 from the picker, header "hard · 7×7", two
  Hints with the note and a 14-step lead-up, dev badge's three lines; fresh console clean.
- **Read only:** the 9×9 fixtures in the browser (unit + classify only); light theme.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Run a new solver against the answer before writing its tests.** A soundness sweep over the
  fixtures (every placement vs the solution) costs one script and caught B5 in seconds; unit
  tests written from the same misunderstanding would have passed.
- **When a fixture cannot exercise the thing you built, search for one with the thing itself as
  the objective.** The ladder graded nothing until the hill-climb scored fills by "cells the
  ladder leaves undecided"; that also yielded a clean tier-separation test for free.

---

## 2026-10-01 — Kakuro review follow-up: all 10 `/code-review` findings addressed

Branch `feature/kakuro-review-1` on `da59eee` (main, after E1). The owner ran the hosted
`/code-review` (high effort) over the four merged Kakuro slices V0–E1 and asked for the fixes and
for *everything to be noted*. The full finding-by-finding table lives in the plan
(`kakuro-implementation-plan.md` → E1 → "Review follow-up"); B2–B4 and L10–L11 in `kakuro-log.md`.
~190 code lines, ~180 test lines, ~120 doc lines.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 78 files, **651 passed**, 0 failed (two consecutive full runs) — 8 new tests: hydration ×2, hint ×1, zero-run ×1, min-hints ×1, hook ×2, run lookup ×1 |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run — the solver's search was not changed (popcount import, zero-run guard only) |

### Findings (the review's, with outcomes)

1. **Hydration untested** → `useBoardStore.hydration.test.tsx` (snapshot storage → wipe →
   `persist.rehydrate()` → read derived fields). **Proven to bite:** deleting the `merge` rebuild
   fails the Kakuro case. Gotcha worth the write-up: `persist` writes on every `setState`, so the
   wipe itself overwrites the saved game — snapshot first, put it back after.
2. **Placeholder "Medium" shown as a grade** → "unrated" in the header and Continue label.
3. **Zero-run shape counted as 1 solution** (B3) → 0 / contradiction up front.
4. **Min-hints floor counted dead blacks** (B4) → counts black cells heading a run.
5. **Private `popcount`** → `grid-utils.popcount`.
6. **Empty `if (target) {}`** → `if (!target)` wrapper.
7. **`as Variant` cast** → `isDailyVariant` guard + visible fallback.
8. **Hint abandoned all forced cells on the first mismatch** (B2) → first agreeing forced cell.
9. **Unknown Kakuro size silently served the 7×7** → `error` + `null`.
10. **Peer highlight scanned the peer list per cell** → `cellToRuns` + `shareRun`, O(1).

### Found while running the gate

- The E1 fuzz test (solver vs brute force, 150 random grids) **timed out at 30 s in two
  consecutive full-suite runs** while passing in ~5 s solo — the documented worker-contention
  flake class, not a miscount. Fixed at the source rather than the ceiling: 60 trials, white
  cells capped at 11, now ~0.3 s of test time solo. Not added to the Known flaky tests table
  because it no longer flakes; recorded here so the next 5-second fuzz gets budgeted up front.

### Invariants checked

No slot key, write, query, migration or dependency. The `isDailyVariant` fallback was re-read for
the "slot key is not an identity" rule: it only changes what label a board gets when its variant
is unregistered, never which board is loaded. The hint change was re-derived: the agreement
check now runs per candidate, and the test plants a consistent-but-wrong digit and asserts exactly
one new placement that equals the solution.

### Docs sweep

Mirrored `.md` for all 10 touched source files (`daily-row.md` gains `isDailyVariant`). No symbol
removed; `minInteriorBlacks` → `minInteriorHints` is internal. Plan: E1 ✅ + the review table;
log: journal, B2–B4, L10–L11.

### Verified vs read

- **Verified:** everything in the table; the hydration test's break-run; three solo timings of the
  trimmed fuzz test.
- **Read only:** the header/Continue "unrated" copy in the browser (unit-level only).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **run by the owner** on V0–E1 (this PR is its follow-up); **not** re-run on this
  diff — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Budget a fuzz test by its worst case, not its average** — 9^whites brute force at 70% white on
  a 4×4 was fine solo and a timeout under load. Cap the input, not the timeout.
- **Prove a new regression test bites** before trusting it (standing lesson, applied): the
  hydration test was run once with the rebuild deleted.

---

## 2026-10-01 — Kakuro E1: exact solver, uniqueness proven, solver-driven Hint

Branch `feature/kakuro-e1` on `bb7eaca` (main, after V2). Taken ahead of V3 (PDF) — see the plan's
E1 step-log for why. New: `kakuro-combinations.ts` (a view over the Killer table), `kakuro-solver.ts`
(propagation + MRV search + deduction), `KakuroDevBadge`; the store's `hint` prefers a
solver-deduced cell for Kakuro. ~470 non-test code lines, ~330 test lines, ~330 doc lines —
**over the ~400 guideline**; the solver and its fuzz/degenerate tests are one unit, and the hint
wiring is the slice's visible acceptance (plan L5).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 77 files, **643 passed**, 0 failed — 23 new (combinations 5, solver 14, store 3, badge 1) |
| `npm run build` | green |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | `benchmark-kakuro.ts` does not exist yet (plan: E5). Measured ad hoc: uniqueness verify **0.12 ms** avg on both fixtures (7×7: 13 nodes, 9×9: 11 nodes), 200 runs after warm-up — the plan's gate was 50 ms. Recorded in `kakuro-log.md` → Measurements |

### Findings

None blocking. Two things established while building:

- Propagation alone solves the 3×3 test puzzle outright, so the "hint prefers a deduced cell over
  the first empty cell" test could not be written on it — it uses the 7×7, where exactly two
  cells are forced from empty and neither is in row 0.
- A hint from the solver **must be checked against the solution** before placing: from a board
  holding a wrong entry, propagation can force a digit consistent with the mistake. `hint` now
  does; a test plants a 9 in a 4-in-two run and asserts the fallback reveal.

### Invariants checked

No slot key, write, query, migration or dependency. AI-written logic re-derived:

- The feasibility filter is **necessary, not sufficient** (no one-to-one matching check) — stated
  in the doc; soundness is covered by the 150-grid fuzz against an independent brute force that
  shares nothing with the solver but the run list, requiring *exact* counts (up to 50), and by
  "every forced digit equals the baked solution" on both fixtures.
- The ring-buffer queue cannot overflow: a run is queued at most once at a time (`queued` flag),
  so ≤ `runs.length` entries are ever pending — the buffer is exactly that size.
- Duplicate-fixed-digit detection, the all-different strip excluding the cell's own fixed bit, and
  the re-queue after a mid-loop fix were each re-read after an earlier draft of the loop had a
  garbled no-op in it (caught on re-read before any test ran).

### Docs sweep

Mirrored `.md` for the three new source files; `useBoardStore.md`, `PlayExperience.md`,
`kakuro-fixtures.md` updated ("uniqueness proven in-repo" replaces "not yet proven"). Reverse
sweep: the V1 step-log's "owed to E1" and the earlier pre-merge entries are historical and left.
Plan E1 step-log; log journal, L9, measurement; roadmap + project-status lines.

### Verified vs read

- **Verified:** the table above; in the browser — badge reads "unique ✓ · 13 nodes" (a first draft also showed ms; `react-hooks/purity` rejects `performance.now()` in render and CI caught it — my local lint run had its errors hidden behind a `tail -1`),
  three Hints place (3,5)=4, (3,6)=2 then (0,2)=6, resume keeps them, fresh tab has no console
  errors. (An error seen in the original tab was stale console history from before the V2 merge
  fix — confirmed by opening a fresh tab.)
- **Read only:** light theme; the 9×9 hint path in the browser (unit-tested only).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lessons

- **Never pipe `npm run lint` through `tail`/`head`.** eslint prints its errors *above* the final
  blank line; `| tail -1` showed only the script banner and read as a pass. CI caught two
  `react-hooks/purity` errors the local run had hidden. Check the exit code, or capture the whole
  output and grep it.
- **The browser pane's console history survives navigation.** Before attributing a console error
  to the current code, reproduce it in a fresh tab; otherwise a fixed bug keeps "failing".

---

## 2026-10-01 — Kakuro V2: playable on the real board at `/play?variant=kakuro`

Branch `feature/kakuro-v2` on `c69a795` (main, after V1). `'kakuro'` joins the board store, the
play menu, the puzzle hook, Board/Cell/Numpad and the rules dialog; the V0/V1 workbench route
and static `KakuroBoard` are deleted. ~1,110 code lines of which ~320 are tests and ~360 are the
deletions, so ≈ 430 net new non-test lines — **over the ~400 guideline by a little**; the board,
store and menu must change together for the type to be playable at all.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 74 files, **620 passed**, 0 failed — 17 new (board utils 6, store 6, Board 4, Numpad 1) |
| Playwright `e2e/play.spec.ts` (dev server) | **9 passed** incl. the new Kakuro spec (gutter, 64 cells, 1–9 numpad, blocked cell refuses input) |
| `npm run build` | green; `/kakuro` gone from the route list |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run — no solver/generator core touched |

### Findings

- **B1 (fixed in this PR):** a resumed Kakuro came back all-white with no clues. The store
  rebuilt derived fields in `onRehydrateStorage` by *mutating* state after hydration's `set`;
  no subscriber is notified, so already-rendered cells never re-read them. Latent for Killer's
  `cellToCage` since July. Fixed by deriving in persist's `merge`. Found by the reload step of
  the browser check, not by a test — the store tests never hydrate from storage.
- `npm run lint` from the main checkout was drowning in ~440 errors from a sibling session's
  worktree build output (`.claude/worktrees/*/.next`); `eslint.config.mjs` now ignores
  `.claude/worktrees/**`. Environmental, but it would have hidden a real lint error.

### Invariants checked

No slot key, write, query, migration or dependency. The daily's `playingLabel` now narrows the
store's `PuzzleVariant` to the registry's `Variant` with an assertion — justified because a daily
game is only ever started from a daily row; re-check at R1 when Kakuro joins the registry.
AI-written logic re-derived: `buildClues` (3×3 pinned cell-by-cell), `computeRunPeers` (centre
cell's four mates, corners empty), the arrow-key `move` (edge-stay and skip-over cases tested),
and that black-cells-as-givens really covers every edit path (`inputDigit`, `clearCell`, `hint`,
Tab-stop seed — read, and the first three exercised by tests).

### Docs sweep

Mirrored `.md` for all 12 touched source files (`kakuro-board.md` new). Reverse sweep for
`KakuroBoard` / `/kakuro` / `sample-layout`: live hits were `kakuro-types.md` (repointed) and the
plan's slice table (annotated "route retired in V2"); the V0/V1 step-logs and this log's earlier
entries are historical and left alone. Plan V2 step-log; log journal + B1 + L8; roadmap and
project-status status lines.

### Verified vs read

- **Verified:** the table above; in the browser — play a 7×7 from the deep link, rules dialog,
  place a digit, arrow across a block, pencil marks, run-mate peer highlight, reload + Continue
  restores blocks/clues/digit/marks (dark theme).
- **Read only:** light theme; the 9×9 in the browser (only via the e2e cell count); Killer/Keisan
  after the `merge` change (covered by their e2e + unit tests, not re-played by hand).
- **Owed:** Risk 15 (13×13 on a phone — no fixture yet), the NVDA/VoiceOver pass (G7).

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lesson

- **A reload is a test case.** Every derived store field needs one check that it survives
  hydration *as rendered*, not as `getState()` reads it — a post-hydration mutation passes the
  latter and fails the former, and no unit test here hydrates from storage.

---

## 2026-09-30 — Kakuro V1: types, layout rules, baked fixtures, clue sums on the board

Branch `feature/kakuro-v1`, stacked on `feature/kakuro` (V0, PR #104) at `bfa0fcb`. Adds
`src/features/engine/kakuro/` (`kakuro-types`, `kakuro-layout`, `kakuro-fixtures`, each with tests
and a mirrored `.md`), and the static `KakuroBoard` now takes a `KakuroPuzzle` and draws clue
sums; `sample-layout.ts` deleted. ~960 code/CSS/test lines (≈360 of them tests) + 380 doc lines —
**over the ~400 guideline.** Not split because types, layout derivation and fixtures only become
testable together (a fixture is validated by both), and the board change is what makes the slice
visible (L5).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 74 files, **607 passed**, 0 failed (53 s) — 29 new engine tests + 4 board tests |
| `npm run build` | green; `/kakuro` still prerendered static |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run — no solver/generator core; the new code is validators and a strip scanner |

### Findings

None blocking. Two things established while building:

- **Random fills of a fixed layout are never unique at these sizes** (0 / 3,000 on the 7×7) —
  recorded in `kakuro-log.md` → Measurements with the hill-climb timings that did work. A signal
  for E3, not a roadblock for V1.
- **Uniqueness of the two fixtures is proven only by a throwaway script**, not by anything in the
  repo. Stated in `kakuro-fixtures.md`; E1 owes the in-repo test.

### Invariants checked

None of the standing ones apply — no slot key, no write, no query, no migration, no dependency.
AI-written logic re-derived:

- `deriveRuns` — fuzzed 200× against an independent per-cell walk (different algorithm, same
  answer required), plus a fixed 3×3 with every run's cells and sum spelled out.
- `validateKakuroLayout` — each rule has a test that trips it *and* the 5×5 rule has a test that
  a black cell inside the block clears it (the contiguous-not-bounding-box nuance from G10).
- `validateKakuroRuns` — the row-wrap trap (flat indices 2 and 3 look adjacent) has its own test.
- `buildDisplayCells` — clue placement pinned on the 3×3 (which cell carries `across 4, down 4`,
  which gutter cells carry what) and spot-checked in the browser against the 7×7 solution by hand
  (23 = 6+8+9, 39 = 5+8+7+9+6+4, 24 = 8+7+5+4).

### Docs sweep

Mirrored `.md` for every source file; `KakuroBoard.md` and `page.md` rewritten for the puzzle
prop. Reverse sweep for `sample-layout` / `KAKURO_SAMPLE`: only hits are the plan's V0 step-log
(historical; annotated "deleted in V1"). Plan: V1 step-log with its four spec divergences; D2/D3
marked applied **with owner confirmation still open**; running log journal, measurements, L7;
roadmap + project-status status lines.

### Verified vs read

- **Verified:** everything in the table; page loads with no console errors; the served HTML
  never contains the word `solution` and every white cell is empty (the puzzle object, solution
  included, stays server-side because the board is a Server Component).
- **Read / reasoned only:** the 9×9 fixture's layout was drawn by hand and is only *validated*
  by code (legal shape), never *chosen* by code. Light theme not looked at by the agent.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lesson

- **When a fixture's correctness is established outside the repo, write that down where the
  fixture lives** — a future test that "proves" uniqueness must not be assumed to already exist
  because the fixture was authored carefully.

---

## 2026-09-30 — undici high + next critical advisories patched (undici → 8.11.2, next → 16.3.8)

Branch `fix/undici-next-cves` on `d0333d5`. Surfaced by PR #104's red `security-audit` gate — that diff
touched no dependencies. Eleven `undici` advisories (npm range 8.0.0 – 8.10.1) were published after
main's last CI run (09-11): one on 09-28, ten on 09-29; three are **high** (GHSA-rfgv-xxqx-mfg5,
GHSA-w293-vg96-wgc3, GHSA-vp8m-p9jh-q5pm). **Slice: 2 lines of `package.json` + 51 of
`package-lock.json`** — `undici` (lockfile only); `next` + `eslint-config-next` floors raised to
16.3.8. No `overrides` entry. Later commits after review: a daily `schedule:` on the
`security-audit` job in `ci.yml` (build/e2e gated off it; a red scheduled run opens an issue;
`npm ci` dropped for `--package-lock-only`), plus doc corrections. Full account of the divergence:
[research/security-audit-gate-advisory-lag.md](research/security-audit-gate-advisory-lag.md).

### Mechanical

| Check | Result |
|---|---|
| `npm ls undici` | **one copy, `jsdom@30.0.1 → undici@8.11.2`** (was 8.10.0); no nested copy |
| `npm ls next eslint-config-next sharp` | `next@16.3.8`, `eslint-config-next@16.3.8` → `@next/eslint-plugin-next@16.3.8` (all were 16.3.4); **one `sharp@0.35.4`**, next's copy still dedupes to it (AGENTS §6 gotcha checked) |
| `npm ci` on the final lockfile | clean install, 661 packages, no `invalid`/`missing` |
| `npm audit --audit-level=high --omit=dev` | exit 1 → **exit 0** at 17:06 UTC (10 moderate remain, below the gate) |
| `npx vitest run` | **574 passed** (70 files) |
| `npm run lint` · `npm run build` | both exit 0 on 16.3.8 (lint on the new `eslint-config-next`); same 25 routes (CI's placeholder `DATABASE_URL`) |
| Playwright e2e, production build (`CI=1`, own port) | **37 passed, 9 skipped, 0 failed, 0 flaky** on next 16.3.8. The 9 are the DB-gated specs — no database in this worktree |
| Benchmarks | not run — no engine/solver core touched |
| `ci.yml` schedule, job gates, failure-issue step | **parsed only** (js-yaml; gates read back as `build-and-test`/`e2e`: `!= schedule`). No scheduled or gated run executed before merge; the `--package-lock-only` audit verified locally in a directory with no `node_modules` (exit 0) |

### Findings

- **The undici fix alone left the gate red.** GHSA-vcvr-r3jv-pc5j (`next` ≥ 16.2.0 < 16.3.6,
  critical, RCE in `next/og` `ImageResponse`) was published 2026-09-30 14:48 UTC. The brief had ruled
  out unrelated bumps, so the owner was asked and approved adding `next` — `security-audit` is one
  job, so an undici-only PR and a next-only PR would each have stayed red. Exposure was low: nothing
  in `src/` imports `next/og` or defines an `opengraph-image`/`icon` route (grepped).
- **`npm audit` answered clean ~90 minutes after that advisory was public.** First post-fix run
  (≈16:15–16:20 UTC, not timestamped): exit 0. Same lockfile at 16:21:50: exit 1. Cause not
  established — registry propagation or a client cache.
- **16.3.8, not the minimum 16.3.6.** 16.3.8 (published 16:07 UTC the same day) lists seven more
  security fixes: one high (GHSA-cjq9-62q9-8jv4, SSRF in Image Optimization), five medium, one
  low. That advisory was not
  in GitHub's global database shortly after 17:00 UTC, so the audit cannot see it yet.
- **Floors raised after review.** The first cut was lockfile-only; `/code-review` flagged that the
  patched minimum then lived only in the lockfile and that `eslint-config-next` lagged `next` by
  four patches. Now `next: ^16.3.8` and `eslint-config-next: 16.3.8`, as the 09-10 fix did.
- **Dependabot #103 is not the simpler route.** It carries `undici@8.10.2` (via jsdom 30.1.1) but
  pins `next@16.3.5` — inside the critical range. Its checks ran 09-25, before any of these
  advisories; auditing its lockfile today exits 1. It touches the same `package.json` lines as this
  branch.
- **jsdom is a devDependency — and `--omit=dev` audits it anyway.** The lockfile marks it
  `devOptional`, not `dev`: `better-auth` (production) has an optional peer on `vitest`, which has
  an optional peer on `jsdom`. The brief's premise that jsdom sits under `dependencies` was wrong;
  moving it would change nothing.
- **No override needed** (the 08-07 standing lesson, applied): jsdom declares `undici: ^8.9.0`, the
  patch is 8.10.2, so the existing range already admits it.
- **`npm update` / `npm install` on macOS (npm 11.8.0) stripped the `libc` field from four
  `@node-rs/argon2-linux-*` entries** on all three installs. Reverted each time.
- **Second review, on the final diff:** five findings, all docs/metadata — the 16.3.8 advisory
  count was written as six (it is seven; also wrong in the first commit message, which stands),
  the research doc sat in `research/` with no banner saying why, the scheduled-audit fix was left
  as an open question, the review status was stale, and the `libc` hazard had no backlog entry.
  All fixed in the second commit; the roadmap now carries the two open questions.
- **Third review, on the `ci.yml` commit:** six findings — no notification path for a red scheduled
  run, the 60-day schedule auto-disable, the log not stating the schedule was only parsed, a stale
  header comment, an unneeded `npm ci` in the audit job, and an unclear roadmap sentence. Fixed in
  the third commit; reviews stop here by the owner's decision.
- **The first e2e run failed 41/41 on a missing browser, not on the diff.** Playwright 1.63.0 wants
  Chromium build 1243; the machine had 1234 from before #95. `npx playwright install chromium`
  fixed it.

### Lessons

- **`--omit=dev` omits `dev`, not `devOptional`.** Before asking why a test-only package is in the
  production audit, read its lockfile flag and `npm explain <pkg>` — an optional peer of a
  production dependency keeps it in scope.
- **An `npm audit` exit 0 can trail the advisory database by over an hour.** Re-run it as the last
  step, and for a fresh security release read the release notes — they can name advisories the
  audit does not know yet.
- **Diff the lockfile after any `npm update` and keep only the hunk you meant** — a local npm can
  rewrite platform metadata (`libc`) it was never asked to touch.
- **A green Dependabot PR is green as of its last CI run.** Audit its lockfile today before calling
  it the fix.
- **Look up every item before writing "all N were X".** This entry first said all eleven advisories
  were published 09-28 after checking one; ten were 09-29.
- **41/41 e2e failures with `Executable doesn't exist` is a Playwright bump without a browser
  install**, not a regression.

### Docs

No `.ts`/`.tsx` touched, no symbol renamed. Reverse sweep: `undici` and `16.3.4` appear only in
dated log entries (this file, the August archive) and the new research record — no other live doc
states either version. Research record written: [research/security-audit-gate-advisory-lag.md](research/security-audit-gate-advisory-lag.md);
`roadmap.md` "Security Hardening, Stage 1+" carries the two open questions. `ci.yml` has no
mirrored doc; its new `schedule:` block explains itself inline and cites the research record.

**Executed:** everything in the Mechanical table; the audit of #103's lockfile in a scratch copy;
publish dates of all twelve advisories (GitHub advisory API). **Read only:** the next 16.3.5 –
16.3.8 release notes (backported fixes for `next/image` disk cache, CSP nonce on loading/template
scripts, `use cache` prerender, a Turbopack hang; two security releases) — no source diff reviewed.

### Reviews

`/security-review` **not run** (this is the security fix; no app code changed). `/code-review` (the
in-session command, high effort, run by the owner) **was run three times**: on the lockfile-only
cut (seven findings), on the floors + docs (five), and on the `ci.yml` schedule (six) — all
addressed above. Not re-run after the third commit; the owner called the loop closed there.

---

## 2026-09-30 — Kakuro V0: looks-only static board at `/kakuro`

Branch `feature/kakuro` on `d0333d5`. First code of Phase 10: a Server-Component board that draws
a hand-written 7×7 layout (white cells, black cells, clue gutter, diagonals) with no sums, no
input and no store. 384 changed lines, ~225 of them code/CSS/tests.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 71 files, **578 passed**, 0 failed (54 s) — 4 new in `KakuroBoard.test.tsx` |
| `npm run build` | green; `/kakuro` prerendered static (○) |
| markdownlint (`**/*.md`) | exit 0 |
| Benchmarks | not run — no engine/solver core touched |

### Findings

None blocking. One caught while authoring, fixed before the first run: the first sketch of the
sample layout had 35 white cells, one over the N=7 uniqueness ceiling (34); redrawn at 32.

### Invariants checked

None of the standing ones apply — the diff touches no slot key, no write, no query, no migration,
no dependency. The AI-written logic worth re-deriving was `buildDisplayCells` (which black cells
get a diagonal): worked by hand for the 2×2 case and pinned as a test (3 clue / 3 blocked /
3 white).

### Docs sweep

Mirrored `.md` for all three new source files. Status flipped Planned → In Progress in
`roadmap.md` (both Phase 10 mentions), `README.md`, `Docs/README.md`, `project-status.md`; V0 added
to the plan (slice table, section, step-log, D12 amendment) and the running log. Two remaining
"V1–V3" mentions (roadmap prose, log journal 09-11) left as written — still true, and the journal
line is a dated record.

### Verified vs read

- **Verified:** tests, build, lint, markdownlint; the page loads at `/puzzles/kakuro` with no
  console errors, 64 cells, `robots: noindex`, title from the layout template; relative links in
  the new docs resolve.
- **Read / reasoned only:** the sample layout's connectivity and run lengths (2–7) were checked by
  hand, not by code — only its symmetry is asserted. The light theme was not looked at by the
  agent; the visual verdict in both themes is the owner's.
- **Not covered:** `e2e/a11y.spec.ts` enumerates its routes and was not extended to `/kakuro`
  (a temporary workbench route, deleted at V2). The allowlist lesson applies when V2 lands.

### Review statements

- `/security-review`: **not run** — no auth, authz, or data-access change.
- `/code-review`: **NOT run** — user-triggered and billed; an agent cannot launch it.

### Lesson

- **A hand-authored fixture that "looks right" needs a coded check for every rule it claims to
  obey** — the over-ceiling sketch rendered identically to a valid one. Until V1's `deriveRuns`
  validates layouts, treat any claim beyond the asserted symmetry as unverified.

---

## 2026-09-11 — Docs reorganisation: six docs archived, pre-merge log rotated, index rewritten

Branch `docs/archive-reorg-sept-2026` on `99b87ee`. **Docs only — no `.ts`/`.tsx` touched**, so no
benchmarks and no test-count change. Also carries the Kakuro Phase 10 plan + running log
(`kakuro-implementation-plan.md`, `kakuro-log.md`, plus their roadmap / README / project-status
rows), which were sitting uncommitted in the working tree from earlier the same day.

### Mechanical

| Check | Result |
|---|---|
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Relative-link check over every touched doc | all resolve (scripted, 17 files) |
| `npx vitest run` · `npm run lint` | **not run — `node_modules` is absent in this checkout**; the diff cannot reach them (markdown only) and CI runs both on the PR |
| Benchmarks | not run — no engine/solver core touched |

### What moved and why

- To `archive/`: `hint-agent-plan.md` (complete, uncited by source); `research/kenken-plan-review.md`
  (review of a shipped plan); `research/multi-zone-migration-validation.md` +
  `-safety-review.md` (pre-cutover reviews of an applied migration);
  `research/multi-zone-basepath-fetch-fix.md` (closed incident); `research/git-github-best-practices.md`
  (superseded by the solo multi-repo doc). Each got a dated banner; internal links re-pathed.
- **This log rotated:** the 2026-08-03 → 08-07 runs (1,800 lines) moved verbatim to
  `archive/pre-merge-log-2026-08.md`; a **Standing lessons** digest (24 rules) was added above so
  the lessons survive the move.
- **Kept live on purpose, banners refreshed:** `qa-remediation-plan.md` (cited by `PuzzleHub.tsx`),
  `mobile-a11y-audit.md` (cited by `e2e/a11y.spec.ts`), `performance-audit.md` (cited by `Cell.tsx`,
  `bot-identity.ts`). All three index rows had gone stale ("Planned" / "nothing implemented").

### Findings / notes

- **An `src/`-only citation grep misses `e2e/`.** The a11y audit looked archive-ready until a wider
  grep found `e2e/a11y.spec.ts` citing gap G2. Rule for next run: **before archiving a doc, grep
  `src/`, `e2e/`, `.github/` and `*.config.ts`, not just `src/`.** Now written into `Docs/README.md`.
- Two stale live claims fixed in passing: root `README.md` still called the Killer expert/extreme
  tiers "a planned follow-up" (shipped as K10); `project-status.md` still named the completed QA plan
  as the plan of record.
- Not touched, deliberately: generic early research references (enterprise architecture, web best
  practices, web security) — still valid, no successor doc; and the pause-era sections of
  `project-status.md`, which that doc says are its historical record.

### Docs

Reverse sweep for every moved path (`grep -rn` over `*.md`, `*.ts`, `*.tsx`, `*.yml`): 14 inbound
links re-pointed across `roadmap.md`, `project-status.md`, `kenken-implementation-plan.md`,
`multi-zone-migration-plan.md`, `research/vercel-cron-deployment-protection-outage.md`,
`archive/multi-zone-cutover-fix-summary.md` and the `src/lib/base-path.md` mirror. Remaining bare
mentions are inside dated log entries (historical, left).

### Reviews

`/security-review`: **not run — not required**, no code in the diff. The hosted `/code-review` has
**NOT** been run — it is user-triggered and billed and an agent cannot launch it.

---

## 2026-09-11 — PuzzleForm size rows reuse GridSizeSelector (Sept review quality item 3)

Branch `claude/sweet-bohr-f1946e` on `b00f105`. The deferred slice from the 2026-09-10 review:
replaced PuzzleForm's two hand-rolled inline size-button rows (Killer 6/9, Keisan 4/6/9) with the
shared `GridSizeSelector` + `sizes` prop, exactly as `PlayExperience` already does. Slice: 4 files,
+62/−44.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **569 passed** (69 files, +1: Killer-branch selector/payload spec) |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings / notes

- No slot-key, DB-write, ownership, or migration surface in the diff — UI + tests + docs only.
- Killer's `onChange` gained an `if (size !== 4)` guard: `GridSizeSelector`'s callback type is
  `4 | 6 | 9` while `killerSize` is `6 | 9`; the guard narrows without a cast and is unreachable
  because `sizes={[6, 9]}` never renders a 4×4 button (verified against the component's filter).
- **Deliberate visible change:** `/generate`'s Killer/Keisan branches now show the "Grid Size"
  heading and the shared selector's styling (px-4, borderless unselected) instead of the old
  bordered `text-sm` rows — matches `/play`. Owner to eyeball before merge per the visual-check
  preference; not self-certified.
- Environment note, not a finding: `npm run build` initially failed in the worktree because
  `.env.local` (with `DATABASE_URL`) is not copied into git worktrees; copied from the main
  checkout, after which the build passed. Rule for next run: **a worktree build failing at
  "Collecting page data" with a missing-env error implicates the worktree, not the diff.**

### Docs

Mirrored: `PuzzleForm.md` (toggle section rewritten current — it still described Killer v1 hiding
the selector — plus a dated reuse note), `GridSizeSelector.md` (`sizes` now cited for both call
sites). Reverse sweep for the removed inline groups (`aria-label="Grid size"`, "size rows"): only
live hits were the 2026-09-10 log entry naming this slice as deferred (historical, kept) and the
docs updated here.

### Reviews

`/security-review`: **not run — not required**, no auth/authz/data-access change in the diff.
The hosted `/code-review` has **NOT** been run — it is user-triggered and billed and an agent
cannot launch it.

---

## 2026-09-11 — SolvedDialog extraction (September review quality item 1)

Branch `claude/elastic-bhabha-4aa78a` on `b00f105`. Slice: 9 files touched + 3 new,
+115/−132 tracked plus ~250 new lines (component, test, mirror doc) — well under 400 LOC.

The triplicated solved-dialog shell (Play / Daily / Archive — each hand-rolling the fixed
backdrop, panel, `SolvedStamp`, time·mistakes pluralization, and its own `useDialogFocus`
wiring) is now one `SolvedDialog` component next to `ConfirmModal`. The primary-action ref
never leaves the component, so a new caller cannot re-create the F7 missing-focus bug; a
native-`<dialog>` upgrade is now a one-place change. Deliberately no `open` prop: callers
mount it only when solved (confetti fires on mount; mount/unmount drives the focus hook with a
constant `true`). The daily "Not quite!" review and `ConfirmModal` stay on their own markup by
design (no stamp/stats content).

| Check | Result |
|---|---|
| `npx vitest run` | **573 passed** (70 files) — 5 new `SolvedDialog` specs incl. mount-focus/unmount-restore through the component |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 (build with a placeholder `DATABASE_URL` — the worktree has no `.env.local`) |
| markdownlint (full sweep) | exit 0 |

- **Findings:** none — refactor only; no solver, data-access, auth, slot-key, or migration
  surface touched, so `/security-review` not required and the §2 invariants don't apply. Only
  deliberate behavioral deltas: stats-line margins unified (daily `mb-3`→`mb-2`), and the
  daily's local `formatTime` replaced by the identical `formatElapsed` in the dialog.
- **Docs:** mirrored `.md` for all 4 touched + 1 new source file; reverse sweep on the
  "repeated JSX pattern" claim updated `useDialogFocus` (ts + md) and `SolvedStamp.md`;
  dated step-logs (qa-remediation-plan, project-status, this log's 2026-09-10 deferred list)
  left as historical record.
- **Verified vs read:** unit-tested focus contract, pluralization, children/secondary slots;
  build/type gates run. **Verified live** (worktree dev server on an auto-assigned port —
  port 3000 was held by another session's server on the main checkout, so `puzzles-dev` got
  `autoPort: true`): solved a real 4×4 easy; the play `SolvedDialog` appeared with
  `role="dialog"` name "Solved", the stamp, "0:17 · 0 mistakes", and
  `document.activeElement` on "New puzzle". Daily/archive dialogs verified by test + read
  only (no `.env.local` in the worktree, so DB-backed surfaces 500) — owner eyeball still
  worthwhile there.
- **`/code-review` has NOT been run** — it is user-triggered and billed; an agent cannot
  launch it.

---

## 2026-09-10 — three-agent review of the September resume + fixes (incl. the Step 3b retroactive security pass)

Branch `fix/review-findings` on `5502712`. An agent-side review of the entire resume diff
(`3137539..main`, 12 merged PRs, +2727/−202) by three parallel reviewers — correctness, security,
a11y semantics — findings verified by hand before fixing. **This is not the hosted
`/code-review`**, which remains user-triggered and billed and has not been run.

### Security — statement of record

**Zero findings requiring action** across every reviewed surface. Part A (the resume):
`/api/daily/days` clean (validation anchored, parameterized, dates-only, no stack leakage;
`9999-12` → `10000-01-01` is a *valid* Postgres exclusive bound, not a 500); `/api/me/progress`
refactor clean (ownership in the JOIN, bound change cannot widen the window); `pl-rules-seen`
clean. **Part B closes the debt recorded in memory since August: the retroactive review of the
daily-restructure Step 3b surfaces** — `/api/solve` + `recordSolve` (floor axes come off the DB
row, so a mismatched-profile attack is structurally impossible; legacy keys all resolve to real
profile floors; the atomic conditional UPDATE is replay/race-safe), `/api/daily/slots`,
`getPersonalBests` (BOLA-scoped, no request-supplied userId anywhere), and `/api/daily/start` —
**all clean**. One informational note, fixed here as doc drift: the start stamp is written but
never read at submit; the route's doc claimed server-clock timing the code doesn't do. The docs
now say what is true and point at the Phase 9 time-trust gate.

### Findings fixed in this PR

| # | Finding (verified) | Fix |
|---|---|---|
| 1 | `attempts.service.test.ts` still passed the retired inclusive bound (`'2026-08-31'` ×3) — passes only because the DB stub never evaluates the filter; documents the wrong contract | Bounds → `'2026-09-01'` |
| 2 | GameHeader timer + mistakes: `aria-label` on bare spans — `generic` is a naming-prohibited role (axe `aria-prohibited-attr`, serious); some SRs read "✗ 3" literally | Timer → `role="timer"`; mistakes → aria-hidden glyph + visually-hidden text |
| 3 | Calendar's selected day was styling-only — no programmatic state | `aria-pressed` on day buttons (+ tests) |
| 4 | Calendar out-of-range days had no "why" in their name, despite the code comment claiming all disabled cases did | `— in the future` / `— before the archive begins` labels (+ tests) |
| 5 | RulesDialog `autoFocus` inert: React applies it at MOUNT and the dialog mounts closed, so no `autofocus` attribute ever reached the dialog focusing steps — focus landed inside only by browser fallback | Explicit `.focus()` on the primary button after `showModal()` |
| 6 | `visibleMonth` desync on Calendar remount (page → play → return): a stale provisional floor could grey the shown month + disable `‹` until a fetch settled (self-healing, but correct only by luck) | `backToBrowse()` re-syncs `visibleMonth` at every browse re-entry — by construction, in the handler (`set-state-in-effect` is banned) |
| 7 | Three identical difficulty arrays in PlayExperience; the `CALC_DIFFICULTIES` comment described gating done elsewhere | Collapsed to one constant |
| 8 | MobileNavMenu "▾" landed in the accessible name | `aria-hidden` span |
| 9 | **From the hosted `/code-review ultra` on #92** (its one finding, folded in here): `autoOpenedFor` was set only on the auto-open path, so a returning player's guard never short-circuited and `hasSeenRules` (localStorage read + JSON.parse) re-ran on every render — once a second via the timer tick | Guard marks the variant as *checked* on both outcomes; storage-read-count test pins one read per mount |

### Reviewed and deliberately NOT changed

- `aria-modal="true"` on non-inert overlays: the accepted ConfirmModal-parity posture; every
  overlay now has focus-in + restore, no regression. A real trap = the native `<dialog>` (the
  RulesDialog already uses it).
- Boardless archive day keeps the previous date's picker ("as before" by design; empty days are
  now mostly unreachable via the calendar greying; wrong-board selections return empty boards,
  no wrong data).
- `boundsUnavailable` is sticky per session after one failed fetch: matches the stated
  degrade-don't-lock intent; a later success restores the floor via `firstDate`.
- Cell aria-label bakes "row N, column N" while rows/cells carry `aria-rowindex`/`colindex` —
  double announcement is verbosity, not wrong data.
- Grid structure, `display:contents` rows, CageOverlay placement, MobileNavMenu breakpoints
  (exactly one path per width), LeaderboardView select batching, PDF destination namespaces
  (one document per builder — collision impossible), GameHeader render-phase trigger
  (StrictMode + SSR safe by two independent gates): all verified clean.
- Deferred as separate slices (scope rule): extract the triplicated solved-dialog shell into a
  `SolvedDialog`; reuse `GridSizeSelector` for PuzzleForm's killer/calc size rows.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **567 passed** (69 files, was 565) — Calendar aria-pressed + range-label specs |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Lessons

- **A stub that never evaluates a filter cannot defend a bound's semantics.** The exclusive-bound
  migration updated the route test but not the service test, and nothing failed — the stale
  fixtures survived as documentation of the wrong contract. When a parameter's *meaning* changes,
  grep every call site including tests, not just the ones a failure points at.
- **`aria-label` does not work on everything** — `generic` (bare span/div) is naming-prohibited;
  labels belong on elements with naming-capable roles, or as real (visually hidden) text.
- **React's `autoFocus` is not the HTML attribute.** It is an imperative mount-time `.focus()`;
  on anything rendered hidden-then-shown (a closed `<dialog>`, a collapsed panel), it does
  nothing — focus explicitly at show time.

### Reviews

`/security-review`-equivalent pass: **run** (the dedicated security agent above — its Part B
serves as the recorded retroactive pass for Step 3b, closing that August debt). The hosted
`/code-review` has **not** been run — user-triggered and billed.

---

## 2026-09-10 — Next.js critical-RCE advisories patched (next 16.2.12 → 16.3.4, sharp → 0.35.4)

Branch `fix/next-critical-cves` on `5502712`. Surfaced by PR #93's red `security-audit` gate —
the diff touched no dependencies; two advisory sets published upstream since main's last CI run:
**next critical** (GHSA-p293-qw3h-jr36 unauthenticated RCE on Windows-hosted servers;
GHSA-2xp9-vwfh-vxw4 unauthenticated RCE in the Image Optimization API via AVIF) and **sharp
high** (libheif, GHSA-rgj7-g3m4-5g8c). Deployment is Vercel/Linux, so the Windows RCE is not
directly reachable in prod, but the gate is red and the image-optimizer advisory is real.

### Mechanical

| Check | Result |
|---|---|
| `npm audit --audit-level=high --omit=dev` | exit 1 → **exit 0** (remaining advisories are all moderate, below the gate) |
| `npm ls sharp` | **one copy, 0.35.4** — the nested-`next` copy dedupes to it (the AGENTS §6 gotcha checked, not assumed); the `overrides` floor bumped to match |
| `npx vitest run` | **565 passed** (69 files) |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 on next 16.3.4 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- `npm install next@x sharp@^y` in one command trips `EOVERRIDE` when an `overrides` entry pins
  the old range — bump the override floor in `package.json` first, then install.

### Reviews

`/security-review` **not run** (this IS the security fix; no app code changed). The hosted
`/code-review` has **not** been run — user-triggered and billed.

---

## 2026-09-04 — per-type rules dialogs (QA Step 5, U3) — the plan's final step

Branch `feat/per-type-rules` on the Step 9 merge. Net-new rules copy for the three types (Keisan
always includes the 🔮 Mystery explanation), first-play auto-open persisted per type, and an
always-available Rules button in `GameHeader` — the one component on every playing surface.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **565 passed** (69 files, was 558) — dialog content/close, per-type persistence, auto-open + daily gate |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- **The spec's reference pattern couldn't meet the spec's own a11y bar.** It says to copy
  ConfirmModal, but lists *focus trapped* — which ConfirmModal never did. Built on the native
  `<dialog>`/`showModal()` instead: trap, Esc, modal semantics, and focus restore all come free.
- **Two portability potholes around native `<dialog>`,** both now handled and worth remembering:
  (1) jsdom has no `showModal`/`close` — a minimal polyfill in `vitest.setup.ts` protects every
  jsdom test that renders `GameHeader`; (2) synthesized-input drivers may not surface Esc as the
  native `cancel` close-request (observed live: the keydown reached the page, no cancel fired) —
  an explicit Escape keydown handler with `preventDefault` makes the behaviour uniform and
  driver-testable.
- "Seen" persists on **dismissal**, not on open — a reload mid-dialog shows it again; a
  same-session re-fire is stopped by component state.
- **Caught by CI, missed by the local gate: a new auto-opening modal breaks every e2e spec that
  interacts past the point it appears.** Every CI browser context is fresh, so the first-play
  dialog opened in all of them, and `showModal()` made the page behind it inert — four play
  specs and the /play confirm-modal overlay scenarios timed out (the first red CI of the
  resume). Fixed with a shared `dismissRulesIfShown` fixture helper (the same gesture a real
  first-time player makes) applied after each game start that interacts further; the canonical
  first-game spec asserts the dialog outright instead of tolerating it. Rule form: **shipping a
  new auto-opening dialog means sweeping e2e for every flow that interacts past its trigger —
  specs that only read (counts, visibility) survive; specs that click do not.** Full suite
  locally after the fix: 44 passed.

### Invariants checked (§2)

Client-side UI + one localStorage key (`pl-rules-seen`). No data, auth, board, or write paths.
The daily gate (`mode !== 'play'` blocks auto-open) also covers archive replays, which run in
mode `daily` — checked against the store, not assumed from the route.

### Verified vs read

Verified live: first `/play` game auto-opened with focus inside the dialog; Esc closed it and
persisted the flag; the Rules button re-opens on demand; the ranked daily started with no
auto-open and the button present. The unseen-variant-on-daily case is unit-tested (today's slots
all rolled types already seen locally).

### Reviews

`/security-review` **not run**: no auth/authz/data-access surface. The hosted `/code-review` has
**not** been run — user-triggered and billed.

---

## 2026-09-04 — mobile nav overflow + mini board caps (QA Step 9, F11 + F13; F12 was already closed)

Branch `fix/polish-step9` on the Step 8 merge. Two of the three findings needed work: a native
`<details>` overflow menu for the header links hidden on mobile (F11), and per-size board width
caps (F13). **F12 (`userId` on the public leaderboard) was already closed by #64** — the finding
predates its fix landing under a different heading; recorded, nothing to do.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **558 passed** (67 files, was 556) — MobileNavMenu disclosure + close-on-navigate |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- **A persistent layout turns a stateless disclosure stateful.** The root layout's header
  survives client navigations, so a plain `<details>` opened on `/play` would still be open on
  `/daily`. The panel click-closes it — the only JavaScript in the component, and the only
  reason it is a client leaf while `AppHeader` stays a Server Component. Rule form: **any
  open/closed UI living in a persistent layout needs an explicit close on navigation.**
- **The measurement picked the number.** The 4×4 cap is 320px, not a rounder 340, because at
  the audit's exact 1280×720 the numpad bottom measured 739px under a 340 cap (19px below the
  fold) and 719.2px under 320. F13 is a fold complaint; the fold decided.

### Invariants checked (§2)

Chrome + CSS only; no data, auth, keys, or writes. The menu's links are the same two `Link`s the
inline nav renders, with the basePath applied by Next as everywhere else.

### Verified vs read

Verified live in emulated viewports: at 1280×720 the 4×4 board (320px) and full numpad both sit
above the fold (numpad bottom 719.2px); at 375×812 the "More ▾" menu discloses Archive + PDF and
closes on selection. The `sm..md` band (menu shows PDF only) is covered by breakpoint classes +
read, not driven live.

### Reviews

`/security-review` **not run**: no auth/authz/data-access surface. The hosted `/code-review` has
**not** been run — user-triggered and billed.

---

## 2026-09-04 — Killer/Keisan PDFs gain bookmarks + links (QA Step 8, F9)

Branch `fix/pdf-parity` on `767af75`. The spec's lift, exactly: `addPageNavigation` (named
destination + bookmark) and `drawCrossLink` extracted from `drawPuzzles`; the Killer and Keisan
builders call both. Variant outlines are flat under "Puzzles"/"Answer Keys" — those builders take
a flat list, and the parity requirement is the navigation metadata, not classic's difficulty
nesting.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **556 passed** (66 files, was 553) — structural `/Outlines` + `/Annots` per variant |
| Deliberately-broken run | new tests against the **pre-fix** service → both variant tests **red**, classic green; restored → all green. Not vacuous |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched (PDF rendering only) |

### Findings

- None beyond the parity gap itself. Grid placement is unchanged by construction: the nav helper
  writes no text (destinations and outline items are metadata), and the cross link lands in the
  blank region below the 400pt grid, same as classic.

### Invariants checked (§2)

Rendering-only; no data, auth, keys, or writes. The generation inputs are the same
already-generated puzzle arrays the builders always took.

### Reviews

`/security-review` **not run**: no auth/authz/data-access surface. The hosted `/code-review` has
**not** been run — user-triggered and billed.

---

## 2026-09-04 — names, titles, and toggle semantics (QA Step 7, F5 + F8 + F10)

Branch `fix/names-titles-semantics` on `b54718c`. Three small a11y/SEO fixes: `htmlFor`/`id` on
the five generator inputs (F5), per-route `metadata.title` + a `%s · Puzzle Lab` template with
the brand reconciled from "Puzzle Generator" (F8), and `aria-pressed` in labelled `role="group"`s
for the type/size/difficulty toggles on `/generate` + `/play` (F10).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **553 passed** (66 files, was 551) — labeled-inputs + pressed-state specs |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- **The brand sweep found one deliberate leave-alone:** the passkey `rpName` in `auth.ts` still
  says "Puzzle Generator". Display-only, but it is stored auth configuration surfaced in
  credential pickers — renaming it belongs to an auth-scoped change with its own review, not to
  a document-title fix. Recorded in the step-log so it reads as a decision, not a miss.
- `aria-pressed` over `radiogroup`/`radio`, deliberately: radios require arrow-key roving
  tabindex per group (five groups, two surfaces) for no additional announced information here.

### Invariants checked (§2)

Markup/metadata only — no data, auth behavior, keys, or writes. The one auth-adjacent string
(`rpName`) was inspected and deliberately not changed.

### Verified vs read

Verified live: `Play · Puzzle Lab` / `Print packs · Puzzle Lab` / `Archive · Puzzle Lab` /
hub `Puzzle Lab` in real document titles; all five generator inputs resolve their difficulty
name from the real DOM; `aria-pressed="true"` sits on exactly the selected chip per group.
Daily/leaderboard titles asserted via the same mechanism, read not visited.

### Reviews

`/security-review` **not run**: no auth/authz/data-access change (`rpName` inspected, untouched).
The hosted `/code-review` has **not** been run — user-triggered and billed.

---

## 2026-09-04 — grid rows + dialog focus (QA Step 6b/6c, F6 + F7) — Step 6 complete

Branch `fix/board-rows-dialog-focus` on `3722aac`. Two halves: `role="row"` wrappers
(`display: contents`) with `aria-rowindex`/`aria-colindex` in `Board`/`Cell`, and a shared
`useDialogFocus(open)` hook applied to **four** dialogs plus `ConfirmModal` — the audit named one
"Solved!" dialog, but the dialog shell is a repeated JSX pattern, so the same missing-focus defect
existed everywhere it was pasted.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **551 passed** (66 files, was 546) — hook harness (2) + row structure + existing board specs |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- **A defect in a copy-pasted pattern exists once per paste.** F7 was filed against one dialog;
  the fix landed as a hook because Play/Daily/Review/Archive all shared the flaw. Rule form:
  **before fixing a finding in shell markup, grep for the shell — the finding count is the paste
  count, not one.**
- **Browser key names are not React-test key names.** Driving the live board with `"Down"` did
  nothing (`e.key` must be `'ArrowDown'`); seven digits landed on one cell and incidentally
  demonstrated that same-digit entry toggles a cell clear. The app was correct; the driver
  wasn't. Treat an unexpectedly empty board as input that never arrived.

### Invariants checked (§2)

Client-side rendering/focus only — no data, auth, keys, migrations, or writes. Re-derived the two
risky interactions: `display: contents` leaves cells as direct grid items (verified live —
computed cell boxes identical), and the restore-to-opener half is a spec'd no-op when the opener
unmounted (solved → config), which is the desired degradation.

### Verified vs read

Verified live: solved a real 4×4 by mouse+keyboard — Solved dialog took focus ("New puzzle");
ConfirmModal Escape returned focus to its opener; 9 rows × 9 cells with correct indices and
unchanged square layout in the real DOM. The Daily review + Archive solved dialogs use the same
hook + ref wiring but were exercised only in jsdom/read, not live.

### Reviews

`/security-review` **not run**: no auth/authz/data-access surface. The hosted `/code-review` has
**not** been run — user-triggered and billed.

---

## 2026-09-03 — the background renders for the first time since the multi-zone move (QA Step 2, F2)

Branch `fix/bg-pattern-basepath` on `1eb96b5` (stacked on 3c). Next prepends `basePath` to
`<Link>`/`next/image`/router URLs — **not** to CSS `url()` — so `bg-[url('/bg-pattern.svg')]`
escaped the `/puzzles` zone and 404'd on all 7 pages. Fixed once, not seven times: the root layout
composes `--bg-pattern` from `BASE_PATH`; pages consume `bg-[image:var(--bg-pattern)]`.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **546 passed** (65 files, unchanged — no unit-testable logic) |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| New e2e guard | asset 200 under the zone + computed `background-image` through the zone; **deliberately-broken run went red** (one page reverted), restored green |
| markdownlint (changed docs) | exit 0 |

### Findings

- **A step absent from a handoff's next-up list is not a step that is done.** F2 (High) sat
  re-opened for a month because the pause handoff's silence read as completion; the plan's own
  *(pending)* step-log was the truthful record. Rule form: **when resuming from a handoff,
  reconcile its next-up list against the plan's per-step logs — trust the logs.**
- A blanket "no subresource 404s" e2e guard was rejected: `/api/daily` 404s are legitimate
  (empty days), so it would false-positive; the guard pins this asset + wiring specifically.

### Invariants checked (§2)

Chrome-only CSS change + one inline style in the layout; no data, auth, keys, or writes touched.

### Reviews

`/security-review` **not run** (no auth/authz/data-access surface). The hosted `/code-review` has
**not** been run — user-triggered and billed.

---

## 2026-09-03 — legacy days stop exploding the picker (QA Step 3c, D1)

Branch `fix/legacy-picker-collapse` on `92f7cd9` (stacked on 3b). One component + its test file +
mirror doc: over 12 slots, `LeaderboardView`'s chip rows collapse to a labelled `<select>` with an
`<optgroup>` per section. Presentation only; every key stays selectable.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **546 passed** (65 files, was 543) — 3 new `LeaderboardView` specs |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (changed docs) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- None fixed-in-PR beyond the finding itself. The spec's cheap fallback (legacy days go
  leaderboard-only) was rejected on the invariant's own grounds: it removes replay — a capability
  — to fix a layout problem.

### Invariants checked (§2)

- **A slot key is not an identity — and neither is a date.** Legacy-shaped is detected by slot
  COUNT (> 12), so the rule survives both the old 30-key era and any future growth of the current
  model (6 → 10 planned). No key parsing, no date threshold.
- **Retired keys stay readable and replayable:** verified live — selecting `killer-hard` on
  2026-07-25 fetches its board (200) and the archive Play button follows.
- No auth, migration, or write path touched.

### Reviews

`/security-review` **not run**: rendering-only change to a public read surface. The hosted
`/code-review` has **not** been run — user-triggered and billed.

---

## 2026-09-03 — archive calendar learns its bounds (QA Step 3b, U2)

Branch `fix/archive-calendar-bounds` on `3137539`. A **port of the prior art**, not a rebuild:
endpoint + `Calendar` changes from the never-merged `fix/qa-findings-aug-2026`, the parent wiring
re-done by hand around #72 with the stash's **three-state floor** (known / waiting-provisional /
settled-without-a-floor — the state that stops one failed request deadlocking both arrows).
`/api/me/progress` folded onto the new shared `isIsoMonth` + half-open `firstDayOfNextMonth`
bound; `getDailyProgress`'s upper bound is now exclusive (single caller, updated together).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **543 passed** (65 files, was 507) — new route, Calendar, and date-helper suites |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 (`/api/daily/days` registered ƒ) |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- **Wholesale checkout of a prior-art file deleted a test that postdated it.** Taking the QA
  branch's `progress/route.test.ts` dropped main's #61 year-zero regression test. Caught by
  diffing against main before commit. Rule form: **after `git checkout <old-branch> -- <file>`,
  diff the result against main and re-apply what main gained since the branch was cut.**
- **F2 (`bg-pattern.svg` basePath 404) is still open**, observed live during verification: all 7
  pages still carry the unprefixed CSS `url()`, no fix commit exists, and Step 2's step-log is
  *(pending)* — the pause handoff simply didn't list it. The e2e ≥400 guard cannot catch it
  (document navigations only, not subresources). Re-filed under Step 2, not fixed here.

### Invariants checked (§2)

- **Retired keys stay readable:** verified by construction *and* live — legacy days (07-20→31)
  hold boards, so the calendar leaves them enabled; greying keys off *dates with no rows* cannot
  touch a stored key. No key parsing anywhere in the diff.
- **Ownership lives in the query:** `getDailyProgress` still takes the session id and joins on it
  (its BOLA test passes unchanged). The new `/api/daily/days` is deliberately public — a dates-only
  aggregate, no user data, documented in its mirror doc.
- No migration, no economy write, no `ON CONFLICT` path touched.
- **Re-derived:** the exclusive-bound switch was checked against every caller — `getDailyProgress`
  has exactly one (`/api/me/progress`), updated in the same diff.

### Verified vs read

Verified live in the browser against the real archive: July 1–10 greyed (floor 2026-07-11),
**24 July greyed with "no puzzles" in the accessible name** (the cron-outage hole), `‹` disabled
at the floor month, endpoint 200 signed out. The deadlock degradation (failed request → no floor)
is covered by unit tests + read, not fault-injected live.

### Reviews

`/security-review` **not run**: the new endpoint is a public, unauthenticated, dates-only
aggregate (no auth/authz/data-access change; the one authed query kept its ownership scoping and
test). The hosted `/code-review` has **not** been run — user-triggered and billed.

---

## 2026-09-03 — the board becomes reachable by keyboard (QA Step 6a, F4)

Branch `fix/board-keyboard-entry` on `3137539`. First PR of the September resume, pulled ahead of
the running order as the plan invites. ~30 LOC of source across `Board.tsx`/`Cell.tsx`, two new
unit tests, mirrored docs + step-log + `project-status.md` updated in the same PR.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **507 passed** (64 files, was 505) — two new `Board.test.tsx` specs |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | all exit 0 |
| markdownlint (`**/*.md`, full sweep) | exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |
| e2e | left to CI (flaky-table caveats apply); board specs click cells, which is unchanged behavior |

### Findings

- **The spec's "~10 lines" was half the defect.** Seeding `tabIndex 0` on the first editable cell
  makes the board *reachable*, but typing still no-ops: `inputDigit` requires a store
  `selectedCell`, and Tab-focus set none. Cells now select themselves `onFocus` (skipped when
  already selected so the roving effect's `.focus()` doesn't echo a store write). Rule form:
  **"reachable" and "operable" are separate assertions — test the keystroke after the Tab, not
  the focus.**
- Verified live in the browser as well as in jsdom: exactly one `[tabindex="0"]` gridcell
  pre-selection, focus + a real `5` keypress places the value, Cmd+Z restores.
- **Re-derived, not assumed:** a click now writes `selectCell` twice (focus fires before click).
  Verified harmless against the store config — zundo `partialize`s to `grid`+`candidates` only,
  so selection writes never enter the undo stack, and `useShallow` scalar selectors make the
  second identical write render-free. Reverse-reference sweep found no live doc claiming the
  board is keyboard-unreachable outside the QA docs updated here.

### Invariants checked (§2)

**Read, not run:** no authorization predicate, no migration, no economy write, no slot-key or
daily-registry surface — this diff is client-side focus management on the shared board component.

### Reviews

`/security-review` **not run**: no auth/authz/data-access surface touched. The hosted
`/code-review` has **not** been run — user-triggered and billed; owner may trigger it on the PR.

---

## 2026-09-02 — hint agent: MCP server + eval harness over `HumanSolver`

Branch `feat/hint-agent` on `b819184`. New feature folder `src/features/hint-agent/` (7 source
files + tests + mirrored docs), one engine addition (`deductions.ts` — the enumerator), two new
deps, `.mcp.json`, two eval-result JSONs. **~4,400 LOC added**, of which roughly 2,500 is the two
committed eval reports (raw model output kept as evidence), ~500 is docs, ~250 tests. Production
code is ~600 LOC across two isolated modules with no callers in the app — nothing routed, no
server code, no data access. Over the 400-LOC target on paper; the reviewable surface is not.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 505 passed (64 files) — 28 new |
| `npm run lint` / `tsc --noEmit` / `markdownlint "**/*.md"` | all exit 0 |
| `npm run build` | ✓ compiled, all routes unchanged |
| `npm audit --audit-level=high --omit=dev` | 0 high (4 moderate, pre-existing, via drizzle-kit's esbuild) |
| Benchmarks | **not run** — `human-solver.ts` / `sudoku.ts` untouched; `deductions.ts` only clones and calls existing `apply*` functions |
| Live eval | 52/52 on `claude-opus-5`: 100% validity, 100% label, 0% leak, 12/12 refusals; ~$1.50 |

### Findings

- **New deps verified real before install** (slopsquatting check): `@modelcontextprotocol/sdk`
  1.30.0 and `@anthropic-ai/sdk` 0.123.0, both confirmed on npm with `npm view`.
- **The 100% is a ceiling effect, recorded, not hidden.** Every solvable eval state had a single
  available and the prompt prefers the simplest technique, so all 40 hints were singles. The
  harness measures oracle-following, not technique reasoning. Written into the plan doc's Limits
  and the roadmap entry rather than left for a reader to discover.
- **Identity-linked Console keys need `anthropic-workspace-id`.** The SDK reads
  `ANTHROPIC_WORKSPACE_ID` only on its federation path; `createClient()` in `agent.ts` sets the
  header for the plain-key path. Found on the first live run.
- **AI-written logic re-derived:** the leak regex (strips `r#c#` / `row 3` before searching for
  the placed digit) and the subset-validity rule (elimination strategies report the union of
  instances, so a subset is one real step). Both have deliberately-broken cases in
  `eval-grade.test.ts`; the regex's false-positive on "one candidate" was checked by hand against
  the raw runs (37 hits, all that phrase).

### Invariants

Slot keys, `ON CONFLICT`, retired keys, ownership-in-query, migrations: **all not applicable** —
no database, no routes, no auth touched. `/security-review` **not required** for the same reason
and not run. The MCP server is stdio-only and reads one env var; the agent sends only the grid to
the API.

### Docs

Mirrored `.md` for all 8 new `.ts` files. Reverse-reference sweep: nothing removed or renamed;
`hint-agent-plan.md` created as the living doc with step-log; `Docs/README.md` and `roadmap.md`
entries added. No archived doc touched.

### Lessons (apply next run)

- **A perfect eval score is a finding about the eval first.** Before quoting 100%, check what
  the population actually exercised — here, one glance at the strategy histogram (33 Naked, 7
  Hidden, 0 anything else) said more than the four headline rates.
- **Read the raw runs for what the grader cannot see.** The refusal *reasons* (did it cite the
  tool, or its own reading of the candidates?) are the evidence that the refusal rate means
  something; the rate alone does not.

**`/code-review` has NOT been run** — it is user-triggered and billed, and an agent cannot launch it.

---

## Earlier runs

Runs from **2026-08-03 through 2026-08-07** are in
[archive/pre-merge-log-2026-08.md](archive/pre-merge-log-2026-08.md), verbatim.
