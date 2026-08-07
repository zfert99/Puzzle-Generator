# QA Remediation & UX Plan — August 2026

> **Status:** 📋 Planning. Nothing is merged to `main`. **Step 4 (hub reorg) was built early and
> is committed on `feat/hub-reorg` (`03152de`)** — code complete, e2e assertions unproven until
> Step 1 lands; see its step-log. Everything else is unstarted. Living document: each **Step**
> below carries its spec *and* its step-log (process / learnings / blockers), appended as that
> step lands.
>
> **Origin:** a full QA pass on 2026-08-05 against
> [research/accessibility-responsive-qa.md](research/accessibility-responsive-qa.md), driving the
> real app in a browser plus direct engine/API testing. It found **13 defects** (F1–F13). The owner
> then added **four UX asks** — hub reorganisation (U1 → Step 4), archive calendar bounds
> (U2 → Step 3b), per-type rules (U3 → Step 5), and the archive-always-practice bug, which the QA
> pass had independently found as F3 (→ Step 3a). One further issue (D1) surfaced while confirming
> those. This doc is the single plan of record for all of it.

This is a self-contained handoff: read it cold and you have the background, the evidence behind
every item, the ordered steps, the risks, and the verification plan needed to continue.

---

## Why (background & required knowledge)

### What was tested, and what is genuinely healthy

Worth stating up front so the finding list below is not read as "the app is in trouble" — **the
engine and the ranked-solve path are in good shape.** Verified on 2026-08-05:

- **Generation & uniqueness.** All 32 valid (variant × size × difficulty) combos, 3 boards each.
  Every board re-verified with an *independent* brute-force solution counter (`countSolutions`,
  `KillerSolver`, `CalcSolver`) rather than the grader that produced it: 96/96 unique-solution,
  96/96 valid solutions, 96/96 correct cage partitions. 60-run sweeps on the small grids (where
  duplicates would actually surface) returned 60/60 distinct every time. Across five archived days,
  26 daily boards, zero duplicates.
- **Speed.** Classic 9×9 easy→hard 1–2 ms, expert 23 ms, extreme 850 ms; Killer 9×9 easy 5 ms →
  extreme ~3 s; Keisan 9×9 easy 9 ms → extreme 500 ms. Warm API/page latency 30–70 ms. Interaction
  handlers on a 9×9 Killer board: 0.6 ms median / 1.6 ms max — far inside the 200 ms INP budget
  (AGENTS.md §3).
- **Anti-cheat.** Replay → 409, faster replay → 409, solve without start → 400 `NOT_STARTED`,
  implausible time → `TOO_FAST`, wrong grid → `INCORRECT_SOLUTION`, absurd `timeMs` → 400,
  `mistakes: 1e9` clamped. Every `/api/me/*` and `/api/solve` returns 401 unauthenticated; the
  public leaderboard stays 200. **No changes proposed here.**
- **Daily / leaderboard / archive data flow.** A solve moved streak 0→1, recorded a rank, created a
  personal best, and incremented monthly progress. An archive practice replay wrote *no* attempt and
  left the historical ranking untouched.
- Unit suite **431/431 green**.

### The one thing that makes the finding list possible

**The Playwright e2e suite has never actually run against the app.** `playwright.config.ts` sets
`baseURL: 'http://localhost:3000'`, but the app is mounted at `basePath: '/puzzles'`
(see [multi-zone-migration-plan.md](multi-zone-migration-plan.md) and
[base-path.ts](../src/lib/base-path.ts)). So every `page.goto('/play')` resolves to
`http://localhost:3000/play`, which **404s**. The `webServer.url` health check hits `/` and gets the
same 404, so Playwright never considers the server ready and `npm run test:e2e` aborts before a
single test runs. CI (`ci.yml`) runs lint, markdownlint, `npm test` and `npm audit` — **not e2e** —
so nothing surfaced it.

Corrected run (baseURL pointed at the real mount): the 17 "passing" tests were the axe scans and
overflow checks — **scanning Next's 404 page**. That is why several of the defects below
(unlabelled inputs, board keyboard trap) were never caught by the guardrails written specifically
to catch them. It is also a textbook instance of the rule the project already wrote down in
[pre-merge-log.md](pre-merge-log.md): *an assertion is presumed vacuous until a deliberately-broken
run proves otherwise.*

**This is why Step 1 comes first.** Until the gate runs, no other step can prove it did not
regress something.

### Archive data has three eras (discovered during this pass)

Relevant to Steps 3b and 3c. Measured by walking `/api/daily/slots?date=` from 2026-07-11 to
2026-08-07:

| Range | Slots/day | What it is |
|---|---|---|
| before 2026-07-11 | 0 | **No data at all.** The daily system's first board is 2026-07-11. |
| 2026-07-11 → 07-17 | 4–5 | Partial early days |
| 2026-07-20 → 07-31 | 19–33 | **Legacy 30-board era**, pre-restructure (`killer6-easy`, `calc9-expert`, …) |
| 2026-07-24 | **0** | A real one-day gap — the silent Vercel Cron outage fixed in `38ec174` |
| 2026-08-01 → today | 6 | Current type-as-slot model ([daily-redesign-plan.md](daily-redesign-plan.md)) |

Retired keys stay readable by design (a stated `/pre-merge` invariant) — **do not "clean up" the
legacy rows.** The work is to stop the *calendar* offering days that hold nothing, and to stop the
*picker* rendering 30 tabs for a legacy day.

### Related reading

- [research/accessibility-responsive-qa.md](research/accessibility-responsive-qa.md) — the QA
  method this pass followed; the source for the ARIA grid pattern, focus-management and
  automated-tooling requirements in Steps 6 and 7.
- [mobile-a11y-audit.md](mobile-a11y-audit.md) — earlier, still-unimplemented mobile/WCAG analysis.
  Steps 6–7 overlap it; fold anything still true from there into those steps rather than duplicating.
- [daily-redesign-plan.md](daily-redesign-plan.md) — why a daily slot key is *not* a puzzle type.
- [multi-zone-migration-plan.md](multi-zone-migration-plan.md) — why `basePath` exists (Steps 1, 2).

---

## Findings inventory

The scope source of truth. "Step" links to where it gets fixed.

| # | Severity | Finding | Step |
|---|---|---|---|
| F1 | **High** | `npm run test:e2e` cannot start; all specs 404; a11y/overflow guardrails vacuous; CI never runs e2e | 1 |
| F2 | **High** | `bg-pattern.svg` 404s on all 7 pages — `basePath` is not applied to CSS `url()` | 2 |
| F3 | **High** | Playing from Archive is *always* practice, even for today's board — burns today's daily for no rank | 3a |
| F4 | **High** | Puzzle board is unreachable by keyboard: every gridcell `tabindex="-1"`, grid not focusable (WCAG 2.1.1) | 6a |
| F5 | Medium | `/generate`'s five number inputs have no label; accessible name is the placeholder `"0"` for all five | 7a |
| F6 | Medium | Board ARIA grid has no `role="row"` between `role="grid"` and its gridcells | 6b |
| F7 | Medium | "Solved!" dialog does not move focus into itself (the new-game confirm dialog does) | 6c |
| F8 | Medium | 6 of 8 routes share the title `"Puzzle Generator"` (WCAG 2.4.2 + duplicate-title SEO); brand is "Puzzle Lab" | 7b |
| F9 | Medium | Killer/Keisan PDFs lack the outline bookmarks + puzzle↔answer links classic PDFs have | 8 |
| F10 | Low | Type/size/difficulty toggles have no `aria-pressed`/radiogroup — selection is colour-only | 7c |
| F11 | Low | Mobile header hides Archive + PDF with no overflow menu (hub-only access) | 9a |
| F12 | Low | Public leaderboard API returns internal `userId` on every entry | 9b |
| F13 | Low | 4×4 board on 1280×720 desktop pushes its last row + numpad below the fold | 9c |
| **U1** | — | **Owner ask:** reorganise the hub — a Sudoku card, types grouped, modes grouped | 4 |
| **U2** | — | **Owner ask:** archive should grey out empty days and not scroll back past July | 3b |
| **U3** | — | **Owner ask:** per-type rules popup on first play + a way to reopen rules any time | 5 |
| D1 | Medium | *Discovered:* legacy archive days render 19–33 picker tabs (old 30-board key scheme) | 3c |

### Open items not owned by a step

Small things with no natural home in the numbered steps. Kept here so they are visible rather than
living only in a chat transcript.

| Item | Status | Notes |
|---|---|---|
| **`DATABASE_URL` as a repository secret** | ⏳ Owner action | Unlocks the four `/daily` e2e specs, which currently `test.skip` themselves. **CI is green without it** — it is coverage, not a blocker. Add under Settings → Secrets and variables → Actions; `ci.yml` already reads it and derives `E2E_HAS_DB` from its presence. Nothing else needs changing. |
| **`killer-sudoku.ts:124` cites a moved doc** | 🔴 Open on `main` | Points at `Docs/killer-6x6-implementation-plan.md`; the file is at `Docs/archive/`. PR #71's title says "fix two stale doc pointers", but it fixed pointers *inside* a research doc — not this one. Either repoint the comment or move the doc back per §7 ("live source rationale outranks completed"). |
| **The code→doc sweep** | 💡 Adopt | The reverse-reference sweep runs doc→code. Its mirror image also fails: a code comment can name a `Docs/*.md` path nobody committed. `git grep -oh "Docs/[a-z0-9-]*\.md" -- src/ '*.config.ts'` then check each is tracked. Exclude anything worded "the **hub's** `Docs/…`" — that is the separate `Biscuit-Website` repo, not a dangling link. |

### Deliberately not in scope

- **`/api/daily` serves the solution to the client.** A recorded decision with its reasoning in
  [solve-rules.ts](../src/features/leaderboards/solve-rules.ts): hints and mistake-highlighting need
  it, and a sudoku is externally solvable anyway. The practical ceiling is that a determined player
  can post a time at the plausibility floor. **Left as-is deliberately** — reopen only if
  leaderboards start attracting real competition.
- **Retired daily keys.** Stay readable. See "three eras" above.

---

## Order of play

**Whole steps run in order; a step's sub-items stay together.** Size still decides where a *step*
sits, but splitting a step across the schedule costs more than it saves — 6a/6b/6c all touch the
board and its dialogs, 3a/3b/3c all touch the archive surface. Doing them together means one context
load, one visual check, one pre-merge gate.

Step *numbers are identities, not sequence* — they never change, because the hub work committed on
`feat/hub-reorg` cites "Step 4" by name in its code comments, and renumbering would silently falsify
them (AGENTS.md → reverse-reference sweep). This table is the running order; revise it freely
without touching a single step heading.

Sizes: **XS** ≲ 30 LOC / under an hour · **S** ≲ 100 LOC / half a day · **M** ≲ 250 LOC / a day ·
**L** ≳ 400 LOC or significant net-new content.

| # | Step | Size | Why it sits here |
|---|---|---|---|
| 1 | **Step 1** — e2e gate (F1) | M❓ | First regardless of size: every later step's "no regression" claim depends on it. Size is a guess — the triage tail behind the config fix is unknown until it runs. |
| 2 | **Step 2** — `bg-pattern` basePath (F2) | XS | **Same root cause as Step 1** — `basePath` not applied, there to test paths, here to CSS `url()`. Fix them while that idea is loaded, and Step 1's new "no 404 responses" assertion is exactly what guards it. |
| 3 | **Step 4** — hub reorg (U1) | XS | Already written and committed on `feat/hub-reorg` (see step-log). Re-verify and land. Its e2e specs need Step 1 green, which is why it follows rather than leads. |
| 4 | **Step 3** — archive correctness (F3, U2, D1) | M | The only remaining **correctness** block: 3a is a High-severity ranked-write bug. 3a → 3b → 3c internally (3a is S and standalone; ship it first even if 3b/3c slip). |
| 5 | **Step 6** — board accessibility (F4, F6, F7) | S | **Start with 6a** — ~10 lines, High severity, the best ratio in this plan. 6b/6c follow in the same board context. |
| 6 | **Step 7** — names, titles, semantics (F5, F8, F10) | S | The second a11y block, all "can a screen reader tell these apart": form labels, page titles, toggle state. Different files, one idea. |
| 7 | **Step 8** — PDF bookmark/link parity (F9) | S–M | Self-contained in `pdf.service.ts`; touches nothing above. Slot it wherever it fits. |
| 8 | **Step 9** — polish (F11, F12, F13) | M | Genuinely unrelated odds and ends. 9a (mobile nav) must follow Step 4 — the hub reorg may change the answer. |
| 9 | **Step 5** — per-type rules (U3) | **L** | Last on size *and* on dependency: it adds a dialog, and **Step 6c fixes the dialog focus pattern it should copy**. Building it first means copying a broken pattern. |

### What this ordering costs

Grouping beats pure size in two places, both deliberate:

- **Four XS items are no longer front-loaded.** 7b (titles), 9b (`userId`), 9c (board cap) now ride
  along with their parent steps at #6 and #8 instead of landing in week one. That is the price of
  cohesion; if a quick visible win is wanted early, 7b is the one to peel off.
- **6a is buried at #5** despite being the single best value-for-size item here (High severity,
  ~10 lines). **If anything gets pulled out of order, make it 6a** — it needs no context beyond the
  board's existing roving-tabindex logic and can land the same day as Step 1.

Conversely, 3a's severity is now respected: Step 3 sits at #4 rather than mid-list.

### Batching

Steps 7 and 9 are each already a bundle of small independent diffs, so they *are* the batch — one
PR apiece, comfortably inside the < ~400 LOC target. Steps 1–4 stay separate PRs: Step 1 has an
unknown tail, Step 2 wants Step 1's guard in place, Step 4 is a re-verify of committed work, and
Step 3 touches ranked writes and needs its own `/security-review`.

---

## Steps

Sized to the AGENTS.md pre-merge gate: **each step is its own PR, targeting < ~400 LOC.** Steps are
listed here by number; the running order is the table above. Sub-items (6a, 7b, 9c…) may ship
independently of their parent step — the parent is a grouping, not a required PR boundary.

### Step 1 — Make the e2e gate real (F1) · M❓ · order #1

**Why first:** every later step claims "no regression". Nothing can claim that while the suite that
would prove it is scanning a 404 page.

#### Spec

1. `playwright.config.ts`: `baseURL: 'http://localhost:3000/puzzles'`, and point `webServer.url` at
   a path that returns 2xx (`http://localhost:3000/puzzles`) so readiness detection works.
   - **Trap:** `page.goto('/play')` resolves against the *origin*, discarding a `baseURL` path — so
     `baseURL` alone is not enough. Either make every spec path relative (`'play'`, no leading
     slash) or add a `BASE = '/puzzles'` prefix helper. Pick one and apply it uniformly; a mixed
     convention will silently 404 again.
2. Re-run and triage. Expect genuine failures — these specs have never executed against real pages.
   Fix the app where the test is right; fix the test where it is stale. **Record every triage
   decision in this step's log**, since this is the first real signal the suite has produced.
3. Add an `e2e` job to `.github/workflows/ci.yml` (`npx playwright install --with-deps chromium`).
   Non-blocking on the first PR if the triage tail is long; flip to blocking in the same step once
   green.
4. Add a **meta-guard** so this cannot silently recur: assert in the suite that the landing response
   status is 200, not merely that the page loaded.

**Done when:** `npm run test:e2e` runs to completion locally and in CI, and deliberately breaking a
selector turns the suite red.

**Step-log:** *(pending)*

---

### Step 2 — Fix the `basePath` asset 404 (F2) · XS · order #2

#### Spec

- Seven pages use `bg-[url('/bg-pattern.svg')]` (`page.tsx` for `/`, `/daily`, `/play`,
  `/leaderboard`, `/archive`, `/generate`, `/signin`). Next prepends `basePath` to `<Link>`,
  `next/image`, `router.push()` and `/_next/*` — **not to CSS `url()`**. The background has never
  rendered, in dev or prod.
- Fix once, not seven times: hoist the shared `<main>` chrome into a small component (or a CSS
  custom property set on `<body>` in the root layout) so the asset path lives in exactly one place.
- Extend the `BASE_PATH` doc block in [base-path.ts](../src/lib/base-path.ts) — it already warns
  that `fetch()` is not rewritten; CSS `url()` is the same class of gap and belongs in the same
  warning.
- Guard: an e2e assertion that no page load produces a 404 network response (Step 1 makes this
  possible).

**Done when:** zero 404s in the network log on every route, and the background is visible.

**Step-log:** *(pending)*

---

### Step 3 — Archive correctness (F3, U2, D1) · M · order #4

> **Refined 2026-08-07, before building.** Three things changed this spec: today's board turns out
> to be *out of scope for the archive entirely*, a **discarded branch's stash** was found with the
> calendar work already reasoned through (including a deadlock this plan had not anticipated), and
> the greying design needs a third piece of state nobody would guess. Read the prior art below
> before writing code.

#### Prior art — do not re-derive this

`stash@{0}` ("wip: ArchiveExperience calendar-bounds fix from the discarded QA branch") holds a
refinement of a **3b implementation that no longer exists**: none of it is on `main` — no
`/api/daily/days` route, `Calendar` still takes only `maxDate`/`tallies`, `ArchiveExperience` has no
`firstDate`/`availableDays` state. **The stash cannot be applied** (its base is gone), but three
decisions in it were paid for once already:

1. **One endpoint, not two.** It fetched `/api/daily/days?month=…` returning
   `{ days: [...], first: 'YYYY-MM-DD' }` — the month's populated days *and* the global floor in a
   single call. Better than this plan's earlier `/api/daily/coverage` sketch, which needed a second
   round trip for the floor.
2. **`loadedMonths` is load-bearing.** Without it, "this month has no boards" and "we have not
   fetched this month yet" are the same state, so every unfetched day greys out on arrival.
3. **A provisional `minDate` can deadlock the calendar.** While the fetch is in flight the floor
   must be the visible month, or a fast `‹` double-click lands on a month the response then greys
   out *and* locks. But if that request **fails**, holding the provisional floor pins the calendar
   forever: `‹` is disabled by the provisional floor, `›` by `maxDate`, and the effect only re-runs
   on a month change neither arrow can now produce. Both arrows dead, reload the only escape.
   The fix is a third state — *settled without a floor* → **no** `minDate`, degrading to today's
   unbounded behaviour rather than locking.

#### Step 3a — The archive covers past days only (F3) · S · first in step

##### Spec

**The bug.** `ArchiveExperience` is unconditionally the practice surface: there is no
`selectedDate === todayIso` branch, it never calls `/api/solve` or `/api/daily/start`, and it
hardcodes the `· practice` label. The calendar *defaults* `selectedDate` to today and today is
selectable, so the most natural path — open Archive, press Play — silently burns today's board for
no rank. It also calls `startNewGame(puzzle, 'daily', date)`, which overwrites the single saved
slot, so it can erase an in-progress **ranked** attempt at the same board.

**The resolution is narrower than "make the archive submit".** The page's own copy already says
*"Pick a **past** day to replay its puzzle (unranked)"* — today was never meant to be in range. And
`DailyExperience` already owns rankability correctly: it calls `/api/daily/start` on begin and
submits only when `session && dailyDate === todayIso`. So the fix is to stop the archive offering
today, not to teach it a second ranked write path:

- `maxDate` becomes **yesterday** (UTC), and the default `selectedDate` follows.
- Today is not a dead end: render a link to `/daily` ("Today's daily is live — play it ranked →").
- The `· practice` label stays constant, because now it is always true.
- **No new write path, so no new `/api/solve` caller** — which is most of why this option wins.
  The alternative (make the archive date-aware and submit) needs `/api/daily/start` too, doubles
  the ranked-write surface, and buys nothing the `/daily` link does not.
- Sharpen the `ConfirmModal` copy: it warns that a saved puzzle will be erased but not that the
  replacement will not count. Say so.

**Decision needed before building:** with `maxDate = yesterday`, today's *leaderboard* is no longer
reachable from `/archive`. It is already on `/leaderboard`, so this is likely fine — confirm.

##### Verification

E2E: today is not selectable in the archive calendar; selecting yesterday still yields a board
labelled practice; playing it writes **no** `solve_attempts` row (assert via `/api/me/attempts`
before/after) and leaves the historical leaderboard unchanged.

#### Step 3b — Calendar bounds + empty days (U2) · M

##### Spec

Build the endpoint the stash implies, then the UI on top of it.

- **New public route `GET /api/daily/days?month=YYYY-MM`** → `{ days: string[], first: string|null }`.
  Aggregate only — dates and a floor, no user data, so it works signed-out (which
  `/api/me/progress` cannot: it is 401 without a session and is per-user). Model validation on
  [`slots/route.ts`](../src/app/api/daily/slots/route.ts), which already rejects a well-formed
  non-date like `2026-02-31` **by existence, not shape** — that exact input used to 500 at the
  driver. One `SELECT DISTINCT date` per month plus one `MIN(date)`; cacheable.
- **`Calendar` gains `minDate`, `availableDays`, `loadedMonths`.** Disable days outside
  `[minDate, maxDate]`, disable `‹` at the boundary month mirroring the existing `canGoNext`, and
  grey days in a *loaded* month that are not in `availableDays`.
- Implement the **three-state `minDate`** from the prior art above. This is the part that will look
  like over-engineering and is not.
- **Do not hardcode the floor.** It is `first` from the endpoint. Measured today it is
  **2026-07-11**, with a real one-day hole at **2026-07-24** (the silent cron outage) — so
  "greyed" must mean *no boards*, not *before the floor*, and the two need different treatment.
- Unavailable days must be distinguishable by more than colour (WCAG 1.4.1) — the existing tally
  dots set the precedent.

#### Step 3c — Legacy days do not explode the picker (D1) · M

##### Spec

Days from 2026-07-20 → 07-31 carry the old 30-key scheme, so `LeaderboardView` renders up to 33
tabs. Group them (Standard / Mini / Killer / Keisan) or collapse to a `<select>` on legacy-shaped
days. Presentation only — **every key must stay readable and replayable** (a standing `/pre-merge`
invariant). Cheap fallback if grouping proves fiddly: render legacy days leaderboard-only, with a
one-line note; record the choice and why in the step-log.

### Step 4 — Reorganise the hub (U1) · XS (re-verify committed work) · order #3

#### Spec

- Today [PuzzleHub.tsx](../src/features/hub/PuzzleHub.tsx) is a flat 7-card bento grid that
  interleaves **puzzle types** (Killer, Keisan) with **modes** (Daily, Free play, Leaderboard,
  Archive, Print packs) — and there is **no Sudoku card at all**, even though the other two types
  have one. That asymmetry is the core of the ask.
- Target: three labelled groups.

  | Group | Cards |
  |---|---|
  | **Play** | Sudoku (new, → `/play`), Killer, Keisan |
  | **Compete** | Daily, Leaderboard, Archive |
  | **Print** | Print packs |

- Group headings must be real headings (`<h2>`), not styled `<div>`s — this is the page's document
  outline and it feeds Step 7b.
- Keep the `ContinueBanner` above all groups; keep the "new!" sticker on whatever shipped last.
- Verify the grid still reflows to one column at 320 px (no regression against Step 1's overflow
  test) and that the added row does not push "Print packs" below the fold on a short laptop.

#### Locked decisions (owner, 2026-08-07)

- **No "Free play" card.** The type cards *are* free play — each deep-links into `/play` with its
  variant preselected, so a separate card would be a fourth door into the same room. `/play` stays
  reachable from the global header.
- **The Play group is ordered by difficulty**, read as *difficulty to learn* rather than generator
  cost: Sudoku → Killer → Keisan. This also matches the order the `/play` picker already uses
  (`classic, killer, calc`), so hub and picker agree. One-line flip if that reading is wrong.

**Step-log — built 2026-08-07, committed on `feat/hub-reorg` as `03152de`, not merged**

> **State: code complete on its branch, unmerged, e2e unproven.** It was built ahead of the
> planning pass finishing. It was briefly parked in a stash on 2026-08-07 to keep the working tree
> clean for planning, then **committed to `feat/hub-reorg` the same day** — a stash is not a branch,
> is not backed up, and a stray `stash clear` or fresh clone would have lost it.
>
> **To resume:** the branch already has it. Re-verify (visual check at 320/390/768/1280, and the two
> e2e specs once Step 1 is green), then merge. Do not rebuild it — the locked decisions above and
> the learnings below were paid for once and stand.

- **Process.** Rewrote [PuzzleHub.tsx](../src/features/hub/PuzzleHub.tsx) into three `<h2>`-led
  groups; added the Sudoku card; removed the Free play card; shortened Keisan's description (the
  old one wrapped to four lines and visibly inflated that card's height).
- **Learning — one grid, not one per group.** A grid per group sizes its cards independently, so
  the one-card **Print** group stretched that card across the whole row. Fix: keep every card in a
  *single* grid and let the headings span it (`col-span-full`) to force the row break. Cards then
  stay the same size in every group regardless of how many the group holds.
- **Learning — the column count had to be pinned.** With `auto-fit` + `minmax(150px, 1fr)`, the
  old `max-w-3xl` (768 px) container packs **4** tracks, so three-card groups broke raggedly.
  Capping the grid at `max-w-[640px]` yields exactly 3 columns (4 tracks would need
  `4×150 + 3×16 = 648 px`), so each group fills its row. Narrow-screen reflow to 2 then 1 column is
  unchanged.
- **Learning — the reverse-reference sweep earned its keep again.** Two e2e specs asserted a
  "free play" link on the hub (`home.spec.ts`, `play.spec.ts`) and `src/app/page.md` still listed
  the pre-Killer card set. None of those files' *sources* were touched by this change, so
  mirroring alone would have missed all three. Also fixed one adjacent pre-existing lie:
  `daily/page.md` claimed the daily shell renders "links to Free play and the PDF generator" — it
  has no `href` at all.
- **Blocker — verification is partial, and that is F1's fault.** The updated specs **cannot be
  run** until Step 1 lands, so the hub's e2e coverage is *written but unproven*. Unit suite, lint
  and build all pass; the layout was checked at 320/390/768/1280 for overflow. Treat the e2e
  assertions here as unverified until Step 1 turns them green.

---

### Step 5 — Per-type rules (U3) · L · order #9 (last)

#### Spec

- **5a — Content.** Write rules copy for the three types (classic Sudoku, Killer, Keisan) plus the
  Keisan **mystery/no-op** mode, which is genuinely non-obvious and currently unexplained anywhere
  in the UI. Keep it short: the constraint, what a cage means, one worked example.
  There is **no existing rules copy in the codebase** — this is net-new content, so budget for it
  rather than assuming a refactor.
- **5b — First-play popup.** Show once per type, persisted (same client-storage pattern as the
  saved-game slot; **per type**, not one global flag). Must not fire on top of the "Start a new
  puzzle?" confirm.
- **5c — Always-available entry point.** A `?` / "Rules" control in `GameHeader`, beside **Pause**,
  as the owner suggested. Present on both `/play` and `/daily`.
- **A11y is not optional here** — this is a new dialog and the QA doc is explicit: `role="dialog"`,
  `aria-modal="true"`, labelled by its heading, focus moved in on open, focus trapped, `Esc` closes,
  focus returned to the trigger. **Copy the pattern from the existing "Start a new puzzle?" confirm,
  which already does all of this correctly — not from the "Solved!" dialog, which does not** (F7).
- Do not auto-open the popup on a *daily* board: the timer starts with the board, and a modal on
  first paint taxes the ranked run. Show it on `/play` first-visit, and offer the header control on
  `/daily`.

**Step-log:** *(pending)*

---

### Step 6 — Board accessibility (F4, F6, F7) · S · order #5 (6a first)

#### Spec

- **6a — Keyboard entry point (highest-value, likely smallest).** Every gridcell is `tabindex="-1"`
  and the `role="grid"` container has no `tabindex`, so **Tab never reaches the board** — a
  keyboard-only player cannot start at all. Roving tabindex and arrow navigation already work
  correctly *after* a mouse click, so the fix is to seed the roving index (first editable cell gets
  `tabindex="0"` on mount) rather than to build anything new. **Consider pulling this ahead of
  Steps 4–5** — it is a WCAG 2.1.1 failure with a cheap fix.
- **6b — Grid structure.** Gridcells are direct children of `role="grid"`; insert `role="row"`
  wrappers (`display: contents` keeps the CSS grid layout intact). Add `aria-rowindex`/
  `aria-colindex` while in there.
- **6c — Win dialog focus.** After completion `document.activeElement` is still the grid cell. Move
  focus into the dialog, trap it, restore on close — matching the new-game confirm.
- The board is a legitimate WCAG 1.4.10 Reflow exception; **the ask is keyboard operability, not
  layout.**
- **Testing note:** axe reported 0 violations on `/play` because that route renders the *picker* —
  the board was never scanned. Any e2e a11y coverage added here must scan a page with an
  **instantiated board**, otherwise it repeats the Step 1 mistake in miniature.

**Step-log:** *(pending)*

---

### Step 7 — Names, titles and control semantics (F5, F8, F10) · S · order #6

#### Spec

- **7a — Label the generator inputs.** The five `/generate` number inputs have no `id`/`for`, no
  `aria-label`, no `aria-labelledby` — only `placeholder="0"`. The accessibility tree shows five
  identical `textbox "0"`; a screen-reader user cannot tell Easy from Extreme. Associate the visible
  difficulty text properly. **Note for whoever adds a11y CI:** placeholder-only naming *passes*
  axe's WCAG-tagged `label` rule — it is caught by `label-title-only`, a best-practice rule outside
  the `wcag2a/aa` tag filter. Add the best-practice tag to the scan or this class of defect stays
  invisible.
- **7b — Per-page titles.** Only `/account` and `/signin` export `metadata.title`; `/`, `/daily`,
  `/play`, `/leaderboard`, `/archive`, `/generate` all inherit `"Puzzle Generator"` from the root
  layout. Add a title per route and a `title.template` on the layout. Also reconcile the brand: the
  UI says **Puzzle Lab** everywhere while the document title says "Puzzle Generator".
- **7c — Toggle semantics.** Type/size/difficulty groups convey selection by background colour
  only. Add `aria-pressed` (or `role="radiogroup"` + `role="radio"`, which better matches
  single-select) and associate the `Grid Size` / `Difficulty` labels with the group via
  `fieldset`/`legend` or `aria-labelledby`.

**Step-log:** *(pending)*

---

### Step 8 — PDF parity for Killer and Keisan (F9) · S–M · order #7

#### Spec

- Classic PDFs carry `/Outlines` (bookmarks) and 10 `/Annots` (puzzle↔answer links) via
  `drawPuzzles`; `generateKillerPDF` and `generateCalcPDF` produce **neither**. The roadmap lists
  bookmarks and internal links as a shipped PDF feature, so this is a parity gap on the two newer
  variants, not a new feature.
- Lift the outline/named-destination logic out of `drawPuzzles` into a helper all three builders
  call. Verified page structure today: classic 11 pages / Killer 9 / Keisan 9 for the test batches —
  all `2N+1` (title + N puzzles + N answers), so the structure already matches; only the navigation
  metadata is missing.
- Test at the structural level (assert `/Outlines` and an `/Annots` count > 0 per variant) rather
  than by snapshotting PDF bytes.

**Step-log:** *(pending)*

---

### Step 9 — Lower-priority polish (F11, F12, F13) · M · order #8

Batch into one PR; none is urgent.

- **9a** Mobile header hides Archive + PDF (`display:none`) with no overflow menu. Reachable from
  the hub, so not a dead end — but a player deep in `/play` on a phone has no header path. Add an
  overflow menu, or accept and document the hub as the canonical entry. **Sequence after Step 4** —
  the hub reorg may change the answer.
- **9b** `/api/leaderboard` returns internal `userId` on every entry. The response already carries a
  separate `me` object for self-identification, so per-entry ids look redundant; confirm no client
  reads them, then drop. (Not a BOLA — read-only, no write path — just unnecessary surface.)
- **9c** A 4×4 board renders very large on a 1280×720 desktop, pushing its last row and the numpad
  below the fold. Cap the board size for mini grids.

**Step-log:** *(pending)*

---

## Risks

- **Step 1 has an unknown tail.** These specs have never run against real pages; the triage could be
  larger than the config fix. Time-box the triage — if it exceeds the step, land the config fix plus
  a skip-list with a tracking entry here, and keep the CI job non-blocking until the list is empty.
  A skip-list you can see beats a suite you cannot run.
- **Step 3a changes ranked-write behaviour.** Anything touching `/api/solve` needs the AGENTS.md §6
  treatment: authorize → validate → mutate, replay-safe, and an agent-invocable `/security-review`
  pass. Option (a) avoids new write paths entirely, which is most of why it is recommended.
- **Step 3b adds a public endpoint.** Keep it aggregate-only (dates → counts). No user data, no
  per-user branching — otherwise it inherits the auth-gating problem it exists to avoid.
- **Steps 4 and 5 touch the same first-run surface.** If both land close together, verify the rules
  popup does not collide with a reorganised hub's onboarding feel. The running order already puts
  Step 4 (#3) far ahead of Step 5 (#9, last), so this only bites if Step 5 gets pulled forward.
- **Regression risk is concentrated in Step 1's absence.** Until it lands, every other step must be
  verified by hand. That is why Step 1 keeps its slot at the front of the running order regardless
  of size.
- **Cohesive ordering defers the cheapest high-severity fix.** 6a (board keyboard entry, High,
  ~10 lines) sits inside Step 6 at #5 rather than leading, purely to keep the board work together —
  see "What this ordering costs". It is the one item worth pulling out of order, and it can land
  alongside Step 1 without touching anything Step 1 touches.
- **Step 4's branch carries unproven e2e assertions.** `feat/hub-reorg` (`03152de`) is code
  complete with lint, build and unit suite green, but its two updated e2e specs have never executed
  — Step 1 is what makes them runnable. Do not read "committed" as "verified": merging it before
  Step 1 lands means merging assertions nobody has seen pass.

## Verification plan

Per step, on top of the standard AGENTS.md pre-merge gate (`npx vitest run`, `npm run lint`,
`npm run build`, `npx markdownlint-cli`, doc audit + reverse-reference sweep, `Docs/pre-merge-log.md`
entry):

- **Steps 1, 2, 6, 7** — an e2e assertion that fails before the fix and passes after. State the
  deliberately-broken run in the step-log; per the pre-merge log's own rule, an assertion is presumed
  vacuous until that is done.
- **Step 3a** — a ranked-write test: play today's board from `/archive`, assert one attempt exists
  (or that the player was routed to `/daily`); assert a past day still writes none. Plus
  `/security-review`.
- **Step 3b** — the July boundary and the 2026-07-24 gap, asserted against the coverage endpoint
  rather than against hardcoded dates.
- **Steps 4, 5, 9c** — visual check at 320/390/768/1280 **by the owner**, not self-certified from
  agent screenshots (established preference).
- **Step 8** — structural PDF assertions per variant.

## Appendix — reproducing the QA pass

- **Generation matrix + independent uniqueness verification.** Drive `generateSinglePuzzle`,
  `generateKillerSudoku`, `generateCalcSudoku` over the full combo matrix, then re-verify each board
  with `countSolutions` / `KillerSolver.countSolutions` / `CalcSolver.countSolutions` and check the
  cage partition covers every cell exactly once. Verifying with the *same* grader that produced the
  board proves nothing — use the independent counter.
- **Archive era scan.** Walk `GET /api/daily/slots?date=` day by day and count slots; that is how
  the three eras, the 2026-07-11 floor and the 2026-07-24 gap were found.
- **Accessible names.** Read the accessibility tree, not the DOM. `placeholder`-only inputs look
  labelled in the DOM and appear as `textbox "0"` in the tree — that is the evidence for F5.
- **Anti-cheat.** Probe `/api/solve` from the signed-in browser context with a known-good solution
  and mutated `timeMs`/`grid`/`difficulty`; probe every `/api/me/*` with `curl` (no cookies) for the
  401s.
