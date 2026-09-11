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
