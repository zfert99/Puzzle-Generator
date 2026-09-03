# Pre-Merge Log

One entry per `/pre-merge` run. **Newest first** — the entry you want is almost always the top one.

## Why this log exists

The gate's output used to live only in a chat transcript, which meant every run re-derived what the
last one already knew. Two concrete costs, both paid on the Step 5 run below:

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
| `src/features/engine/calc/calc-sudoku.test.ts` → `generateCalcSudoku > "hard leans on × …"` | Times out (`Test timed out in 5000ms`) in ~10–15% of **full-suite** runs. Solo: 261/453/640 ms. Under parallel load: measured **5738 ms** against Vitest's then-default 5000 ms. Cause was worker CPU contention against real randomized generation, not the assertions. | **✅ Resolved 2026-08-04** (`fix/keisan-test-flake`). Kept here because branches cut before that fix still hit it. Established 2026-08-03 over ~18 full-suite runs; root-caused and fixed the next day — see the entry below, which found **three** distinct causes under this one test name. |

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

## 2026-08-07 — a dangling doc citation restored (landed 2026-09-03)

Branch `claude/compassionate-pasteur-38d4f3` on `bb10da9`. Docs only; **no `.ts`/`.tsx` touched at
all**, so no benchmarks and no test-count change.

> **Salvage note (2026-09-03):** this run happened on 2026-08-07 but its diff was **never
> committed** — it sat as uncommitted changes in the worktree, invisible to every branch and
> commit listing, and `project-status.md` still carried the item as open at the pause. Found and
> landed 2026-09-03 on `docs/restore-killer-6x6-plan`, with the gate re-run against current
> `main` (507 vitest / lint / build / full markdownlint, all green; dates in the restored
> banner updated to September). The entry below is otherwise as written on 2026-08-07.

### The finding

`killer-sudoku.ts:124` cited `Docs/killer-6x6-implementation-plan.md`, which had been archived to
`Docs/archive/` on completion. Two repairs were possible: repoint the comment at `archive/`, or move
the doc back. **Moved it back.** The citation is load-bearing — it is the `DIFFICULTY_CONFIG_6`
JSDoc explaining why the 6×6 score bands cut at **16/28** instead of reusing the 9×9 cuts — which is
exactly the case Section 7's "live source rationale outranks completed" exists to protect, alongside
`kenken-implementation-plan.md` and `multi-zone-migration-plan.md`. Repointing the comment would
have fixed the symptom and left the rule broken.

The doc had **no** prior Archived banner, so nothing historical was overwritten; a "kept live"
banner was added and its three depth-relative links fixed.

### Mechanical (as of 2026-08-07, on `bb10da9`)

| Check | Result |
|---|---|
| `npx vitest run` | **468 passed** (57 files) — baseline for `bb10da9`; no source touched, so unchanged by construction |
| `npm run lint` · `npx tsc --noEmit` | both exit 0 |
| markdownlint (`**/*.md`, the full CI sweep) | exit 0 — run whole-repo, not just touched files, because a doc changed *paths* |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- Repo-wide sweep found exactly **one** true dangling reference. The four
  `Docs/multi-zone-cutover-log.md` hits are hub-repo (`Biscuit-Website`) citations and correctly
  never resolve here.
- **The "hub's" exclusion cannot be detected line-scoped** — worth knowing before anyone automates
  this sweep. Three of those four say "the hub's `Docs/…`" on one line; the fourth
  (`src/app/api/auth/[...all]/route.md:24`) wraps the phrase across a line break, so a line-scoped
  filter silently mis-classifies it as dangling.
- Moving the doc broke an inbound `roadmap.md` link into `archive/` — fixed here.

### Invariants checked (§2)

**Read, not run:** no authorization predicate, no migration, no economy write, no slot-key
aggregate, no dependency change — this diff is documentation and one file move. Nothing executable
changed, so there was nothing to re-derive.

### Reviews

`/code-review` **was** run this time (user-triggered) — see Lessons; it returned three findings, all
against a CI guard that has since been dropped from this branch. Zero findings against the doc fix.

`/security-review` **not run**: no auth, authz, or data-access surface is touched.

### Lessons

**Scope creep here came from trailing offers, not from the task.** The ask was a two-line doc-
reference repair. Each reply ended with "say the word and I'll also…", and three accepted offers
later the branch carried an 84-line shell script, a CI step and ~250 changed lines — and the only
defects `/code-review` found were in code that would not have existed otherwise. Rule for next time:
finish the ask, state what else is outstanding *once*, and let the owner raise it. A doc fix, a new
CI guard, and a log entry are three slices, which AGENTS.md step 1 already says to split.

**A break test that cannot fail manufactures confidence.** While verifying the (now-dropped) guard,
the first deliberately-broken run *reported success* — a stale `cd Docs` from an earlier step made
`git mv Docs/killer-6x6-…` resolve to a non-existent `Docs/Docs/…`, so it silently no-opped and the
guard was checked against an unbroken tree. **Assert the break actually took effect before trusting
the verdict on it.** This generalizes the log's existing `mockClear` rule to any guard, not just
call-history assertions.

**An "empty" worktree branch can still carry finished work** *(added at salvage, 2026-09-03)*: the
branch showed "no unique commits" in every listing, and only a `git -C <worktree> status` revealed
a complete, gate-passed diff. Check the working tree, not just the log, before writing one off —
and commit a finished slice immediately, even if it never gets pushed.

---

## 2026-08-07 — the archive stops handing out today's board unranked

Branch `fix/archive-today-to-daily` on `1a1624b`. **Step 3a** of the QA remediation plan (F3).
~139 LOC of production code across 2 client components; no server code.

### What was wrong

`/archive`'s calendar reached today **and defaulted to it**, so the most natural path on the page —
open it, press Play — started an *unranked practice* run of the board you still had to play ranked.
Because a replay calls `startNewGame`, it could also erase an in-progress **ranked** attempt at that
same board from the single saved slot. Nothing on screen said either thing.

Today is now browsable (its leaderboard stays beside the calendar) but hands off to `/daily?slot=`.
**No new `/api/solve` caller** — rankability stays entirely in `DailyExperience`.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 468 passed (57 files) |
| `npx playwright test` | **43 passed** |
| `tsc --noEmit` / `npm run lint` / `markdownlint "**/*.md"` | all exit 0 |
| `npm run build` | ✓ compiled 5.3 s, 14/14 static pages |
| Benchmarks | **not run** — no solver/generator core touched |

### Findings

- **Docs, caught by the reverse-reference sweep and fixed in-PR.** Both mirrored `.md` files were
  corrected when the `?slot=` seed moved inside the slots effect, but `qa-remediation-plan.md`'s
  Step 3a spec still described the **superseded** design ("the seed is deliberately unvalidated").
  Its source was never touched, so mirroring could not have caught it — which is the entire reason
  that sweep exists.
- **Two code-review findings, both fixed in-PR** — see the plan's Step 3a step-log for detail: an
  ungated hand-off link could name one board and navigate to another, and the `?slot=` key was
  seeded into state on a self-correction claim that had a hole.

### Invariants

**Slot key is not an identity** — checked and *relevant here*: `?slot=` is matched against the keys
the server rolled **for today**, so a retired key (`calc9-expert`, `killer6-easy`) is correctly
rejected and falls back rather than resolving to a same-named board from another era. Archive replay
of retired keys is a separate, untouched path. `ON CONFLICT`, ownership-in-query and migrations are
**not applicable** — the diff performs no data access and no writes.

### Lessons (apply next run)

- **A claim tested only on the happy path is not tested.** The "self-corrects" comment was written
  confidently and verified against a *working* slots fetch. The failure path had the hole. If a
  comment asserts an invariant, exercise the branch that would break it.
- **A test that cannot fail is worse than no test.** The first regression test for that hole
  asserted the garbage key was absent from the screen with the fetch aborted — it passed against
  the broken code too, because with no slots nothing renders the key. Deleted rather than kept
  green, and the docs now say the hole was inert instead of implying coverage.
- **Hardcoded initial state becomes a bug the moment it is put in an href.** `difficulty` started at
  `'easy'` harmlessly for months. The standard rungs *roll* — 2026-08-03 rolled
  `hard`/`expert`/`extreme` with no `easy` — so the day it fed a navigation target, it could send a
  player somewhere the label did not name.

### CI caught three things local runs could not (2026-08-11)

The first CI run on this branch went red, and every cause was real:

- **A stuck spinner I introduced — and had to fix twice.** The review fix held the hand-off back on
  `slots.length === 0`, but `LeaderboardView.onSlotsLoaded` **never fired for an empty day**, so a
  boardless day sat on "Loading…" forever. Not hypothetical: **2026-08-11 had zero daily boards**
  until the roller ran. Round one made the callback report an empty day. CI was still red: without
  a database the request **fails** rather than returning empty, and the `.catch(() => {})` swallowed
  that too. The callback now fires on **every settled outcome** — boards, none, non-2xx, malformed,
  network error — and the page tracks `slotsLoadedFor` so there are three states, not two. Both
  terminal states are now driven deterministically by route interception, so the tests run in every
  environment instead of depending on whether today happens to have boards.
- **`HAS_DATABASE` was the wrong gate, in this PR *and* pre-existing.** The four `/daily` modal
  specs gated on a database being configured; the condition they actually need is **today having
  boards**. On 2026-08-11 those differ — database present, zero boards — and all four failed. Both
  suites now share `todayHasBoards()`.
- **`npm audit` went red on a transitive `nanoid` CVE** (GHSA-2v37-7h3g-55p8, high) published after
  2026-08-07. Unrelated to this diff, which touches no dependency file; `main` was green on 08-07
  and would fail the same way today.

### Lessons from the CI round (apply next run)

- **Gate a test on the condition it needs, not a proxy for it.** "Is a database configured" stood in
  for "does today have boards" and they diverged the first day the roller did not run.
- **A placeholder needs a terminal state for every way the question can end.** "Not answered yet"
  vs "answered: none" was not enough — "the request failed" is a third, and a bare
  `.catch(() => {})` silently converts it into the first. Enumerate settled outcomes, not just the
  happy one and the empty one. Same shape as the calendar deadlock in the Step 3b prior art, which
  this run reproduced *after* writing that prior art down — reading a lesson is not applying it.
- **A callback that skips the empty case is not a callback the parent can trust.** `onSlotsLoaded`
  looked like "here are the boards" and was really "here are the boards, unless there are none".

### Reviews

- `/security-review`: **run — no findings.** The one untrusted input (`?slot=`) never enters state
  unvalidated; all three consuming routes re-validate server-side.
- `/code-review`: **NOT run by the agent.** User-triggered and billed; an agent cannot launch it.
  The owner ran it on this branch and both findings above came from it.

---

## 2026-08-07 — the e2e suite runs for the first time

Branch `fix/e2e-basepath` on `bb10da9`. Fixes **F1** of the August 2026 QA pass (Step 1 of the
remediation plan). Test harness, CI config and docs only — **no application code**.

### What was actually wrong

`baseURL` was the bare origin while the app is mounted at `basePath: '/puzzles'`, so every
`page.goto('/…')` 404'd. Two consequences, the second being the one that mattered: `webServer.url`
pointed at `/`, Playwright treats 404 as "not ready", so **`npm run test:e2e` aborted before a
single test ran** — and when forced to run anyway, the axe scans and overflow checks passed happily
**against Next's 404 page**. `ci.yml` never ran e2e, so nothing surfaced it.

Putting the path in `baseURL` does **not** fix it: root-relative paths discard a `baseURL` path.
The prefixing lives in a new `e2e/fixtures.ts` instead, which also **throws on any navigation
returning >= 400** — the meta-guard, so a future basePath move turns the suite red, not green.

### Mechanical

| Check | Result |
|---|---|
| `npx playwright test` | **38 passed**, 0 failed — first genuine green in the suite's life |
| Deliberately-broken run | fixture prefixing disabled -> **suite goes red**; restored -> 38 green. The assertions are not vacuous |
| CI conditions reproduced locally | **34 passed, 4 skipped** — production build, placeholder DB, `E2E_HAS_DB=false` |
| Local, real database | **38 passed** — all four DB specs run |
| `npx vitest run` | 468 passed |
| `tsc --noEmit` / `npm run lint` / `markdownlint "**/*.md"` | all exit 0 |
| Workflow YAML | parses (`js-yaml`) |

### Findings

- **Two of the first run's failures were an artifact of `reuseExistingServer`.** It attached to a
  dev server on :3000 running a **different branch's** code and reported two confident, wrong
  failures about a hub card. The port is now `E2E_PORT`-configurable and documented.
- **A stale selector had been hiding since the daily restructure.** `a11y.spec.ts` picked the daily
  by `/^easy$/i`, but type-as-slot labels read "Easy · Classic" and **both halves roll daily**. The
  test was wrong, not the app. Fixed by taking whatever the picker preselects.
- **A production build REQUIRES `DATABASE_URL`, even to build.** `/api/daily` and
  `/api/cron/daily` evaluate the DB client at module scope, so `next build` dies collecting page
  data without it — while `next dev` does not, which is why local testing missed it and **CI caught
  it**. The earlier "34 of 38 pass without a database" was measured against dev only. CI now passes
  a placeholder connection string purely to get the build through, and `E2E_HAS_DB` (set from the
  secret's presence) decides whether the four DB specs actually run — the *presence* of
  `DATABASE_URL` is useless as a signal once a placeholder exists.
- **Review follow-up (same PR).** `HAS_DATABASE` tested `E2E_HAS_DB` for *truthiness*, so
  `E2E_HAS_DB=` (set but empty) fell through to `DATABASE_URL` — the CI **placeholder** — and would
  have run the four DB specs against a refusing connection. Now tested for presence
  (`'E2E_HAS_DB' in process.env`).
- **My own DB skip guard was silently wrong.** `test.skip(!process.env.DATABASE_URL, …)` reads the
  *runner's* env, and Next loads `.env.local` for the app only — so the four DB specs skipped even
  on a machine with a working database, quietly dropping coverage 38 -> 34. Fixed by loading
  `.env.local` in `playwright.config.ts` via `dotenv`.

### Lessons (apply next run)

- **A readiness probe that never succeeds looks exactly like a suite with no tests.** "0 tests ran"
  and "all tests passed" are one careless glance apart. Assert the landing response is 200.
- **`reuseExistingServer` will reuse a server running code you are not testing.** It matches on
  port, not on commit. Give a suite its own port whenever another server might be up.
- **An env-var guard in a test runner does not see the app's `.env`.** Next injects `.env.local`
  into the app process, not into Playwright or Vitest. A `process.env.X`-gated skip silently
  over-skips unless the config loads the file itself — and a skip reports as success.
- **A build-time dependency is invisible to `next dev`.** Dev compiles per request; `next build`
  collects page data for every route up front, so a module-scope `throw` in a rarely-hit API route
  fails the build and nothing else. Any "does this work without X?" claim measured under dev must be
  re-measured under a build before it goes in CI.
- **Prefer a production build for parallel e2e.** `next dev` compiles on demand, so parallel workers
  hitting cold routes produce timeouts that look like assertion failures.

### Re-verified 2026-08-07 (post-rebase onto `eeafac4`, post-review-follow-up)

Rebased after PR #71 landed; one code-review follow-up folded in (the `HAS_DATABASE` presence
check above). Re-run rather than logged as a separate entry — same PR, same day, and a second
near-identical entry would be noise.

| Check | Result |
|---|---|
| `npx vitest run` | 468 passed (57 files) |
| `tsc --noEmit` · `npm run lint` · `markdownlint "**/*.md"` | all exit 0 |
| `npm run build` | ✓ 14/14 static pages |
| `npx playwright test` | 38 passed |
| Merge cleanliness | clean vs `main` **and** vs `feat/hub-reorg` (`git merge-tree`, both directions) |

### Reviews

- `/security-review`: **run — no findings.** Test harness, CI config and docs only; no application
  code, no new endpoints, no auth or data-access change.
- `/code-review`: **NOT run.** User-triggered and billed; an agent cannot launch it.

---

## 2026-08-07 — devlog for the cron outage (cross-repo gate, `Biscuit-Website` #37)

**The gated diff was in the other repo.** Branch `feat/log-thirteen-hours-no-error` on hub `8dbe941`
— the build-log post the [multi-zone cost doc](research/multi-zone-cost-and-alternatives.md)
recommended, plus three diagrams and a dependency bump. Logged here because this is where the gate
and its memory live; adapted because the hub ships **no Vitest** (deliberately — its AGENTS.md says
a static hub of a few routes doesn't need it) and has no solver core, so two of the three mechanical
checks have no analogue there.

### Mechanical

| Check | Result |
|---|---|
| `npx playwright test` (the hub's only suite) | **30 passed**, 8.0 s — includes 5 new widths |
| `npm run lint` · `npm run typecheck` · `markdownlint --ignore node_modules` | all exit 0 |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** (was 1 high — see below) |
| `npm run build` | ✓ compiled **4.6 s**, 17/17 static pages |
| `npx vitest run` · benchmarks | **no analogue** — hub has neither |

237 insertions across 6 files, but only **9 lines are not prose or binary**.

### Findings

- **A live decision doc still advertised the post as the outstanding next action.**
  `research/multi-zone-cost-and-alternatives.md:95` read *"Do the write-up now instead"* and named a
  working title the published post doesn't use — a textbook reverse-reference miss, and one that
  **file-mirroring could never catch in either repo**: the doc is here, the source that superseded
  it is in `Biscuit-Website`. Fixed in this PR.
- Two accuracy fixes in the post itself, both in its evidence: a blockquote had silently dropped and
  recapitalised two words of a vendor quote, and the log excerpt showed `00:53` runs two paragraphs
  after the post said "midnight UTC" with nothing reconciling them. Fixed in the hub PR.
- Pre-existing, fixed here: `daily-puzzles.yml:8` pointed a reader at *this log* for the outage
  diagnosis rather than at `research/vercel-cron-deployment-protection-outage.md`, which is the
  record that actually carries the evidence and the rejected options.

### Invariants

Slot-key identity, `ON CONFLICT`, retired keys, ownership `WHERE`, migration SQL — **all N/A**; the
diff has no database, query, auth, endpoint or migration. Re-derived rather than trusted: both
load-bearing Vercel quotes (re-fetched live, not from prior notes — one was wrong, above); the
post's "verifies a shared secret in constant time" claim against `route.ts:21-25` (`timingSafeEqual`
over SHA-256 digests — accurate); the YAML the post quotes against the real workflow (faithful
abridgement, `::error::` block verbatim); and the lockfile by hand.

### Lessons

- **A red `npm audit --audit-level=high` on a branch that touched no dependencies is a newly
  published advisory, not your diff.** Check the advisory's version *range* against your existing
  semver range **before** reaching for an `overrides` entry. Here the range was `3.0.0 - 3.15.0` and
  `gray-matter` allows `^3.13.1`, so the patched `3.15.1` was already reachable: a lockfile bump, no
  override, no major, no API risk. The reflex — override to the next major — would have broken
  `gray-matter`, which calls js-yaml 3's `safeLoad`, removed in 4.
- **A gate that enumerates its own targets silently excludes anything new.** The hub's reflow spec
  lists post paths literally, so a new post sits outside the WCAG check until someone adds it, and
  nothing goes red to say so. Same failure shape as the reverse-reference miss above: the check
  passes because it never looked. Worth asking of any allowlist-shaped gate here.

### Review

`/security-review` **not run** — no auth/authz/data-access change, which is the trigger. The one
security-relevant piece was the dependency bump, verified directly instead: `npm audit` clean plus
`npm ls js-yaml` confirming no vulnerable nested copy survives (§6's post-patch check).
**`/code-review` was NOT run** — user-triggered and billed; an agent cannot launch it.

---

## 2026-08-07 — hub grouped into Play / Compete / Print

Branch `feat/hub-reorg` on `bb10da9`, commit `03152de`. ~173 LOC across 6 files; one `.tsx`
(`PuzzleHub`, a presentational Server Component), two e2e specs, three mirrored docs.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **468 passed** (57 files) |
| `npx tsc --noEmit` · `npm run lint` · `markdownlint "**/*.md"` | all exit 0 |
| `npm run build` | ✓ compiled **8.9 s**, 14/14 static pages |
| Benchmarks | **not run** — no solver/generator core touched |
| Hub rendered live | 3 `<h2>`s (Play/Compete/Print); all 8 links HTTP 200 under `/puzzles` |

### Findings

- **The commit cited a doc that was not in the repo.** `PuzzleHub.tsx:26` and `PuzzleHub.md:28`
  named `Docs/qa-remediation-plan.md` as plan of record while that file was still **untracked**, so
  a fresh clone of the branch got a dangling rationale link — the §7 failure mode, arriving from the
  *code* side rather than the doc side. Fixed in the same PR by committing the plan doc.
- Pre-existing, not introduced: `ContinueBanner.tsx:33-35` special-cases `killer` and lets every
  other variant fall through to `${gridSize}×${gridSize} · ${difficulty}`, so a saved **Keisan**
  9×9 hard and a saved **classic** 9×9 hard render identically. Read, not executed.
- **Review follow-up (same PR).** The card assertions were page-wide, so `ContinueBanner`'s
  legacy-key label (`keisan expert`, `killer 6×6 medium`) could match them and fail strict mode.
  Now scoped to `data-testid="hub-card-grid"`. Verified by running these specs against PR #70's
  harness: **12 passed** — which also retires this entry's "written but unproven" caveat.
- Pre-existing, not introduced: `home.spec.ts`'s page-wide `/killer/i` link selector also matches
  `ContinueBanner`'s "Killer · medium" when a free-play Killer game is saved → two matches → strict
  mode failure. Fresh contexts hide it in CI.

### Invariants

Slot-key identity, `ON CONFLICT`, retired keys, ownership-in-query and migrations were all
**checked and found not applicable** — the diff performs no data access, no writes, no key
resolution. Stated rather than skipped silently so the next run knows it was considered.

### Docs

Mirrored `.md` for the one changed `.tsx`. The reverse-reference sweep on the removed **"Free
play"** card caught `src/app/page.md`, `src/app/daily/page.md` and both e2e specs — none of whose
sources this change touched. `Docs/roadmap.md:434` still describes the original flat hub and was
**left alone**: dated entry, completed ✅ phase, historical record.

### Lessons (apply next run)

- **A `.md` cited by committed code must be committed in the same commit.** The reverse-reference
  sweep is normally run doc→code ("what docs mention this symbol?"). It has a mirror image —
  code→doc — that is just as easy to fail: a code comment can name a doc path that no one added to
  git. Grep the diff for `Docs/...\.md` and confirm each hit is tracked.
- **"Committed" is not "verified".** This branch is code complete with lint/build/unit green while
  its two e2e assertions have never executed, because the suite itself cannot run (`baseURL` vs
  `basePath`). Say which is which in the commit message; a reader otherwise assumes a green branch
  is a tested branch.
- **When the dev server belongs to another session, build in an isolated copy.** `next dev` and
  `next build` share `.next`. `rsync` the tree and **hardlink** `node_modules` (`cp -Rl`) — a
  symlink fails with `Symlink [project]/node_modules is invalid, it points out of the filesystem
  root` under Turbopack.

### Re-verified 2026-08-07 (post-rebase onto `eeafac4`, post-review-follow-up)

Rebased after PR #71 landed; one code-review follow-up folded in (locator scoping above). Logged
here rather than as a second entry — same PR, same day.

| Check | Result |
|---|---|
| `npx vitest run` | 468 passed (57 files) |
| `tsc --noEmit` · `npm run lint` · `markdownlint "**/*.md"` | all exit 0 |
| `npm run build` | ✓ 14/14 static pages |
| Hub specs vs PR #70's harness | **12 passed** — retires this entry's "written but unproven" caveat |
| Merge cleanliness | clean vs `main` **and** vs `fix/e2e-basepath`, both directions |

**The 640px claim, re-derived and then observed.** The comment in `PuzzleHub.tsx` asserts the cap
yields exactly 3 columns. Arithmetic: 4 tracks need `4×150 + 3×16 = 648 px` > 640, 3 need
`450 + 32 = 482` ≤ 640. Measured on a **production build** (`next start`): grid 640 px,
`grid-template-columns: 202.664px ×3`, laying out as `§Play / Sudoku·Killer·Keisan / §Compete /
Daily·Leaderboard·Archive / §Print / Print packs`. Reflow: 1 column at 320, 2 at 390–520, 3 at
768+, no horizontal overflow.

> Measurement trap worth keeping: grouping cards into rows by `getBoundingClientRect().top`
> reports **every card on its own row**, because each card carries a `tilt-*` rotation that shifts
> its bounding box by a pixel or two. Group by row midpoint with a tolerance instead.

### Reviews

- `/security-review`: **run — no findings.** Propless Server Component, static literals, no
  user input, no auth/data-access change.
- `/code-review`: **NOT run.** User-triggered and billed; an agent cannot launch it.

---

## 2026-08-07 — daily generation moves off Vercel Cron after a silent outage

Branch `fix/cron-via-github-actions` on `1089316`. Infrastructure + docs; **no application code**
beyond a stale JSDoc, so no benchmarks and no test-count change.

### The incident

`2026-08-07` had **zero** daily boards for ~13.5 hours. No alert, no error, no failed cron run —
because there was no cron run. Vercel invokes crons on the project's **generated** production URL,
Deployment Protection (re-enabled the previous day as mitigation #1 of the multi-zone safety review)
restricts exactly that URL, crons don't follow the resulting redirect, and **redirected invocations
are never written to the logs**. Both halves matter: the first broke generation, the second hid it.

Full diagnosis, evidence table and rejected options:
[research/vercel-cron-deployment-protection-outage.md](research/vercel-cron-deployment-protection-outage.md).

### The fix

A scheduled GitHub Action calls the **custom** domain, which is exempt from Standard Protection, so
protection stays exactly as configured and authorization is unchanged (the constant-time
`CRON_SECRET` check was always the real guard, not the caller's identity). `vercel.json`'s `crons`
block is removed so there is one scheduler, not one working and one silently dead.

Two things the Vercel cron never had: `workflow_dispatch`, so a missed night is recovered without
hand-seeding from a laptop; and a **post-run assertion that the day actually has boards** — the
check that would have caught this in minutes instead of hours.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **464 passed** (56 files) — unchanged from `main`; no source logic touched |
| `npm run build` | ✓ compiled in **10.8 s**, 14/14 static pages (isolated copy) |
| lint · `tsc --noEmit` · markdownlint (`**/*.md`) | all exit 0 |
| Workflow YAML | **parses** — validated with `js-yaml`, already present transitively in `node_modules`; triggers `schedule`+`workflow_dispatch`, cron `7 0 * * *` |
| Workflow shell logic | **run end to end** under `bash -e` with a real `$GITHUB_OUTPUT` handoff: happy path (incl. the idempotent `skipped:true` branch) passes; wrong secret now prints the endpoint's own body; a boardless date still fails the assertion |
| Production restored | `npm run db:seed` (same idempotent service the endpoint calls) — 6 boards, verified live |
| Workflow assertion, dry-run | the verify step's logic run against the real API: `2026-08-07 has 6 board(s)` → PASS |
| Benchmarks | **not run** — no engine/solver core touched |

### Findings

- The local `CRON_SECRET` does **not** match production (a hand probe returned 401). Harmless, but
  it means the repo secret must be taken from Vercel's env, not from `.env.local`.
- The workflow YAML **is** validated locally after all: `js-yaml` is already in `node_modules`
  transitively, so no install was needed. Parsed, and its trigger/step/secret shape checked against
  the repo's two existing workflows. What remains unverified is GitHub *accepting* it — which only
  happens once it is on the default branch, since `schedule:` never fires from a feature branch.
- A stale number caught by this gate run: the entry first recorded 468 tests, measured while the
  working tree still held QA item 5. Split onto its own branch, this diff is 464/56 — unchanged
  from `main`, which is the point.
- Review finding, fixed here: `response=$(curl --fail-with-body …)` discarded the body it captured,
  because the default `bash -e {0}` aborts the step before the next line prints it. Reproduced with
  a wrong token: the log showed only `curl: (22) … 401`, never `{"error":"Unauthorized"}` — in a PR
  whose whole point is legible failure. The assignment now sits inside `if !`, where `set -e` is
  suspended.
- Review finding, fixed here: the verify step recomputed the date instead of using the `isoDate` the
  endpoint returns. A `workflow_dispatch` recovery run started just before 00:00 UTC would generate
  day N and then assert against day N+1, failing a run that succeeded. The date is now handed
  between steps via `$GITHUB_OUTPUT`.

### Invariants checked (§2)

**Verified by running:** *anything AI-wrote that looks plausible* — the workflow's shell is the only
executable code here, so it was re-derived rather than read. Every branch exercised under `bash -e`
with a real `$GITHUB_OUTPUT`: happy path (including the `skipped:true` no-op), wrong secret, a
boardless date, and an `ok:true` response carrying no `isoDate`. The extracted date is confined to
`[0-9-]` by the capture group, so it cannot inject a second line into `$GITHUB_OUTPUT` — checked
against a `\n`-bearing probe, which simply fails to match — and the value reaches step 2 through
`env:` rather than `${{ }}` inside the script, with zero raw interpolations in any `run` block.
Also *idempotency*, which is the one that matters most here — the new caller can be
re-dispatched by hand and retried, so a second run must not re-roll the day.
`generateDailyPuzzles` returns `{ skipped: true, inserted: 0 }` when the date already has boards
(`dailies.service.ts:184`), and that **explicit date guard** — not `UNIQUE(date, difficulty)` — is
what makes a re-run safe, because the assignment is *rolled*: a second run draws different rungs
that have nothing to collide with. Exercised for real today, when `npm run db:seed` restored the
missing day through the same service. **Read, not run:** no slot-key aggregate, no migration, no
ownership predicate — this diff is a workflow file, a deleted config block, and docs.

### Reviews

**`/code-review` has NOT been run — it is user-triggered and billed, and an agent cannot launch it.**

`/security-review` **not run**: this changes *who calls* an endpoint, not its authorization. The
constant-time `CRON_SECRET` check is untouched and remains the only thing that admits a request —
the caller's identity was never part of the guard.

### Lessons

**A scheduler that can fail silently needs an assertion, not a status code.** The endpoint was
healthy throughout; nothing was checking the *outcome*. Any future scheduled job in this repo should
assert the state it was supposed to produce.

**When you close a security gap, audit what was reaching through it.** Locking the generated URL was
correct and stays. The miss was not asking what depended on that URL being reachable — and the
answer was already written down, in `multi-zone-migration-validation.md` §5, a week earlier: *"It
hits the deployment's own generated production URL, NOT your custom domain."*

---

## 2026-08-07 — an archived board stops posing as today's daily (QA item 5 of 6)

Branch `fix/archive-not-today`, rebased onto `38ec174` (was cut from `1089316`). UI labelling only
— no API, no store shape change, no engine code, so no benchmarks.

### The finding

`mode: 'daily'` means "a daily-shaped board", **not** "today's ranked daily". Two things land in
that mode carrying an older `dailyDate`: an archive replay (`ArchiveExperience` starts boards as
`startNewGame(puzzle, 'daily', thatDate)`) and a daily left running past 00:00 UTC. Three surfaces
branched on `mode` alone and told the player all three were today's board:

1. the hub's Continue banner read **"Daily · Hard"**;
2. the `/daily` picker offered **"Continue hard"** directly under "Today's Daily";
3. on resume, the playing header labelled the board by looking its key up in **today's** slots.

(3) is the sharpest, and it is this repo's own recurring trap: **a slot key is not an identity.**
`hard` held Killer on 3 August and Keisan on 6 August, so a 3-August Killer board rendered as
"Hard · Keisan" purely because that is what `hard` means today.

Ranking was never affected — `/api/solve` only accepts today's board and `isExpiredDaily` already
dropped the submit. This is the UI claiming otherwise.

The fix compares `dailyDate` against today (the same test `isExpiredDaily` already made) and labels
the board from its own `variant`/`gridSize` rather than from today's slot list.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **468 passed** (57 files) — was 464/56; +4 tests, +1 file |
| `npm run build` | ✓ compiled in **13.9 s**, 14/14 static pages (isolated copy — a dev server owns `.next`) |
| **Deliberately-broken run** | **1** — pre-fix banner labelling: 1/1 fails |
| Browser repro, end to end | on a date whose `hard` really is a different type from today's: banner "Practice · Hard"; picker "— that's practice from Monday, 3 August 2026, not today's board —"; header **"Hard · Killer · Monday, 3 August 2026 · practice"**, `saysKeisan: false` |
| lint · `tsc --noEmit` · markdownlint | all exit 0 |

### Findings

- A test assertion of mine failed first time against `/Daily · Hard/`: `formatDailyKey` returns the
  raw lower-case rung and the capital comes from a CSS `capitalize` class. Assertions match the DOM
  text, not the rendered text — noted in the test file so the next person doesn't re-derive it.
- Rebase conflict, resolved deterministically rather than by hand: the cron PR and this one both
  prepended an entry to this log, and git split them into **two** conflict regions. Concatenating
  each region would have interleaved the two entries into nonsense. Taking `main`'s file and
  inserting this entry whole — extracted from the replayed commit — is the resolution that cannot
  scramble them. Worth knowing: any two branches that both prepend here will conflict this way.

### Invariants checked (§2)

**Verified by running:** *a slot key is not an identity* — the invariant this diff is about, proven
by the browser repro above on a date where `hard` genuinely holds a different type than today; and
*retired keys stay readable*, since the new label runs every key through `difficultyForKey`, checked
against all five retired shapes (`mini4-easy`→easy, `killer6-hard`→hard, `calc4-easy`→easy, legacy
`killer`→medium, `mini-hard`→hard) with the mini/standard split taken from the board's own grid
size. **Read, not run:** no query, no `ON CONFLICT` write, no migration, no ownership predicate —
this diff touches two client components and their docs.

### Reviews

**`/code-review` has NOT been run — it is user-triggered and billed, and an agent cannot launch it.**

`/security-review` **not run**: no auth, authz, or data-access code is touched. The change is which
words appear next to a board; the submit path it describes (`/api/solve` accepting only today's
board) is unchanged and was already enforced server-side.

### Not fixed here

`DailyExperience` computes `toUtcDateString(new Date())` twice — once for `savedIsFromAnotherDay`,
once for `todayIso` about twenty lines later — because the second is declared after the first is
needed. Same value within a render, so there is no failure to describe; noted so the next reader
knows it was seen rather than missed.

### Lesson

**When one flag answers two questions, split the flag before adding a special case.** `mode` was
being asked both "how should this board behave?" (no live error feedback — right answer) and "is
this today's ranked daily?" (wrong answer). The date needed to answer the second was already in the
saved state, and `isExpiredDaily` was already computing it a few lines away — the bug was three
call sites not asking it.

---

---

---

## 2026-08-06 — the public leaderboard stops shipping account ids (QA item 4 of 6)

Branch `fix/leaderboard-dto` on `92f0665`. No engine code touched, so no benchmarks.

### The finding

`/api/leaderboard` is unauthenticated, and every entry carried `userId` — the better-auth account
id that sessions are keyed to. It was there only so the client could derive two booleans from it:
`isMe` (compare against the session id) and `isBot` (compare against `BOT_USER_ID`). Both are now
decided server-side and the id is destructured out of the mapping, so it never reaches the wire.

Not exploitable on its own — no route accepts a `userId`, and ownership everywhere comes from the
session — which is why this ranked fourth rather than first. It is the enumeration surface OWASP
A01 warns about, and a DTO is the standard answer.

**The non-obvious part was `isMe`.** Deciding it server-side means `getLeaderboard` needs the
viewer's id as an input, so `getCurrentUserId()` moved *above* the board query in the route. That
id must be the session's: a request-supplied one would let a caller ask which row belongs to
someone else. A route test passes `?userId=user-B` while the session is `user-A` and asserts the
session id is what reaches the query.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **464 passed** (56 files) — was 452; +12, +1 file |
| `npm run build` | ✓ compiled in **7.9 s**, 14/14 static pages (isolated copy — a dev server owns `.next`) |
| **Deliberately-broken runs** | **4** — pre-fix DTO: 4/4 fail; viewer id from the query string: 2/2 fail; effect deps without the viewer id: 1/1 fails; deps keyed on the session object: 1/1 fails |
| Live payload check | signed out and signed in on the same board: `userId` absent from the whole response, `isMe` flips correctly |
| Browser check | bot row renders 🤖 + "(bot — beat it!)", own row highlights with "(you)"; no React key warnings after moving the key to `rank`. **Sign-out repro run end to end** on an archived board: header flips to "Sign in", the row stays (public data), `(you)` clears |
| lint · `tsc --noEmit` · markdownlint | all exit 0 |

### Findings

- **Review finding, fixed here: moving `isMe` server-side made it non-reactive, and the fetching
  effect still depended only on `[difficulty, date]`.** Signing out via the header (`signOut()` +
  `router.refresh()`, which re-renders Server Components but not client effects) left the previous
  viewer's row highlighted and labelled "(you)" until a tab switch or reload. Deps now include
  `session?.user.id`. New `LeaderboardView.test.tsx` pins both halves of the choice — one test
  fails without the id in the deps, another fails if it is keyed on the `session` object instead.
- Reverse-reference sweep caught four live docs asserting the client derives the badge from an id:
  `bot-identity.ts`'s own module rationale ("so client components can reference `BOT_USER_ID`"),
  `bot.ts`'s header comment, `bot-identity.md`, and `LeaderboardView.md`. **No client file imports
  `bot-identity` any more** — the split now earns its place one step inward, keeping
  `leaderboard.service.ts` from importing the bot *writer* just to get the id. All four rewritten.

### Invariants checked (§2)

**Verified by running:** ownership — the viewer id reaching `getLeaderboard` is `getCurrentUserId()`,
pinned by a test that passes `?userId=user-B` under an `user-A` session and by a broken run that
swaps in the query param (2/2 fail); retired keys / archived boards — the sign-out repro was done on
an **archived** date's board, which rendered its flags correctly, and the flags are derived from the
row rather than the slot key, so they cannot care what a key means on a given day. **Read, not run:**
no `ON CONFLICT` write, no migration, no cross-date aggregate in this diff.

### Reviews

**`/code-review` has NOT been run — it is user-triggered and billed, and an agent cannot launch it.**

`/security-review` **not run**: the diff *removes* a field from a public payload and adds no auth,
authz, or data-access rule. The one authorization-adjacent change — where the viewer id comes from —
is covered by the test and broken run above.

### Lesson

**A field that exists only to be compared can usually be replaced by the comparison.** Both client
uses of `userId` were equality checks whose answer the server already knew; shipping the operand
instead of the result is what made a public endpoint leak identifiers. When a DTO carries an id the
UI never displays, check whether the client is computing something the server could just state.

---

## 2026-08-05 — the rate-limit key is not forgeable (QA item 3 of 6 — closed with no code change)

Branch `docs/rate-limit-verified` on `7dfa341`. **Docs only.** The security pass suspected that
`clientIp`'s `x-forwarded-for.split(',')[0]` let a caller choose their own rate-limit bucket. It
does not, on this deployment. Measured rather than reasoned, because the platform guarantee has a
caveat that this app happens to sit inside.

### What was measured (production, ~48 small 4×4 PDF requests)

| Probe | Result | Conclusion |
|---|---|---|
| 12 sequential, no header | `200`×10 then `429`×2 | the 10/60 s rule is enforced |
| 12 sequential, each with a different forged `x-forwarded-for` | **identical** | forged header discarded; key is the real client IP |
| 12 **concurrent**, no header | exactly 10 × `200` | counter is shared + atomic → **Upstash is live in prod**, closing a separate "unverified" item from the August audit |
| exhaust via `biscuitlab.net`, then hit `origin-puzzles.biscuitlab.net` | `429` | **same bucket** → the hub preserves the client IP; visitors are not collapsed into one bucket |

Vercel's docs say it **overwrites** `X-Forwarded-For` and does "not forward external IPs… to prevent
IP spoofing" — but that is caveated for "a proxy on top of Vercel", and the hub's rewrite *is* one.
Hence testing rather than trusting. The last row is the one that took a second entry point to get:
`vercel logs` exposed `origin-puzzles.biscuitlab.net` as the rewrite target, which gave a way to
reach the same deployment without the hub and prove both paths key on the same client.

### Findings

- Docs sweep hit `multi-zone-migration-safety-review.md` item (e), which was flagged "REAL, verify
  keying" — the verification it asked for, now recorded there. Its conclusion was right but its
  *mechanism* was wrong ("Vercel appends the client IP"; it overwrites). That distinction is the
  whole bug: appending would have left `.split(',')[0]` attacker-controlled.
- Same doc's mitigation (1) is confirmed done in passing: the generated `*.vercel.app` alias now
  302s to `vercel.com/sso-api`, so Deployment Protection is re-enabled.

### Lessons

**A platform guarantee with a caveat is not a guarantee until you check which side of the caveat you
are on.** "Vercel prevents IP spoofing" is true, and "unless there's a proxy on top of Vercel" was
also true of this app. Both readings were available from the same doc page; only a probe separated
them.

**Prefer a second entry point to a second opinion.** The "does the hub collapse all visitors into
one bucket?" question looked unanswerable from a single client IP, and the workaround was not a
cleverer argument but another door into the same system — worth reaching for whenever a measurement
seems blocked by having only one vantage point.

---

## 2026-08-05 — a mistake count no board can produce (QA item 2 of 6)

Branch `fix/mistakes-plausibility-bound` on `75b61d9`. Second slice of the re-cut August QA list.
No engine code touched, so no benchmarks.

### The finding

**`mistakes` was bounded by the column, not by reality.** `/api/solve` clamped into `[0, 100_000]`
and `recordSolve` clamped again to int4 — both of which keep Postgres happy and neither of which
asks whether the number is *possible*. 100 000 is not a mistake count any board in this app can
generate: the largest, a 9×9 Killer with no givens, admits 648 distinct wrong placements. A probe
sending `99999999999` therefore had `100000` stored verbatim on a **4×4** board and served on the
public leaderboard, where today's `mini-easy` row still shows it — 2 083× that board's real maximum
of 48.

The ceiling now comes from the board: `maxPlausibleMistakes(puzzle.grid)` = `max(100, blanks ×
(size − 1))`, computed in `recordSolve` because that is the layer holding the puzzle. Givens are
excluded by construction — they aren't editable, so they can't be got wrong. The route keeps only
the coercion to a non-negative integer. Measured against today's real stored grids: 100 / 100 / 180
/ 320 / 648 / 648.

**The floor is not decoration — it is the 4×4 bound.** The distinct-placement count alone gives a
4×4 only 30, which a flailing beginner can pass inside one bad session by re-entering the same
wrong digit (the board counts every wrong placement; erasing doesn't decrement). Truncating a
*real* player's count is the failure the bound exists to avoid, so the floor is 100.

**Which boards sit on the floor is a fact about the roller, not about size** — a review pass
caught the first version of this claiming otherwise. Measured: 6×6 *easy* is 16 blanks → 80 and 6×6
*medium* exactly 100, both at or under the floor. They never reach `recordSolve` today because
`rollDailyAssignment` rolls a size for the `mini-hard` slot alone, so every 6×6 daily is `hard`
(125–180). Let `mini-easy` or `mini-medium` roll to 6×6 and those boards quietly become floor-bound
instead of board-derived — the same "a slot key is not an identity" trap logged twice before.

**Still clamped, never rejected** — that half of the original reasoning was right and is unchanged:
`mistakes` never touches ranking, so failing a real solve over a display stat would be the worse
outcome.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **452 passed** (55 files) — was 445; +7 tests |
| `npm run build` | ✓ compiled, 14 static pages — isolated-copy technique per the entry below |
| **Deliberately-broken runs** | **2** — bound reverted to int4-only: 1/1 fails; floor removed: 2/2 fail |
| Real-board verification | bound computed from all 6 of today's stored grids: 100 / 100 / 180 / 320 / 648 / 648 vs a flat 100 000, plus 12 freshly generated 4×4/6×6 boards across all three tiers |
| Self-review passes | **3** — pass 1 and pass 2 each found a wrong measurement claim; pass 3 clean |
| lint · `tsc --noEmit` · markdownlint (`**/*.md`) | all exit 0 |
| Benchmarks | **not run** — no engine/solver core touched |

**The write path was not exercised live, deliberately.** `/api/solve` only accepts *today's* board,
so any end-to-end proof of the clamp means putting a fabricated ranked entry on the public
leaderboard. Covered instead by the service test (which asserts the value handed to the UPDATE),
the broken run, and the real-board bound table above.

### Findings

- A fixture bug caught while writing the test, not by it: `solve.service.test.ts` set the puzzle's
  `grid` to the **solution**, so a bound counting blanks would have read zero and made every
  mistake count clamp to 0 — while the test still "passed" against the wrong expected value. The
  fixture is now a dug grid (41 givens / 40 blanks), matching what the cron stores.
- Review finding, fixed here: `solve.service.md` justified keeping `clampToColumn` as a backstop
  "for a hypothetical board large enough to matter". No such board exists (sizes are 4/6/9, so the
  bound never exceeds 648), and the stated reason hid what the call actually does — sanitising
  non-finite → 0, negative → 0, and truncating fractions, none of which `Math.min` does. Acting on
  the wrong reason and deleting it would let a direct caller's `NaN` reach an int4 column.
- Review finding, fixed here: the original 4×4 bound of 30 was reachable by a real player. Hence
  the floor.
- Review pass 1, fixed here: "6×6 and 9×9 boards clear the floor on their own arithmetic" was false
  — 6×6 easy is 80 and 6×6 medium exactly 100. Rewritten as a fact about the roller (see above),
  which is the part that actually holds.
- Review pass 2, fixed here: "every 4×4 lands here (10–16 blanks → 30–48)" understated the range;
  a 4×4 *easy* measures 7 blanks → 21. Both the JSDoc range and the doc's table are now per-tier
  and measured.

### Lesson

**A clamp that only prevents a crash is not validation.** Both ceilings this repo has had to fix
(`timeMs`'s and now `mistakes`') were originally sized to the *column* — int4 — which is a fact
about storage, not about the domain. Sized to the domain instead (24 hours; blanks × (size − 1)),
they reject garbage the column-sized version accepted. When writing a bound, ask what the largest
value the *application* can produce is; if the answer is orders of magnitude below the column
limit, the column limit is the wrong number.

---

## 2026-08-05 — a well-formed non-date reached Postgres and 500'd (QA item 1 of 6)

Branch `fix/invalid-date-500` on `ccd84ef`. First slice of the re-cut August QA list — the previous
attempt at these findings (`fix/qa-findings-aug-2026`, preserved, not merged) bundled five of them
plus a new endpoint into **1,267 lines across 44 files** and broke things; this is the same work at
one finding per branch. No engine code touched, so no benchmarks.

### The finding

**Shape is not existence, and three routes shipped the difference to the database.** `/api/daily`,
`/api/daily/slots` and `/api/leaderboard` each validated `?date=` with a private
`/^\d{4}-\d{2}-\d{2}$/`. That regex accepts `2026-02-31`, `2026-00-10`, `2026-01-32`, `2026-02-29`
and `0000-01-01` — all of which cleared validation, were compared against a Postgres `date`, and
threw at the **driver**: an unhandled 500 with a stack in the logs, from input the route had already
accepted. Identical failure shape to the `time_ms` int4 overflow in the entry below, which is the
reason to prefer one shared guard (`isIsoDate` in `daily-row.ts`) over three per-route regexes.

`/api/leaderboard` was the worst of the three: the other two also compare `isoDate > todayIso`, which
incidentally caught `9999-99-99` as "future"; this one has no future check, so nothing stood between
a well-formed non-date and the query.

**The rules were measured, not assumed** — every case was run against the live database first, which
is what ruled out both tempting shortcuts: rejecting all February 29ths breaks `2024-02-29` (a real
day, verified 200), and flooring the year at the project's own history breaks the archive's honest
"no puzzles that day" answer. Year zero is rejected because the SQL calendar runs 1 BC → AD 1, so
`0000-01-01` 500s where `0001-01-01` is fine.

**A fourth route had the same bug and was missed on the first pass** — found by the review, not by
the fix. `/api/me/progress` never took a `?date=`, so it wasn't in the sweep; it takes a `?month=`
and *derives* two dates from it. `ISO_MONTH` admits `0000-01`, which expanded to
`0000-01-01 … 0000-01-31` and 500'd identically. The guard there validates the **derived bounds**
rather than adding a second regex, so whatever `lastDayOfMonth` produces is checked too. That
mattered: `lastDayOfMonth` used `Date.UTC(year, …)`, which maps years 0–99 to 1900–1999, so
`0000-02` computed February 1900 (28 days) where year 0 is a leap year (29) — clamping the query
without rejecting the year would have traded a loud 500 for a silently wrong range. Now built with
`setUTCFullYear`.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **445 passed** (55 files) — was 431/54; +14 tests, +1 file |
| **Deliberately-broken runs** | **2 run** — guard reverted to shape-only: 9/9 new assertions failed; month guard removed: 1/1 failed |
| Runtime verification | **35 live requests** across the 4 routes (see below) — every previously-500 input now 400, real dates still 200/404 |
| `npm run build` | ✓ compiled in **6.5 s**, 14 static pages, 24 routes — run in an isolated copy (see below) |
| lint · `tsc --noEmit` · markdownlint (`**/*.md`) | all exit 0 |
| Relative-link check | 4 new cross-doc links, 0 broken |
| Diff size | 365 insertions / 26 deletions across 13 files + a 74-line new test file — inside the <400 target |
| Benchmarks | **not run** — no engine/solver core touched |

**Building while a dev server is running needs an isolated copy.** `next build` and `next dev` both
own `.next`, so building in place corrupts the running server (and vice versa). `rsync` the tree
minus `node_modules`/`.next`/`.git` to a scratch dir, then **hard-link** `node_modules`
(`cp -al`) — a *symlink* fails outright with `TurbopackInternalError: Symlink [project]/node_modules
is invalid, it points out of the filesystem root`. Delete the copy afterwards: it contains
`.env.local`.

### What was actually measured

Pre-fix, against the live database on `main` — **12 (route, input) pairs returned 500**, across
these inputs:

| Input | `/api/daily` | `/api/daily/slots` | `/api/leaderboard` | `/api/me/progress` |
|---|---|---|---|---|
| `2026-02-31` | 500 | 500 | 500 | — |
| `0000-00-00` | 500 | 500 | 500 | — |
| `0000-01-01` | — | 500 | — | — |
| `2026-02-29` | — | 500 | — | — |
| `2026-00-10` | — | 500 | — | — |
| `2026-01-32` | — | 500 | — | — |
| `9999-99-99` | 400 † | 400 † | **500** | — |
| `0000-01` (month) | — | — | — | **500** |

† Caught incidentally as "future" by `isoDate > todayIso`, which those two routes have and
`/api/leaderboard` does not — the reason the fix is one shared guard rather than three regexes.
Cells marked `—` were not probed on `main`; the guard is shared, so post-fix verification covered
the full grid.

Post-fix: **45 live requests** (8 dates × 3 routes + 3 default-date + 5 `?month=` + 3 re-checks +
10 closing the gaps below). Every input above now returns 400; `2024-02-29`, `1999-12-31`,
`0001-01-01`, `0001-01` and the no-parameter defaults still return 200/404. The archive page's own
traffic is all 200 — the guard rejects nothing the app itself sends.

**Probe `/api/leaderboard`, not the other two, when checking this guard.** It is the only one of the
three with no `isoDate > todayIso` check, so its status isolates `isIsoDate` instead of confounding
it with the future rule. `2400-02-29` returns 400 `Cannot fetch a future daily` on `/api/daily/slots`
— which looks exactly like a leap-rule bug and is not one. On `/api/leaderboard` the same date
returns 404 (accepted; no puzzle that day), while `2400-02-30` and `2100-02-29` return 400. That
trio verifies the ÷400/÷100 century rule at runtime, where previously only the unit test covered it.

### Invariants checked (§2 of `/pre-merge`)

Only what the diff touches. **Verified by running:** archived dates still resolve through the new
guard (`/api/daily/slots?date=2026-07-11` → 4 slots; empty days → `{slots: []}`, not an error), and
ownership still comes from the session (`/api/me/progress` BOLA tests pass, and the new guard sits
*after* `requireUserId()`, so a signed-out caller still gets 401 before any parameter is read).
**Read, not run:** slot-key aggregation, `ON CONFLICT` idempotency, and migrations — untouched by
this diff, which changes validation only. The AI-written part (`isIsoDate`'s leap arithmetic) was
re-derived rather than trusted: 204 year/month combinations checked against an independent
reference, plus the runtime century-rule trio above.

### Reviews

**`/code-review` (hosted, billed) has NOT been run — an agent cannot launch it.** That decision is
the owner's.

`/security-review` **was** run (agent-invocable) and returned **no HIGH or MEDIUM findings**. Its
summary: every changed call site narrows the accepted input set rather than widening it; all values
still reach parameterized Drizzle builders with no `sql.raw`/`sql.identifier` introduced; the new
check in `/api/me/progress` sits after the authorization check, so the 401 path is unchanged;
rejection messages echo no user input and no exception detail. Net effect is a *reduction* in
attack surface — an unauthenticated request could previously drive three routes into an unhandled
driver exception (OWASP A10) that logged a stack trace.

### Lessons

**A validator that checks a value's *shape* has not checked that the value *exists*.** All three
500s fixed on this repo in two days (`time_ms`, `?date=`, `?month=`) have the same skeleton: a
permissive check accepts input, and the storage layer does the rejecting — so the error surfaces as
a 500 at the driver instead of a 400 at the boundary. When a validator's output is handed to a typed
column, the question to ask is "can the column hold every value this check admits?", not "does it
look right?".

**Sweep for the *sink*, not the parameter name.** `/api/me/progress` was missed because the sweep
looked for routes taking a `?date=`, and it takes a `?month=` — the bug lives where a string reaches
a `date` column, which is two derived values away from the parameter. Next time a class of bug is
being closed repo-wide, grep for what touches the column (`getDailyProgress`, `eq(…date…)`), not for
the request field, and validate the value that is actually *sent* rather than the one received.

**Don't write "measured" next to a case you reasoned about.** Three review passes over this branch
found three defects and **all three were in prose, none in logic**: a comment that inverted the guard
order, invented request counts in this log, and a test titled "each one previously a 500" when two of
its six inputs had been observed returning 400. The logic survived every pass; the claims about it
did not. Two rules follow. Write the measurement claim only when the command is in the transcript —
otherwise say "by construction". And when a probe's status code could come from more than one guard,
**read the response body**, or probe the route that has only the guard under test: `2400-02-29`
returns 400 on `/api/daily/slots` from the *future* check, which reads as a leap-rule bug and isn't
one.

---

## 2026-08-05 — three review findings: a client-only rule, a raced UPDATE, an int4 overflow

Branch `fix/solve-and-username-hardening` on `0096073`. Closes all three findings from a
whole-of-`main` review (the range diff was empty — `main` was level with `origin/main`, so the review
had no PR to scope to and took the branch state instead). No engine code touched, so no benchmarks.

### The findings

**1 · The username rule was enforced on the form, not the endpoint.** `USERNAME_RE` was a literal
copy-pasted into `UsernamePrompt.tsx` and `AccountBadge.tsx` and existed **nowhere on the server**.
Confirmed from better-auth's own source rather than inferred: `parseInputData` runs
`fields[key].validator?.input` when present and otherwise falls through to
`parsedData[key] = data[key]`, so `type: 'string'` bought a type check and nothing else. A direct
`POST /api/auth/update-user` therefore put any string into an unbounded `text` column that renders
on the public leaderboard via `coalesce(username, name)` — a 10,000-char handle, a bidi override, or
a plain `"Puzzle Bot"`. Not XSS (React escapes), but layout breakage, impersonation, and the one
write path in the app skipping **authorize → validate → mutate**.

**2 · `UNIQUE(user_id, puzzle_id)` was never the one-ranked-attempt guard.** `recordSolve` read
`attempt.completed` and then issued an *unconditional* UPDATE — two round-trips, no transaction
(`neon-http` is stateless). Two concurrent submissions both read `false` and both wrote, so a raced
double-submit kept the better of two claimed times. The unique index caps one attempt **row**; it
says nothing about the `completed` transition, which is the thing being raced. Now a conditional
`WHERE … AND completed = false`, atomic in one statement.

**3 · `timeMs` had a floor but no ceiling.** `time_ms` is int4. A submitted `1e12` passed the route's
finite/non-negative check, cleared the plausibility floor — which by construction only rejects times
that are too *small* — and failed at the **driver** mid-UPDATE, escaping the typed-`SolveError` path
as an unhandled 500. Route now bounds at 24h; `mistakes` is clamped rather than rejected (cosmetic,
never worth failing a real solve over); the service clamps both as a column-level backstop.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | **431 passed** (54 files) — was 399/52; +32 tests, +2 files |
| **Deliberately-broken runs** | **2 run** — 4/4 then 2/2 new assertions failed without the fix |
| `npm run build` | ✓ compiled in 6.1 s, 14 static pages — run as its own gate, since eslint does not type-check |
| lint · markdownlint (`**/*.md`) · audit | all exit 0 |
| Relative-link check | 95 links + 2 in-page anchors — 0 broken |
| Client-bundle check | zod absent from all 23 chunks; regex present |
| Diff size | 354 code lines (**213 of them tests**) + docs — inside the <400 target |
| Benchmarks | **not run** — no engine/solver core touched |
| Known-flaky check | table read first; its one entry (`calc-sudoku` "hard leans on ×") was fixed in `0096073`, this branch's own base — no flake seen in 5 full runs |

### Invariants checked (gate step 2)

Only what the diff touches:

- **Ownership lives in the query — checked, and tightened.** The UPDATE's WHERE still carries
  `eq(userId, requireUserId())`; the new predicate narrows it. Non-vacuously asserted: the test
  compares the *whole* filter expression with `toStrictEqual`, so dropping any of the three
  predicates fails it.
- **Migration safety — N/A, and verified rather than assumed.** `schema.ts` appears in the diff, so
  it was checked for a schema change: filtering the diff to non-comment lines returns **empty**. It
  is a JSDoc correction only, so `drizzle-kit` has nothing to emit and no migration is needed.
- **Slot key is not an identity — N/A.** No cross-date aggregate touched. `recordSolve`'s floor
  still derives from the stored `(variant, size, difficulty)` via `difficultyForKey`, unchanged.
  Confirmed the new clamp cannot perturb it: clamping only lowers values above 2.1 × 10⁹ ms
  (≈24.8 days), which are far above every floor, so no floor decision changes.
- **`ON CONFLICT DO NOTHING` / randomised inputs — N/A.** No new retry-safe write; the change is to
  an UPDATE, not an upsert.
- **Retired keys — N/A.** Key validation untouched; `isDailyDifficulty` not in the diff.
- **AI-written logic re-derived.** Every load-bearing claim was verified against something external
  rather than reasoned about — see *Verified vs. read*.

### Findings from the review pass

None outstanding. Two things worth one line each:

- **Anchoring checked, not assumed.** `/^…$/` is safe here because JS's `$` is end-of-input — unlike
  Python's, which matches before a trailing newline. Verified empirically (`"abc\n"` rejects), since
  this is the standard way an allowlist regex leaks.
- **The module split was justified by measurement, not taste.** `username.ts` (constants, zero
  imports) is separate from `username-schema.ts` (zod) so the schema stays out of the client bundle
  *and* stays unit-testable without booting the `server-only` auth instance. Grepping the built
  chunks confirms zod did not leak.

### Docs

Mirrors for all 7 touched source files, plus 2 new ones. The **reverse-reference sweep earned its
keep this run — and then failed on its second pass**, see below.

New research record: **[daily-solve-time-trust.md](research/daily-solve-time-trust.md)**, written
for the one review observation deliberately *not* reported as a defect. `/api/solve` behaves as
designed; what the doc records is that the design buys less than the code comments imply. The
finding worth keeping: **`minSolveMs` is compared against the client-supplied `timeMs`, so raising a
floor buys nothing at any value** — a scripted submit just says `floor + 1`. Since `/api/daily`
serves the solution publicly (deliberately, for hints), first place on `mini-easy` (4×4, 3 s floor,
bot at 40 s) is four HTTP requests with no puzzle solved.

Not fixed here, on purpose: the available guard (bound submissions by `solve_attempts.created_at`,
already stamped and unused) needs `/api/daily/start` to stop being fire-and-forget first, or it
false-rejects honest fast solves on the 3 s minis — a worse outcome than a scripter on a flavor
leaderboard. **Gated against Phase 9 instead**, narrowly: flat-rate crumbs need nothing, but a
speed-scaled mint or a time-decided S6 battle needs it first. Gate lives in `roadmap.md` (linked
from both the Phase 9 header and QA Stage 2), with pointers from
`social-progression-economy-plan.md` and `solve-rules.md`.

### Verified vs. read

**Executed:** better-auth's `parseInputData` read directly in `node_modules` to confirm the
passthrough; zod v4's `~standard` contract probed for synchronous return; two deliberately-broken
runs; the built client chunks grepped for zod; regex anchoring probed against 9 inputs; all gates.
**Read only:** the concurrent double-submit is reasoned from the driver's statelessness and modelled
in tests — not reproduced against a live Postgres.

### Reviews

`/security-review` **run** — clean, no HIGH/MEDIUM. It covered auth (`username` validation) and
data-access (the solve UPDATE), which AGENTS.md §4 requires.
**`/code-review ultra` run by the owner** (agents cannot launch it — user-triggered and billed).
One `nit` returned: the reverse-reference sweep missed three stale server-timing claims. Verified
rather than accepted — the confirming grep found **five**, including two the hosted review did not
report, both in files this PR had already edited. All five fixed here; see the sweep rule below.
The three original findings came from an in-session review pass on `main`.

### Rules this run produced

- **A validation rule that lives only in a component is not a validation rule.** Ask where the
  *endpoint* enforces it. Two copies of a regex is a smell; two copies with zero server-side
  enforcement is a hole, and the duplication hides it by making the rule look well-established.
- **A `UNIQUE` constraint constrains rows, not state transitions.** If the invariant is "one
  *completed* attempt" and the flag is a column, the predicate belongs in the UPDATE's WHERE. A
  read-then-write pair is not a guard on a driver with no transactions.
- **A lower bound is not a bound.** `isImplausiblyFast` reads like input validation, so `timeMs`
  looked validated. Any client-supplied number heading for an `integer` column needs a *ceiling*,
  and the column type — not the domain — is what makes it mandatory.
- **A doc claim can go stale without anyone editing it.** `schema.md`/`schema.ts` had said `time_ms`
  is "SERVER-COMPUTED … never trusted" since 4.4; the switch to client timing silently falsified it,
  and `roadmap.md` repeated it. Mirroring cannot catch this — nobody touched those files. **When a
  design changes, grep for prose asserting the property you just removed**, not just for renamed
  symbols.
- **Do the sweep as a grep, not as a reading.** ⚠️ The rule above was written *in this entry* and
  then immediately under-executed: the first pass found three hits by reading the files it was
  already editing, and a hosted review found more. The full
  `grep -rn 'server-timed\|server-computed\|server-measured' Docs/ src/` surfaces **eight**, of which
  five were live and stale:

  | Location | Why it was missed |
  |---|---|
  | `roadmap.md:50` | Same file as the fix at :388, 338 lines above it |
  | `schema.md:75` | Same file — prose corrected, the `text` block under it was not |
  | `solve.service.ts:85` | JSDoc on `recordSolve`, the function being rewritten |
  | `social-progression-economy-plan.md:47` | Active Phase 9 plan — never opened |
  | `social-progression-economy-plan.md:185` | Same |

  Reading finds hits in files you already have open, which is precisely the set mirroring already
  covers. The grep is the whole value. **Two of the five sat in files this PR had already edited**,
  so "I updated that file" is not evidence its other claims are current.
- **A stale premise in a *planned* doc outranks a stale one in a shipped doc.** The two
  `social-progression-economy-plan.md` hits were the load-bearing ones: Phase 9 is marked
  implementation-ready, so its "server-computed time" premise would have been *designed against*.
  Anyone building the S6 speed-based earn rule or async battles would have assumed a trusted clock.
  Both spots now say what is actually guaranteed (completion is verified; duration is not) and name
  the decision that inherits the risk, rather than just swapping the adjective.

---

## 2026-08-04 — `/code-review` finding fixed: seeded generation was never seeded

Branch `fix/keisan-test-flake` on `77f7cef`. Closes the one finding from the hosted-style review pass
below. Touches two engine cores (`calc-generator.ts`, `killer-sudoku.ts`), so benchmarks were
mandatory — and they produced the most interesting result of the run.

### The bug

`generateUniqueCalc` bound `const rng = options.rng ?? Math.random` and then called
`fillGrid(solution, config)` **without it**. The Latin square is the *first* random step and every
later one reads its values, so a caller's seed controlled only the tail. Proof, not inference:

```text
generateUniqueCalc(6, { rng: seededRng(555), maxSize: 3 })  ×2
  before:  solutions identical: false   cages identical: false
  after:   solutions identical: true    cages identical: true
```

**Eight** seeded call sites were affected. The docblock says *"Injectable for deterministic tests"* —
a documented contract the code did not honour, which is why this could not stay deferred.
`killer-sudoku.ts` (2 sites) had the identical omission but **dormant**: every seeded caller there
passes `solution: SOL9`, skipping the branch. Its `killer-sudoku.md` nonetheless already claimed the
pipeline was fully deterministic — a doc asserting a property no caller exercised. Fixed both.

### The judgment call, and why it isn't the obvious one

Threading `rng` while keeping the old fixed seeds would have made those fuzz loops **fully**
deterministic — pinning them to ~24 grids forever. That is a genuine *coverage loss*, because the
bug meant their Latin squares had been varying every run. The original deferral's stated reason
("makes those tests suddenly deterministic") was therefore correct, and was handled rather than
overridden: these assert *properties* that must hold for all boards (soundness, uniqueness, tier
caps), not exact outputs, so per this project's already-adopted rule (Dutta et al.) they now draw a
random `BASE_SEED` per run and report it on failure. Coverage preserved; a red run replayable for the
first time.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) |
| **Randomized-seed repeats** | **12/12 clean** — the new variability is the risk, so it was measured |
| lint · build · markdownlint · audit | all exit 0 |
| Relative-link check | 278 links / 229 files — 0 broken |
| `benchmark-calc.ts` · `benchmark-killer.ts` | run — no regression, established by A/B below |

### Findings

**None outstanding.** One scare, resolved:

Killer benchmarks came in ~30% above the 31 July baseline across *every* tier including the n=20
ones — a different signature from ordinary small-n noise, so it was not waved off. A same-machine,
same-session A/B settled it:

| Tier | base #1 | base #2 | fix #1 | fix #2 |
|---|---|---|---|---|
| Easy (20×) | 10.60 | 13.25 | 16.85 | **10.85** |
| Hard (20×) | 479.35 | 497.25 | 513.50 | **313.35** |
| Expert (10×) | 712.60 | **269.00** | 442.90 | **227.20** |
| Extreme (5×) | 6770.60 | 8964.40 | 12754.80 | **6056.80** |

**Two runs of *identical* pre-fix code swing Expert by −62%.** That is the noise floor. The fixed
build then posts the *fastest* figure for Hard, Expert and Extreme. Regression excluded — consistent
with the change being provably a no-op on the default path, where `rng === Math.random`, exactly what
`fillGrid`'s default parameter already was. All 34 rows are committed; the interleaving is the
evidence.

### Docs

Mirrors updated for both engine files. `calc-generator.md` gains a warning that `rng` must reach the
Latin square and that a passing suite will not reveal otherwise; `killer-sudoku.md` records that its
determinism claim was false-but-unfalsifiable until now. Research doc's deferred follow-up flipped to
✅ with the measured before/after.

### Verified vs. read

**Executed:** same-seed equality before *and* after the fix; 12 randomized-seed full-suite repeats;
four benchmark runs across two code versions on one machine; all gates.
**Read only:** nothing.

### Reviews

`/security-review` **not run** — no auth/authz/data-access code.
**`/code-review` NOT run by me** — user-triggered and billed; an agent cannot launch it. The finding
this entry closes came from an owner-triggered run.

### Rules this run produced

- **An injectable-RNG option is a claim that needs a test.** Seeding fails *silently and toward more
  entropy*: the tests still pass, they are just secretly random. Any `rng`/`seed` parameter should
  have one same-seed equality assertion, or it will rot into decoration. Eight call sites trusted
  this one for months.
- **"Deferred because fixing it changes test coverage" is a reason to fix the docs *now*.** The
  deferral was sound about the tests and silent about the docblock, which kept promising determinism
  the code never delivered. Split the two: defer the behaviour, never defer the correction.
- **A cross-tier benchmark shift needs a same-machine A/B before it counts.** Comparing to a baseline
  from another day conflates code with machine state. Two runs of identical code here differed by
  62% — larger than the "regression" being investigated.

**Verdict:** gate green. Not merged — owner's call.

---

## 2026-08-04 — Keisan flake branch, re-gated after the follow-up fixes

Branch `fix/keisan-test-flake` on `77f7cef`, 3 commits · 778+/21− across 10 files, but only
**42+/6− of source** — the rest is 57 lines of tests and 679 of docs. Re-run of the entry below
after the five review follow-ups were closed on the same branch.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) |
| **Full-suite repeats** | **10/10 clean** (plus 4 earlier this session — 14 post-rebase, 0 failures) |
| `npm run lint` · `npm run build` · `markdownlint` · `npm audit` | all exit 0 |
| Relative-link check | 275 links / 229 files — 0 broken |
| `benchmark-calc.ts` | run on a **quiet** machine — no regression, see below |

### Findings

1. *(fixed in-PR)* `research/keisan-test-flake-and-bent-ratio-divergence.md:84` still asserted the
   other two structural figures *"check out"* — the same overstatement corrected in the walkthrough
   an hour earlier, left behind here. A reader comparing the two docs would find this one blessing
   `~39%`/`~96%` while `calc-sudoku.md` carries 38%/94%. **The instructive part:** the follow-up pass
   that produced the rule *"a contradiction between two documents is a cue to grep, not reconcile"*
   then applied it to the *figure* and missed the *claim about* the figure. Grep the assertion, not
   just the number.

### The flake fix: mechanistic first, statistical second

14 clean post-rebase full-suite runs is **suggestive, not decisive** on its own — at a 12.5% per-run
rate, P(0 failures in 14) ≈ 15%. State it honestly rather than implying proof. The real confidence is
**mechanistic**: the failure was a *timeout*, and the ceiling moved 5000 → 30000 ms against a test
needing 157–673 ms of CPU and a worst-ever loaded observation of 4698 ms. That is ~6× headroom over
the worst thing ever seen, plus `maxWorkers: '50%'` removing the contention that caused the stretch.
Recurrence is structurally implausible independent of how many green runs accumulate.

### Benchmarks: sample size explains the whole "regression"

Ran quiet, after the repeat batch finished, so nothing contended:

| Tier | n | Aug 3 baseline | Quiet run | Loaded runs |
|---|---|---|---|---|
| Easy | 20 | 7.45 | **7.45** | 9.65 / 9.45 |
| Hard | 20 | 11.50 | 13.10 | 13.55 / 13.55 |
| Expert | 10 | 398.40 | 384.60 | 398.90 / 611.90 |
| Extreme | **5** | 1014.60 | 1681.20 | 1999.20 / 3167.80 |

**The n=20 tiers land on baseline — Easy identical to two decimals — while only the n=5/n=10 tiers
swing.** Combined with the code being provably a no-op on the default path, that closes it: there is
no regression, and the earlier alarming numbers were small-sample lottery plus machine load. 18
benchmark rows are committed from today rather than pruned; the spread *is* the evidence.

### Invariants checked

No daily, DB, auth or migration files in the diff — verified by filename sweep, so slot-key identity,
`ON CONFLICT`, retired keys, ownership-in-query and migration SQL are all N/A rather than skipped.
The one AI-plausible item was re-derived: across the whole branch the only executable engine change
is `fillGrid(solution, latinConfig, rng)`, identical on the default path
(`rng = options.rng ?? Math.random`; `grid-utils.ts:117` already defaulted that parameter the same
way) with no production caller passing a seed.

### Docs

Both touched `.ts` files have mirrors updated in-diff. `Docs/archive/keisan-walkthrough.md` keeps its
`~61%`/`~39%` correctly — annotated with a dated Correction note, not rewritten.

### Verified vs. read

**Executed:** every gate; 10 full-suite repeats; the benchmark on a quiet machine; the reverse sweep
on tracked files; the `rng` default chain read through to `grid-utils.ts:117`.
**Read only:** nothing outstanding — the previously read-only 400-trial validation was re-derived
independently (see the entry below).

### Reviews

`/security-review` **not run** — no auth/authz/data-access code.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

### Rules this run produced

- **The flaky-tests table can invert.** When an entry is marked resolved *by the branch under
  review*, that test failing **implicates the diff** instead of excusing it. Read the Status column,
  not just the test name.
- **A `grep` over tracked files is not the same as a `grep` over the working tree.** The first sweep
  here was entirely polluted by a stale `.claude/worktrees/` checkout — a separate working copy whose
  pre-rebase files look exactly like unfixed hits. Use `git ls-files | xargs grep` when the question
  is "what does this branch still contain".
- **Benchmark noise is a sample-size story, so read the `n` column first.** The n=20 tiers here
  reproduce baseline to two decimals while n=5 swings 3×. A "regression" that appears only in the
  small-n rows is a measurement, not a change.

**Verdict:** gate green. Not merged — owner's call.

---

## 2026-08-04 — Keisan test flake killed (three causes), rebased onto the docs move

Branch `fix/keisan-test-flake` on `77f7cef` · authored on `341b987` in a parallel worktree, rebased
5 commits forward · engine + tests + config + docs.

The substance is in the commit message and
[`research/keisan-test-flake-and-bent-ratio-divergence.md`](research/keisan-test-flake-and-bent-ratio-divergence.md):
three unrelated problems shared one test name — worker oversubscription (~11 forks on 12 cores), a
second heavy-tailed timeout visible only over 30 runs, and a genuine *statistical* flake whose
`> 0.4` threshold sat 2.1 sd below its true mean. Also fixes a latent bug where `rng` was never
threaded into `fillGrid`, so seeded callers silently got random Latin squares.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) |
| `npm run lint` | clean |
| `npm run build` | compiled |
| `npx markdownlint-cli` | clean |
| `npm audit --audit-level=high --omit=dev` | exit 0 |
| Relative-link check | 274 links / 229 files — 0 broken *(after the fixes below)* |
| `benchmark-calc.ts` | run — engine core touched. **No regression; see Findings 2** |

### Findings

1. **The rebase silently broke a doc link, and a link checker only caught half of it.** This work was
   authored on `341b987`, before #56 moved `keisan-walkthrough.md` into `Docs/archive/`. Git's rename
   detection correctly re-targeted the *edits*, but not the relative links inside the moved file:
   `](research/…)` at `archive/keisan-walkthrough.md:391` resolved one level too shallow. Fixed to
   `../research/…`. **The second instance was invisible to tooling** — the research doc names
   `Docs/keisan-walkthrough.md` in *prose*, which no link checker parses. Found only by grepping the
   moved filename as a bare string.
2. **An apparent 2× benchmark regression is noise, established rather than assumed.** Against the
   2026-08-03 baseline: Extreme 1014→1999 ms, Mystery 24→77 ms. Two independent checks say measurement,
   not code:
   - *Provably behaviour-neutral on the default path.* The only functional line is
     `fillGrid(solution, latinConfig, rng)`. `calc-sudoku.ts:316` sets `rng = options.rng ?? Math.random`
     and `grid-utils.ts:117` **already defaulted that parameter to `Math.random`** — so the call is
     identical unless a caller passes a seed, and no production caller does (checked: `api/puzzle/route.ts`,
     `dailies.service.ts`).
   - *Re-ran the benchmark on the same commit.* Expert 398.90→611.90, Extreme 1999.20→3167.80, Mystery
     77.40→47.10 ms. Back-to-back variance equals or exceeds the "regression". Extreme samples 5
     puzzles, Mystery 10. **Both runs are committed deliberately** — two adjacent rows reading 1999 and
     3167 document the noise floor better than any comment could.
3. *(carried in, then closed)* The commit originally landed **five review findings unfixed**. All five
   were resolved in a follow-up pass on this same branch before merge — see the research doc's
   now-✅ section. Two produced more than a doc edit:
   - **The 0.39 threshold was re-derived, not copied.** The review pass recorded a seeded-path
     re-measurement; an independent 400-trial run replicated its mean and sd (0.4809 / 0.0247 vs
     0.4812 / 0.0270) but **not its minimum** (0.4096 vs 0.3934). Its inference that `> 0.40` *would*
     have breached therefore **does not replicate** — 0/400 at `> 0.40` on the re-run. The threshold
     stays at 0.39 (0/400 on both runs, 3.38–3.68 sd); the discredited justification is struck.
   - **A sixth issue fell out of fixing #5.** The review found the walkthrough contradicting
     `calc-sudoku.md`, but the same stale `~39%` also sat in `calc-sudoku.md:56` **and the source
     comment at `calc-sudoku.ts:121`**, untouched by the change. Found by grepping the figure rather
     than reconciling the two documents in hand.

### Invariants checked (only those the diff touches)

- **Slot key / `ON CONFLICT` / retired keys / ownership / migrations** — N/A, no daily, DB or auth code.
- **Archived-doc rule (§7)** — the walkthrough edit **annotates, does not rewrite**: the wrong `~61%`
  is left in place with a dated *Correction* note saying so explicitly. This is the correct treatment
  and was verified by reading the diff, not inferred from the commit message.
- **Assertions not weakened alongside the code they cover** — checked, since "fix the flake" is the
  classic cover for loosening a test. The threshold moves 0.4→0.39 but `N` doubles 14→28, taking it
  from 2.1 sd to 3.4 sd (0/400 runs); the other two assertions are 4.1 and 5.0 sd and are untouched.
  The sample stays random with the seed logged on failure, rather than being pinned — which would
  have stopped it detecting distribution shifts.

### Docs

`calc-sudoku.md` mirrors `calc-sudoku.ts`; `vitest.config.md` is new for `vitest.config.ts`. Reverse
sweep found the two stale references in Finding 1. The **Known flaky tests** table above is marked
resolved rather than deleted — branches cut before this fix still hit the flake, and the answer
should still be findable.

### Verified vs. read

**Executed:** all six gates; the benchmark **twice**; the link resolver; the `rng` default chain read
through to `grid-utils.ts:117`; the production callers grepped.
**Read only:** the 22-run flake verification and the 30×/300×/400× statistical sampling behind the
threshold change — reproducing those costs hours and the research doc records the method and raw
figures. The single post-rebase full-suite run passed, which is consistent but is not by itself
evidence a ~10–15% flake is gone.

### Reviews

`/security-review` **not run** — no auth/authz/data-access code; changes are test config, a test
threshold, an RNG-threading fix and comments.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

### Rules this run produced

- **A rebase across a file *move* needs a link check, not just a clean merge.** Git re-targets edits
  by rename detection and reports no conflict, while every relative link *inside* the moved file is
  now wrong by one level. "Rebased cleanly" says nothing about link integrity.
- **Grep the moved filename as a bare string, not just as a link.** Prose references
  (`` `Docs/foo.md:347` ``) are invisible to any resolver that only walks `](…)`, and they rot exactly
  as fast.
- **Before believing a benchmark regression, re-run the benchmark.** On small-n randomized generators
  the run-to-run spread here reaches ~60%. One number against one baseline is not a measurement.
- **A minimum is not a measurement.** Mean and sd replicate across runs; the *extreme order statistic*
  does not. Two 400-trial runs here agreed on mean to 3 decimals and disagreed on the minimum by more
  than the min's own distance to the threshold. Never let "the worst sample we saw" carry an argument
  on its own — if a threshold decision rests on a min, re-run before citing it.
- **A contradiction between two documents is a cue to grep, not to reconcile.** Fixing the two files
  in hand would have left the same stale figure in a third file and a source comment. The pair you
  noticed is rarely the whole set.

**Verdict:** gate green. Not merged — owner's call. All five review follow-ups now closed (Finding 3).

---

## 2026-08-04 — jsdom 30 + CI on Node 22, retiring the undici override

Branch `fix/jsdom30-node22` on `6eb4f56` · supersedes
[#40](https://github.com/zfert99/Puzzle-Generator/pull/40) · 4 lines of `package.json`, 2 of
`ci.yml`, plus the lockfile.

`jsdom` ^29.1.1→^30.0.1 · `@types/node` ^20→^22 · **`overrides.undici` removed** ·
`ci.yml` `node-version` "20"→"22" (both jobs).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) |
| `npm run lint` | clean (exit 0) |
| `npm run build` | compiled, all routes emitted |
| `npm audit --audit-level=high --omit=dev` | **exit 0** — still green *without* the override |
| `npx markdownlint-cli` | clean |
| Benchmarks | **skipped — 0 engine files touched** |

### Findings

1. **Merging #40 as dependabot wrote it would have left a silent major-version mismatch.** jsdom
   30.0.1 declares `undici: ^8.9.0`. Our `overrides.undici: ^7.29.0` is *stronger than* a resolution
   hint — it would have forced `undici@7.29.0` under jsdom 30, satisfying a `^8.9.0` dependency with
   a **major version below its floor**. The full suite passes either way, which is exactly what makes
   this dangerous: nothing in the gate would have flagged it, and the breakage would surface later
   against a tree nobody would think to connect back to this PR. Removing the override lets npm
   resolve `undici@8.10.0` as jsdom intends. **Verified both ways** — with the override, the lock
   pins 7.29.0; without it, 8.10.0, and the audit stays green because 8.x was never in the vulnerable
   `7.0.0 – 7.28.0` range.
2. **The engine floor is advisory here, not load-bearing.** jsdom 30 declares
   `^22.22.2 || ^24.15.0 || >=26.0.0`; the full suite was run on Node **24.13.1** — *below* that floor
   — and passed 399/399 with no `markAsUncloneable` error. So the original #40 failure was Node 20
   specifically, not "any Node under the floor". Recorded so nobody re-derives it; there is still no
   `engines` field in `package.json`, and no `engine-strict`, so npm warns and proceeds.

### Invariants checked (only those the diff touches)

- **Slot key / `ON CONFLICT` / retired keys / ownership / migrations** — all N/A, no source files.
- **No vulnerable nested copy remains** (§6) — `npm ls` resolves a **single** `undici@8.10.0`, and
  the two surviving overrides still bind: `sharp@0.35.3` dedupes with Next's nested copy, `postcss`
  unchanged. Removing one entry from an `overrides` block is precisely when the *others* deserve
  re-checking.

### Docs

No `.ts`/`.tsx` touched, so no mirrored docs. **Reverse sweep done for the removed override:** every
live reference to `undici` in the repo sits inside this log's own dated run entries. Per the "never
rewrite a dated record" rule those are left intact — including the 2026-08-04 undici entry's
forward-looking line *"the only thing holding the audit gate green until PR #40 … lands"*, which this
entry resolves. Newest-first ordering means a reader meets the resolution before the superseded
sentence, so the record stays honest without being falsified. Noted explicitly so a future sweep
doesn't "fix" it.

### Verified vs. read

**Executed:** all five gates on a real `npm install`; the undici resolution **with and without** the
override, to prove the mismatch rather than infer it; `npm ls` for the surviving `sharp`/`postcss`
pins; `@types/node` ^22 run through the full suite *and* `npm run build` before being included,
since eslint does not type-check.
**Read only:** CI on Node 22 itself — this runs on the workflow file, so the first real proof is the
PR's own CI. `node-version: "22"` resolves to the latest 22.x, which satisfies `^22.22.2` by
construction.

### Reviews

`/security-review` **not run** — no auth/authz/data-access code changed. The security-relevant
question here is whether dropping an override reopens an advisory, which `npm audit` answers
directly (exit 0, recorded above).
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

### Rules this run produced

- **An `overrides` entry outlives the reason for it, and then starts lying.** A pin added to force a
  package *up* keeps applying after the dependency tree moves on — at which point it silently forces
  the package *down*, below what its dependent declares. Whenever the dependency that motivated a pin
  changes major version, re-derive whether the pin is still an upgrade. Green tests do not answer
  this; only comparing the resolved version against the dependent's declared range does.
- **Test the removal, not just the addition.** The useful experiment was resolving the tree *without*
  the override to see what npm picks on its own. That took one `--package-lock-only` install and
  converted "probably redundant now" into a measured fact.

**Verdict:** gate green. Not merged — owner's call.

---

## 2026-08-04 — dependabot minor-and-patch group (7 updates)

Branch `pr57-review` ← `dependabot/npm_and_yarn/minor-and-patch-7fba3b5027` on `1f2476b`
([#57](https://github.com/zfert99/Puzzle-Generator/pull/57)) · dependency-only: `package.json` +
`package-lock.json`, **zero source files**.

`next` 16.2.11→16.2.12 · `motion` 12.42.2→12.43.0 · `@upstash/redis` 1.38.0→1.38.1 ·
`@playwright/test` 1.61.1→1.62.1 · `@types/react` 19.2.17→19.2.18 · `@types/react-dom` 19.2.3→19.2.4 ·
`eslint-config-next` 16.2.11→16.2.12.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) — no flake this run |
| `npm run lint` | clean (exit 0) |
| `npm run build` | compiled, all routes emitted |
| `npm audit --audit-level=high --omit=dev` | **exit 0** |
| Benchmarks | **skipped — 0 engine files touched** |

### Findings

**None.** All 7 bumps are patch/minor within their current major.

### Invariants checked (only those the diff touches)

- **Slot key / `ON CONFLICT` / retired keys / ownership / migrations / AI-written logic** — all N/A:
  the diff contains no source files, so there is no logic to re-derive.
- **No vulnerable nested copy remains** (§6) — checked, not assumed. A dependency-group bump
  regenerates the whole lockfile, which is exactly when an `overrides` pin can be silently dropped.
  `overrides` survives intact and the lock resolves a **single** `undici@7.29.0`. Had this bump
  reintroduced a second nested copy, `npm audit` would have gone red again and the cause would have
  looked like a new advisory rather than a lost pin.
- **Every bump actually landed** — verified against the lockfile rather than trusting the PR body;
  all 7 resolve to their claimed versions.

### Docs

No `.ts`/`.tsx` touched, so no mirrored docs; nothing renamed or superseded, so the reverse sweep is
a no-op. `npx markdownlint-cli` clean repo-wide.

*Checked and deliberately not actioned:* AGENTS.md §6 (line ~341) still says Upstash-backed
rate-limit storage was "deliberately tabled … rather than implemented now", while `roadmap.md:743`
records it as ✅ Shipped (PR #16) and `src/` has 4 live call sites. That line sits inside a **dated
Update Log entry**, which correctly records what was true on 2026-07-22 — the "leave dated records
alone" rule applies, so it is not stale and was left as-is. The forward-looking *rule* at line 282 is
still accurate. Noted here so the next run doesn't re-investigate it.

### Verified vs. read

**Executed:** all four mechanical gates on a real `npm ci` of this exact lockfile; the installed
versions of all 7 packages; `npm ls`-level confirmation of the single undici copy; grep for the
call sites of the two runtime-visible bumps.
**Read only:** the **`motion` 12.42.2 → 12.43.0** visual result. No test covers an animation, so a
regression here would pass every gate above. Exposure is small and characterized rather than
guessed: two files — [`template.tsx`](../src/app/template.tsx) (route fade + 8px slide) and
[`SolvedStamp.tsx`](../src/features/juice/SolvedStamp.tsx) (scale/rotate keyframes) — both using only
`initial`/`animate`/`transition` with keyframe arrays, the most stable part of Motion's surface, and
neither touching a deprecated or exotic API. Judged low risk; an owner glance at one page transition
and one solved stamp closes it.

### Reviews

`/security-review` **not run** — zero lines of auth/authz/data-access *code* changed. The bump does
touch `@upstash/redis`, which backs the auth rate limiter, but a patch bump of a client library
presents no code to review; the applicable check is `npm audit`, which passes (exit 0) and is
recorded above. Flagged rather than skipped silently, since the package is auth-adjacent.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

### Rules this run produced

- **A dependency-group bump is when `overrides` pins go missing.** Regenerating the whole lockfile
  can drop a pin silently, and the resulting red audit looks like a *new advisory* rather than a lost
  override — sending the next person to research a CVE instead of diffing `overrides`. Re-verify
  every pin resolves after any grouped bump, not just that the audit is green.
- **"CI is green" is only meaningful with the base it ran on.** #38/#39 showed `CLEAN` + all-green
  while parented on `02e94db`, **16 commits** behind `main`; the checks were from 2026-07-31. Confirm the PR head
  actually descends from current `main` (`git merge-base --is-ancestor main <head>`) before treating
  a green tick as evidence.

**Verdict:** gate green. Not merged — owner's call.

---

## 2026-08-04 — undici override (`^7.29.0`), unblocking the audit gate

Branch `fix/undici-override` on `341b987` · merged as `fad3b45` ([#55](https://github.com/zfert99/Puzzle-Generator/pull/55)) · 2 lines of `package.json`
plus a 10-line lockfile delta.

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 387 passed (50 files) |
| `npm run lint` | clean |
| `npm run build` | compiled, all routes emitted |
| `npm audit --audit-level=high --omit=dev` | **exit 0** (was exit 1) — 4 moderate remain, none high |
| Benchmarks | **skipped — 0 engine files touched** |

### Findings

1. **The gate went red on every branch at once, from nobody's diff.** Five undici advisories
   covering `7.0.0 – 7.28.0` published overnight (worst:
   [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272), cross-user information
   disclosure). `main` was green the previous day on a **byte-identical lockfile**, which is what
   established it as environmental rather than a regression — see the rule below.
2. **undici is nested three levels down and unreachable by any top-level bump** —
   `better-auth → vitest → jsdom@29 → undici@7.28.0`. Fixed with a `package.json` `overrides` entry
   beside the existing `postcss` and `sharp` ones, exactly the case AGENTS.md §6 documents.

### Invariants checked (only those the diff touches)

- **Slot key / `ON CONFLICT` / retired keys / ownership / migrations** — all N/A, no source touched.
- **No vulnerable nested copy remains** — the §6 gotcha checked explicitly, not assumed:
  `npm ls undici` resolves a **single** `7.29.0`. A passing `npm audit` alone would not have proven
  this; the whole point of the §6 rule is that a second nested copy can survive the bump.

### Docs

Nothing mirrored (no `.ts`/`.tsx`), nothing renamed or superseded, so the reverse sweep was a no-op.
**This entry is the docs deliverable** — the rationale would otherwise live only in a squash-merged
PR body, which is not where anyone looks before editing `package.json`. *Why the override must not
be stripped:* it is the only thing holding the audit gate green until PR #40 (jsdom 29 → 30) lands,
and #40 is itself blocked on `ci.yml` pinning `node-version: "20"` while jsdom 30 requires
`^22.22.2 || ^24.15.0 || >=26.0.0`. Once #40 lands the override becomes redundant but stays harmless.

### Verified vs. read

**Executed:** every mechanical check above, plus `npm ls undici` on a real `npm install` (not just a
`--package-lock-only` resolution). The override was trialled on a throwaway working tree and reverted
*before* the branch was cut, so the recommendation carried a measured exit code rather than a guess.
**Read only:** nothing.

### Reviews

`/security-review` **not run** — no auth/authz/data-access code changed; the security content here is
the dependency graph itself, which `npm audit` verifies directly and whose output is quoted above.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it. Judged a
reasonable skip for a two-line dependency pin, and flagged as skipped rather than implied done.

### Rules this run produced

- **Before attributing a red gate to your diff, check whether your diff can even reach it.** This one
  touched zero dependency files, so its lockfile was byte-identical to `main`'s — which settles the
  question outright, with no re-run needed. Same cheap-attribution move as the Known flaky tests
  table, applied to CI instead of to a test.
- **A dependency pin needs a written reason with an expiry condition.** An `overrides` entry is
  indistinguishable from cruft six months later. Record what it fixes *and* what would make it
  removable, or the next dependency sweep strips it and reopens the CVE.

---

## 2026-08-03 — Docs folder organization + `Docs/README.md`

Branch `chore/pre-merge-log`, gated on `341b987` (later rebased onto `3d11fac`) · docs only (the
three `src/**/*.md` edits are mirrored docs — no `.ts`/`.tsx` touched).

### Mechanical

`npx markdownlint-cli` clean on every file this branch touches. **Vitest / lint / build skipped —
no `.ts`/`.tsx` changed.** A repo-wide relative-link checker was run instead, since moving docs is
exactly the change a test suite cannot catch; it now reports **zero** unresolved links.

### Findings

1. **Archiving a "completed" doc can break live code comments** — caught before doing damage.
   `kenken-implementation-plan.md` and `multi-zone-migration-plan.md` both read as finished plans,
   but `sudoku.ts`, `human-solver.ts`, `next.config.ts`, `auth.ts` and `base-path.ts` cite them as
   the rationale for current behavior. Both kept in the active root; now a Section 7 rule.
2. **`architectural-analysis.md` had inverted into a lie.** It *argued for* the `src/features/`
   layout, so its "Current State" section describes the root-level `app/`/`components/`/`lib/`
   structure that no longer exists — and AGENTS.md §7 was citing it as *the example* of an active
   doc. Archived with a dated banner; the §7 example replaced.
3. **`multi-zone-migration-plan.md` still said "draft / not yet applied"** months after it shipped
   to production. Banner corrected, original text preserved inline.
4. *(pre-existing, fixed here)* Three mirrored source docs had broken links, each off by one
   directory level — `src/app/page.md` → `PuzzleHub.md`, `src/app/globals.md` → `SolvedStamp.md`,
   `src/app/api/auth/[...all]/route.md` → `auth.md`. **Confirmed broken on `main`** first by
   checking out and re-running the link check there, so they are not fallout from this branch's
   moves. The repo now has **zero** unresolved relative `.md` links.
5. *(pre-existing, adopted here)* An untracked research doc sat in `research/` under its
   generator's filename (`compass_artifact_wf-e8ed3fd9-…_text_markdown.md`) — unfindable, violating
   the kebab-case rule, and failing markdownlint in 19 places. It is a substantial **Kakuro**
   research report; renamed to `research/kakuro.md`, lint fixed (blank lines only — no prose
   touched), and linked from a new roadmap backlog entry so it is actually discoverable. An
   unreferenced doc is not organized, it is just filed.

### Rules this run produced

- **Live source rationale outranks "completed."** Before archiving a doc, grep for it in `src/` and
  `*.config.ts` — **not just `*.md`**. The doc-only reverse-reference sweep structurally cannot see
  a code comment, and code comments are how a reader gets from a puzzling line to its reason.
- **Moving a doc breaks links in two directions.** Every inbound link *and* every relative link
  *inside* the moved file (its depth changed by a level). Verify with a resolver that walks every
  `](…md)` in the repo, not by eye.
- **Before claiming a broken link is yours, check `main`.** Three of the six this run surfaced were
  pre-existing. One `git checkout main` plus a re-run settles it in seconds — the same
  cheap-attribution move the Known flaky tests table exists for.
- **A doc nothing links to is filed, not organized.** When adopting a stray doc, give it a real
  kebab-case name *and* an inbound link from a live doc, or nobody will ever find it.

### Docs

`Docs/README.md` added as the index (three-folder rule, active-doc table with statuses, where a new
doc goes); AGENTS.md §7 updated with both rules above plus "never rewrite an archived doc"; Update
Log entry added. Three docs moved to `archive/`, each with a dated **Archived** banner rather than a
rewrite.

### Reviews

`/security-review` **not run — not applicable**: zero source files, no auth/authz/data-access change.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

**Verdict:** gate green, not merged.

---

## 2026-08-03 — Step 5: archive completion counts (X/N)

Branch `feat/daily-step5-archive-counts`, gated on `341b987` · merged as `3d11fac` ([#54](https://github.com/zfert99/Puzzle-Generator/pull/54)) · ~282
LOC of source plus 224 of tests and the docs (source under the ~400 target).

### Mechanical

| Check | Result |
|---|---|
| `npx vitest run` | 399 passed (52 files) — see Findings 1 |
| `npm run lint` | clean |
| `npm run build` | ✓ compiled in 11.4 s |
| `npx markdownlint-cli "**/*.md"` | clean |
| Benchmarks | **skipped — 0 engine files touched** |

### Findings

1. **Pre-existing flake, not introduced** — `calc-sudoku.test.ts` timeout. Full detail promoted to
   **Known flaky tests** above; diff touches zero files under `src/features/engine/`.
2. *(fixed in-PR)* `src/app/api/me/progress/route.test.ts` — the 401 test's BOLA assertion was
   **vacuous**: `toHaveBeenLastCalledWith` against a mock nothing cleared, so it read a call from an
   earlier test and passed unconditionally. Replaced with `mockClear()` + `not.toHaveBeenCalled()`
   and a positive session-id assertion; **both verified to fail** against an injected
   `searchParams.get('userId') ?? await requireUserId()`.

### Invariants checked (only those the diff touches)

- **Slot key is not an identity** — N/A *by construction, checked not assumed*: `getDailyProgress`
  puts `date` in the `GROUP BY`, so it never aggregates across dates, and there is no `min()` for a
  faster board to win.
- **`ON CONFLICT DO NOTHING`** — N/A, no writes.
- **Retired keys readable** — verified live across three registry eras: 2026-07-28 → 15 standard +
  15 mini (the old 30-board registry), 2026-07-31 → 15 + 18 (the 33-row cutover date), 2026-08-01…03
  → 3 + 3. Section comes from grid size, never a key prefix.
- **Ownership in the query** — session id only; mutation-tested (above).
- **Migrations** — none.
- **AI-plausible logic re-derived** — `total: count(*)` is correct *only* because
  `UNIQUE(user_id, puzzle_id)` caps the LEFT JOIN at one row per puzzle once the ON clause pins
  `user_id`; `done` must be `count(a.id)` (NULL-skipping). Using `count(*)` for `done` would have
  reported **every day as fully complete**. Cross-checked against an independent `solve_attempts`
  count — agree.

### Docs

Four mirrored `.md` for four touched `.ts`/`.tsx`. Reverse sweep fixed two live docs:
`social-progression-economy-plan.md` grouped cross-date aggregates by `(key, variant)` (Step 3d
amended it to `(key, variant, size)`), and its **§S3 anticipated what this PR built** — added a
dated note that S3 now owns only the gold/payout layer and that the `daily_board_counts` snapshot
table it specified is unnecessary (the denominator computes live). Deliberately left alone: the two
multi-zone docs enumerating "the nine broken calls" — past-tense records of what was broken then, so
a tenth (correct) `apiPath` call site does not falsify them.

### Verified vs. read

**Executed:** the SQL against the live DB (3 registry eras + independent numerator cross-check); the
BOLA assertions via injected regression; the flake via 18 repeat runs + isolated timing; all four
mechanical gates; signed-out `/archive` renders clean; `/api/me/progress` returns 401 unauthenticated.
**Signed-in UI verified by the owner** against a running dev server before merge — dot states, no
vertical jump between marked and unmarked days, per-date denominators on July dates, month paging,
and counts clearing on sign-out. **Read only:** nothing.

### Reviews

`/security-review` **run** — full pass no findings, plus a focused re-verify of both server files
(session-only id, authorize→validate→read ordering, parameterized dates, aggregate-only response,
ON-clause ownership, no cross-user render path): all pass.
`/code-review ultra` **run by the owner** — zero findings across all 14 files. An agent still cannot
launch it; this run was owner-triggered, which is the only way it happens.

**Verdict:** gate green. Merged as `3d11fac` after a rebase onto the undici fix (entry above) — the
rebase carried only the lockfile, leaving the reviewed source diff byte-identical.
