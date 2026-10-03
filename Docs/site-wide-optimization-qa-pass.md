# Site-wide Optimization + QA Pass (October 2026)

> **Status:** ✅ **Landed 2026-10-02** as four slices in the order §7 proposed — engine
> [#140](https://github.com/zfert99/Puzzle-Generator/pull/140), server/API
> [#141](https://github.com/zfert99/Puzzle-Generator/pull/141), design tokens + a11y chrome
> [#142](https://github.com/zfert99/Puzzle-Generator/pull/142), board/store (the fourth PR). Each
> was cut from `main` after the previous merged, gated, and squash-merged on green CI. Built on
> `chore/site-wide-optimization-qa` from `6db9c70` · **Date:** 2026-10-02
> **What this is:** the self-contained record of one full-site review (five parallel read-only
> audits + a live browser pass over a production build) and the remediation that followed. It
> front-loads everything a cold reader needs: what was reviewed, what was found, what was fixed
> with measured before/after numbers, what was deliberately deferred and why, and how the work
> was verified. Prior audits it builds on, and does **not** repeat:
> [performance-audit.md](performance-audit.md) (P1–P6, July 2026),
> [mobile-a11y-audit.md](mobile-a11y-audit.md) (G1–G9), the July 2026 security pass and whole-app
> code review recorded in [roadmap.md](roadmap.md), and
> [research/daily-solve-time-trust.md](research/daily-solve-time-trust.md).

## 1. How the pass was run

Five read-only review agents swept disjoint areas in parallel — client rendering performance,
server/API correctness + security, the interactive board and store, the engine, and
accessibility/SEO/UX chrome — each instructed to verify every claim by reading the code and to
list what was already solid so it would not be "fixed". In parallel, the site was driven in a
real browser against a **production build** (`next start` on port 3100; a `puzzles-prod` entry
was added to `.claude/launch.json` for this): every route at desktop and 320 px, a full 4×4
game (input, repeated wrong digit, out-of-range digit, undo, hint, reload-and-continue), and
per-route JavaScript weights read from the Resource Timing API.

The baseline on `main` was green everywhere — lint, typecheck, 918 unit tests, 49 e2e tests,
`npm audit --audit-level=high`, build — so every finding below is a *latent* defect, not a
regression: things the existing gates could not see.

Remediation was then split by file ownership so three agents could edit concurrently without
collisions: engine (`src/features/engine/**`), server (`src/app/api/**`, services, limiters)
and client (everything else, done by the orchestrating session). A fourth agent backfilled the
mirrored `.md` docs afterwards.

## 2. Findings and fixes — by area

Severity is the reviewer's call at the time; **Fixed** means landed on the branch with tests
where the behaviour is testable, **Deferred** means recorded in §5 with a reason.

### 2.1 Client rendering performance

| # | Finding | Sev | Status |
|---|---|---|---|
| C1 | `template.tsx` was a `motion.div` from the `motion` library: every route shipped ~39 KB gz of animation runtime, and the server HTML carried `opacity:0; translateY(8px)` as an inline style, so **every page was invisible until hydration** — the LCP element could never paint early. Reduced motion did not help (the client hook's server snapshot was "not reduced"). | High | **Fixed.** Template is a Server Component with a CSS `page-enter` keyframe; `SolvedStamp` moved to CSS keyframes; `motion` **removed from `package.json`**. |
| C2 | `Cell`'s selector returned the raw selected value (`selValue`), so **all N² cells re-rendered** whenever the selection moved between two different digits or a digit was typed — the P2 `React.memo` was defeated on most moves. | High (INP) | **Fixed.** Selector returns `candMatch` (the one pencil mark this cell draws), so only cells whose own output changes re-render. |
| C3 | `useSavedGame` included `elapsedTime`; every Experience calls it, so the **whole play tree re-rendered once a second** (board, numpad, cage overlay) to refresh a menu label that was not on screen. Side effect: the Killer calculator's focus effect re-ran every tick/keystroke and pulled focus to Close. | Medium | **Fixed.** Clock removed from the slice; new `SavedElapsed` leaf subscribes alone; `Board` and `Numpad` are `memo`'d; Calculator focus-on-open split into its own `[open]` effect. |
| C4 | zundo's history `equality` was two `JSON.stringify` calls of the whole grid on every `set`, including every timer tick. | Medium | **Fixed.** Reference check first, deep compare only when a reference moved. (Debouncing the persist write itself was considered and skipped — sub-millisecond, not worth the flush-on-`pagehide` complexity.) |
| C5 | The Kakuro + Skyscrapers exact and logical solvers were in the client bundle of **every route** (store → `hint-deducers` static import), including the hub (via `ContinueBanner`) and `/daily` (where Hint is disabled). `performance-audit.md`'s "the solver never enters the client bundle" line was false. `calcGridConfig` imported from `calc-generator` likewise pulled the Keisan solver in. | Medium | **Fixed.** Deducers are `import()`-ed lazily, kicked off by `startNewGame`/rehydration for the two variants that need them (`preloadHintDeducers` exported for tests); `calcGridConfig` moved to `calc-types.ts` (re-exported from the generator for existing callers). |
| C6 | `LeaderboardView` fetched the board **twice** for signed-in viewers (once while the session was pending, once resolved — `isMe` is server-baked) and a third time when the hard-coded `'easy'` tab was not rolled that day. | Medium | **Fixed.** The board fetch waits for the day's slots to settle and the session to resolve. |
| C7 | Space Mono (~19 KB) preloaded on every route though only the board draws it. | Low | **Fixed.** `preload: false`. |
| C8 | `useSetting`'s snapshot parses localStorage per render per subscriber (81 cells). | Low | Deferred — moot once C2 stops the full-grid re-renders; revisit if RUM INP says so. |
| C9 | Backdrop keeps 10 compositor layers animating forever (battery on mobile). | Low | Deferred — behaviour by design; freeze-on-board-routes is an option if RUM shows it. |

**Measured per-route JavaScript (gzipped, production build, Resource Timing):**

| Route | Before | After |
|---|---|---|
| `/play` | 224 KB | 187 KB |
| `/daily` | 243 KB | 177 KB |
| `/leaderboard` | 195 KB | 158 KB |
| `/` (hub) | — (not captured pre-change; the hub carried the 39 KB motion chunk and the 17.6 KB store+solvers chunk) | 162 KB |

Server-rendered HTML no longer contains `opacity:0` on the page wrapper (verified in the
built `.html` and live).

### 2.2 Interactive board and store (correctness)

| # | Finding | Sev | Status |
|---|---|---|---|
| B1 | **A full-but-wrong Kakuro daily gave no feedback and the player was stuck.** `isFull` checked every cell `!== 0`, which a Kakuro can never satisfy (black cells are stored as 0). The "Not quite!" review — the only route to `revealErrors` on a daily — never appeared. | High | **Fixed.** New `useBoardReview` hook counts only editable cells; review extracted to a shared `ReviewDialog`. |
| B2 | Archive replays had **no review path at all** — a full, wrong practice board could only be fixed by guessing (Hint does nothing on a full board). | Medium | **Fixed.** Archive renders the shared `ReviewDialog`. |
| B3 | **Undo/redo did not persist.** With `temporal(persist(...))`, zundo's undo wrote through the raw `set` and bypassed persist; localStorage kept the pre-undo grid until the next timer tick, and a reload inside that second resurrected the undone move. Reproduced live. The same order made persist's hydration `set` throw inside its promise chain (swallowed; `hasHydrated()` never flipped). | Medium | **Fixed.** Middleware order swapped to `persist(temporal(...))`; two hydration tests prove the write-through and the clean hydration. |
| B4 | Board key handler ignored modifiers: Cmd/Ctrl+1–9 entered digits and blocked tab switching, Cmd/Ctrl+0 cleared the cell and blocked zoom reset, Cmd/Ctrl+P toggled pencil and blocked Print. | Medium | **Fixed.** Early return on Meta/Ctrl/Alt (undo/redo keep their own listener). |
| B5 | The timer counted hidden-tab time at a browser-dependent rate (Chrome full speed for ~5 min then ~1/min; iOS Safari suspends) — three copies of the interval, none watching `visibilitychange`. Also the "two tabs overwrite each other's saved game" window, since a hidden tab kept writing every second. | Medium | **Fixed.** One `useGameClock` hook, ticking only while the document is visible (not a pause — no Resume click on return); tests cover visibility. The single-slot two-tab overwrite is **narrowed**, not closed — see §5. |
| B6 | "Puzzle solved" was never announced: the solving move changed `status` and `grid` in one update and the grid-diff message won. | Low | **Fixed.** The solve message takes precedence. |
| B7 | Cmd/Ctrl+Z fired behind open dialogs and while paused; the Undo button stayed enabled while paused (changing a hidden board). | Low | **Fixed.** Both gated on `status === 'playing'`; the shortcut ignores events from inside a dialog. |
| B8 | Hint on a full-but-wrong board did nothing silently. No store-level 1..maxNum guard. Killer cage lookup scanned every cage's cell list per keystroke though `cellToCage` existed. | Low | **Fixed.** Hint leaves a note; range guard; O(1) cage lookup. |
| B9 | Client-clock trust for ranked solves (`timeMs` client-chosen; restart resets the clock). | — | Already documented in `research/daily-solve-time-trust.md`; gated on Phase 9. Not touched. |

### 2.3 Server / API / security

No critical or high findings; the BOLA posture, solve-integrity checks, cron auth and error
hygiene all held up. Medium items:

| # | Finding | Sev | Status |
|---|---|---|---|
| S1 | **Public leaderboard leaked the email local-part / Google legal name**: it displayed `coalesce(username, name)`, sign-up sets `name` to the email's local part, and the username prompt is optional. | Medium (PII) | **Fixed.** The service selects only `username`; a row without one shows `'Player'`; the bot is labelled from `BOT_NAME` by id. A better-auth `name` validation hook was judged unnecessary now that `name` is never displayed. |
| S2 | Both rate limiters did `INCR` then `EXPIRE` as two round trips; a failed `EXPIRE` left a key with no TTL and the IP blocked forever (10 PDF requests, ever). `Retry-After` reported the full window, not the real TTL. | Medium | **Fixed.** One atomic multi (`incr`, `expire` with `NX`, `ttl`) in a shared helper; `NX` heals stuck keys; `Retry-After` is the real TTL. |
| S3 | `/api/generate`'s 60 s function budget was enforced only for Kakuro/Skyscrapers; 5 extreme Killers + 45 hard averaged ~43 s on dev hardware with tails past 60 s → 504 with a half-built PDF. | Medium | **Fixed.** Classic, Killer and Keisan generators accept the same `timeBudgetMs`; the route passes one 45 s batch budget to all five and returns the same 503 + `Retry-After: 5` contract. |
| S4 | No route tests for the cron secret path or for a `me/*` route ignoring `?userId=`. | Medium | **Fixed.** Both added (cron: unset/wrong/wrong-length/correct; `me/bests` ignores `?userId`). |
| S5 | Unknown `variant` fell through to Classic on `/api/generate` and `/api/puzzle`. | Low | **Fixed.** 400 with a fixed message. |
| S6 | `/api/daily/slots` fetched the full `grid` jsonb per row to read its length, and the query lived in the route. | Low | **Fixed.** Service method using `jsonb_array_length`. |
| S7 | Immutable past-date reads (`/api/daily?date=`, `/slots?date=`, `/days?month=`) sent no cache headers. | Low | **Fixed.** `public, s-maxage=86400, stale-while-revalidate=86400` only for strictly-past dates/months, only on 200, never on `/api/leaderboard` (per-viewer `isMe`) or `me/*`. |
| S8 | Client IP behind the multi-zone hub rewrite is unverified — if the hop presents the hub's egress IP, every user shares one rate-limit bucket (10 PDFs/min globally; better-auth's sign-in limit trivially exhaustible). | Medium (unverified) | **Open — needs one production log line.** See §5. |
| S9 | Usernames unique case-sensitively (`Alice`/`alice` coexist). Unbounded `me/attempts` query. | Low | Deferred (migration; pagination) — §5. |

### 2.4 Engine

| # | Finding | Sev | Status |
|---|---|---|---|
| E1 | **Uniqueness gate.** Both classic diggers ran the HumanSolver (ALS/AIC to exhaustion on failure) before checking uniqueness, yet every rejected dig was rejected for non-uniqueness. | High (perf) | **Fixed.** `countSolutions` (≈0.1 ms) first; byte-identical output per seed, proven by seeded tests. |
| E2 | **Classic "Expert" was not enforced**: 38 of 40 generated Expert puzzles solved with basic strategies only; `canHumanSolveExpert` was dead code. | High (product) | **Fixed.** Expert retries until advanced strategies are genuinely required (bounded, 60); 6 seeded tests assert not-basic-solvable. Seeded Expert output has changed. |
| E3 | A latent **unsound AIC branch** (weak-start/weak-end, same-digit endpoints → eliminate both) never fired only because the BFS `visited` set blocked it; any search rewrite would have switched it on. | High (latent) | **Fixed.** Branch deleted; counterexample test added. |
| E4 | W-Wing typo (`cp1.c` for `cp2.c`) could accept a bridge whose conjugate was the first bivalue cell. | Low | **Fixed.** |
| E5 | No time budget on Killer / Keisan / classic extreme generation (Killer extreme measured 8.6–31 s each). | High (timeouts) | **Fixed** (S3). |
| E6 | Five `popcount` copies. `basic.ts` claimed "Box-Line Reduction" but implements only pointing pairs (no claiming). `benchmark-skyscrapers.ts` had no mirrored doc. | Low | **Fixed** (one `popcount`; honest comment + documented Claiming gap; doc written). README's strategy list corrected. |
| E7 | AIC string-keyed BFS with `queue.shift()` and path copies; ALS-XZ duplicate enumeration + pairwise cell-by-cell checks; Keisan `hiddenPair` closures (36% of Keisan extreme); Killer Rule-of-45 geometry rebuilt per call; benchmark pools unseeded. | High (perf) | **Deferred** — real rewrites, each with a named benchmark to prove it; §5. |

**Measured (`benchmark.ts`, same machine, before → after):**

| Row | Before | After |
|---|---|---|
| Pipeline Gen, 5× Extreme | 884 ms | 153 ms (5.8×) |
| Seeded single dig pass, extreme tier (10 seeds) | 445 ms | 36 ms (12.4×, identical output) |
| Seeded single dig pass, advanced tier (30 seeds) | 17.2 ms | 8.7 ms (2.0×, identical output) |
| Pipeline Gen, 10× Expert | 17.2 ms | 95.2 ms — **intended**: ~10 dig passes per puzzle instead of 1, because Expert is now real |
| HumanSolver Advanced | 0.19 ms | 0.61 ms — the test puzzles changed (they now need advanced strategies); the solver on old-style puzzles still times 0.18 ms |
| HumanSolver Extreme | 25.9 ms | 26.1 ms — known noise band |

### 2.5 Accessibility, SEO and UX chrome

| # | Finding | Sev | Status |
|---|---|---|---|
| A1 | **Dark mode: `text-ink` on `bg-butterscotch` was 1.5:1.** Every primary button and selected pill was unreadable in the dark theme (`--ink` flips to cream; the fill stays light). axe never saw it because e2e ran light-only. | High | **Fixed.** New `--on-butterscotch` token (dark ink in both themes) on every butterscotch fill; also `--mint-text`/`--warn-text` for text-grade tones (the fill-grade mint and butterscotch-dark failed 4.5:1 as small text), the focus ring moved from butterscotch (1.95:1) to grape, legacy `indigo`/`gray`/`white/5` utilities retired. The first dark-mode axe run then caught a second pair — the hub/daily stickers at 1.25:1 and 2.35:1 — fixed with `--on-sticker`. |
| A2 | **The overflow e2e test was vacuous**: `overflow-x: hidden` on `html, body` clamps `documentElement.scrollWidth`, so a 3000 px element appended at 320 px still read 320. It hid two real bugs: at 320 px the header's "Sign in" sat at x=299–335 (clipped, unreachable — WCAG 1.4.10), and the five-column type picker gave each label 27–38 px while "Skyscrapers" needs 89 — overlapping labels on every phone width. | High | **Fixed.** Test now measures `max(documentElement, body).scrollWidth`; the nav wraps; the type picker is a wrapping flex row. Verified at 320 px: no overflow, "Sign in" on its own line, every pill at its natural width. |
| A3 | Sign-in inputs had no labels and no `autocomplete` (placeholders only; axe accepts placeholders). Same in the username prompt and the header's inline username edit. | High | **Fixed.** Visually-hidden labels; `autocomplete` (`username webauthn` on email — enables passkey conditional UI — `current-`/`new-password`, `nickname`); `role="alert"` errors linked via `aria-describedby`; Google sign-in `busy` reset on failure; Escape cancels the inline edit. |
| A4 | No skip link (seven header controls precede every page's content). | Medium | **Fixed.** `.skip-link` first in `<body>`, `id="main"` on every `<main>`. |
| A5 | Selected state by colour only on the daily slot pills and leaderboard tabs; a `<label>` that labelled nothing. | Medium | **Fixed.** `aria-pressed`, `role="group"` + `aria-labelledby`. |
| A6 | Reduced motion had no CSS fallback: everything keyed off `data-motion`, set only by the pre-paint script whose single `try` also wrapped the storage read — with site data blocked, the OS preference never applied. | Medium | **Fixed.** `@media (prefers-reduced-motion: reduce)` block mirrors every `data-motion` rule; an explicit in-app "Full" now sets `data-motion="full"` so it still wins. |
| A7 | No `error.tsx` / `not-found.tsx` — a render error or 404 showed Next's bare text. | Medium | **Fixed.** Branded both, with the hub link and (error) a reset button. |
| A8 | No OpenGraph/Twitter metadata, no `viewport` export (`themeColor`), no CSS `color-scheme` (native `<select>` and number inputs stayed light in dark mode), no per-route description. | Medium | **Fixed** (text metadata, `summary` card, theme colours, `color-scheme`, descriptions). An `opengraph-image` is a design task — §5. |
| A9 | Silent failures: a failed `/api/daily/slots` fetch left the picker offering "Play Easy" for a board that may not exist. Dynamic status not announced (rank line, loading, errors). | Medium | **Fixed.** `loading / ready / empty / failed` states with Retry; `role="status"` / `role="alert"` / `aria-busy`. |
| A10 | Inline "Sign in" links in running text distinguished by colour only (axe `link-in-text-block`). | Medium | **Fixed.** Underlined. |
| A11 | Mobile menu lacked Escape/outside-click close; pencil button named only by its emoji; "Remove" passkey button did not say which; leaderboard `#` header read as "number sign"; h1s said "Sudoku" on pages covering five types; `/signin`'s h1 duplicated the hub's. | Low | **Fixed.** |
| A12 | Hand-rolled modals (`ConfirmModal`, `SolvedDialog`, review, settings, calculator) are `aria-modal` overlays without a focus trap or `inert` background — only `RulesDialog` uses native `<dialog>.showModal()`. | Medium | **Deferred** (§5) — the right fix is moving all five onto the `<dialog>` shell, a contained but separate slice. |
| A13 | Marquee ticker has no pause control except the global reduced-motion setting (WCAG 2.2.2 accepts a mechanism; a per-widget control would be better). Touch targets under 44 px on coarse pointers (G5), hover not gated (G6), board sizing (G7), PWA (G9). | Low | Deferred — §5 and `mobile-a11y-audit.md`. |

Dead code removed: `ThemeToggle.tsx` (never imported) and the five create-next-app SVGs in
`public/` that nothing referenced.

### 2.6 Mobile sizing (owner's ask, added after the first sweep)

Driven at 320, 360 and 390 px on the production build: every route, plus a started 9×9
Sudoku, a 9×9 Kakuro and a 7×7 Skyscrapers board.

| # | Finding | Status |
|---|---|---|
| M1 | The in-game header (label · clock · mistakes · Errors/Pause/Rules) did not fit at 360–390 px; instead of wrapping as groups the label broke over two lines and the mistakes counter stacked its "✗" above its digit. | **Fixed.** `flex-wrap` + `whitespace-nowrap` on the label and counter; the button trio drops to a second line whole. |
| M2 | Header nav links were 20 px tall (WCAG 2.5.8 wants 24 px); fine on one line via the spacing exception, but once the nav wraps at phone widths the rows are 4 px apart. | **Fixed.** `py-1` on each link (28 px). |
| M3 | Boards: 9×9 Sudoku, 9×9 Kakuro (clue digits legible) and 7×7 Skyscrapers (40 px cells, four-sided gutter) all render at `min(92vw, 520px)` = 359 px with no horizontal overflow; numpad, daily picker, leaderboard tabs, calendar and print form all fit at 360 and 390. | No change needed. |
| M4 | At 320 px the type picker and "Sign in" issues (A2) are the only phone-width defects found, both fixed. | — |

Still open from `mobile-a11y-audit.md`: G5 (coarse-pointer bump for the 40 px secondary
control row), G6 (hover gating), G7 (board sized by height on tablets/landscape).

### 2.7 Difficulty separation by size (owner's ask)

A new repeatable report, `src/features/engine/benchmarks/difficulty-separation.ts`, generates
12 puzzles per (type, size, tier) and grades each with the engine's own solver and scorer. The
full table is in `Docs/research/difficulty-separation-findings.md`; the reading:

- **Every ladder is monotone at every size**, and adjacent tiers are distinct on the axis the
  generator designs for. Killer 9×9: score p50 34 / 56 / 76 / 109 / 173 with disjoint p10–p90
  ranges; Kakuro and Skyscrapers step the solver tier T1→T5 at every size; Keisan 4×4 and 6×6
  bands are disjoint (4 / 8 / 17 and 13 / 24 / 44).
- **Keisan 9×9 easy and medium are identical by score** (p50 38 vs 38) — *by design*: that size
  separates on single-cell givens (measured 13–22 vs 7–11, and easy drops ×) because the solver
  score cannot discriminate there (documented in `DIFFICULTY_CONFIG_9`). Expert/extreme likewise
  separate on guess-step count (1–4 vs 6–8), not score. Both axes measured disjoint.
- **Classic easy/medium/hard are clue-quota tiers** (no technique gate): 4×4 9 / 6 / 4 clues, all
  naked-singles-only; 6×6 20 / 16 / 10; 9×9 41 / 31 / 26 where **half of "medium" is still
  naked-singles-only** and hard always needs a basic technique. Expert (advanced strategies) and
  Extreme (extreme strategies) are now genuinely gated (E2). The one soft spot: a 9×9 "medium"
  that differs from easy only in clue count. A cheap gate (reject a medium/hard that naked singles
  alone finish — the report's own check) was the recommendation. **Applied 2026-10-03 at the
  owner's decision (9×9 Medium only):** `applyMediumDigger` re-digs in a fresh order until naked
  singles alone cannot finish the grid (bounded, 30 tries); the report then read 9×9 medium
  **T1×12** (was T0×6 T1×6) at ~2 ms per puzzle. 4×4 and 6×6 stay on the plain quota dig, where
  nearly every unique grid is singles-only and clue count is the honest lever. A 9×9 Hard is
  still an ungated quota dig and read singles-only once in twelve — the same gate would fit it
  if that ever matters.
- The report's Classic T3 bucket also surfaces the HumanSolver's missing Claiming technique: an
  occasional 41-clue "easy" cannot be finished by the solver at any tier.

## 3. Live browser QA — what was exercised

Against the production build on port 3100, before and after the changes:

- Every route at desktop width and at 320 px; console and network errors read on each. The
  only console errors are Vercel's analytics/Speed-Insights scripts 404ing on localhost
  (expected — they are served by the platform). **Open question recorded in §5:** under the
  multi-zone proxy those scripts load from `biscuitlab.net/_vercel/…`, i.e. the hub project,
  so Speed Insights data may be attributed to the hub rather than this project; the pending
  "24 h RUM check" memory item was never closed.
- A 4×4 free-play game: wrong digit counted once; retyping the same wrong digit toggles it off
  (not a second mistake); digit `9` on a 4×4 ignored; hint reveals a cell with its note; undo
  reverts the DOM **but not localStorage until the next tick** — reproduced B3 exactly; reload
  → "Continue 4×4 easy" with the clock frozen; Undo correctly disabled after rehydration.
- Today's daily had **7** boards, not the 8 Phase 11 R1 added — expected, since the cron ran
  before #138 deployed; the first real cron is the live round-trip (L25 in the Skyscrapers log).
- `/sitemap.xml` correct; `/robots.txt` is the hub's by design.

## 4. Verification

| Gate | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **98 files / 982 tests** (from 94 / 918); no Known-flaky entry fired |
| `npm run build` | clean |
| `npx playwright test` (production build, `E2E_PORT=3100`) | 55 passed first run with **4 real failures from the new dark-mode/extra-route axe runs** (A1's sticker pair, A10) — fixed, then `a11y.spec.ts` **37/37**; full-suite rerun recorded in the pre-merge log |
| `difficulty-separation.ts 12` | every ladder monotone; findings in §2.7 |
| Engine benchmarks | `benchmark-human-solver.ts`, `benchmark.ts` run before/after (§2.4) |
| markdownlint | on every doc touched (pre-merge log entry) |
| Security self-review (server agent, authorize → validate → mutate; no stack leaks; parameterized SQL; public caching only on anonymous past-date reads) | no findings |

Hosted `/code-review` was **not** run (user-triggered, billed).

## 5. Deferred — recorded so it stays visible

Grouped by the kind of follow-up each needs.

### Measured after landing (2026-10-03) — both closed

- **S8 — client IP behind the hub rewrite: per-IP, as hoped.** Thirty `/api/puzzle` requests
  through `biscuitlab.net` from one machine passed and the 31st got `429` with `Retry-After: 54`
  (the limiter is live on Upstash and the real-TTL fix works); a request from a second network
  (the owner's phone on mobile data) inside that window got a puzzle. The hub's rewrite
  preserves the client address in `x-forwarded-for`; no re-keying needed. (The origin itself sits
  behind deployment protection — every public request arrives through the hub.)
- **Speed Insights attribution: the hub project.** `biscuitlab.net/_vercel/speed-insights/script.js`
  is served by the hub (200), so vitals from every `/puzzles/*` page post to the hub and appear in
  the **Biscuit-Website** project's Speed Insights under `/puzzles/…` routes — not in this
  project's dashboard. Decision: leave it; read the data there rather than cross-posting vitals
  to a protected origin.

### Engine performance rewrites — all landed 2026-10-03, each grade-for-grade identical

| Item | PR | Seeded result |
|---|---|---|
| Benchmark hygiene (seeded pools, warm-up, p50/p90) | #147 | HumanSolver Extreme row became a distribution (p50 6.9 / p90 60 ms over 50 puzzles), not a lottery |
| Keisan hidden single/pair on position masks | #148 | Expert 224.6 → 121.8 ms, Extreme 2711 → 1370 ms |
| Killer Rule-of-45 geometry computed once | #149 | Medium 156.7 → 97.2 ms, Hard 449 → 323 ms |
| AIC on a numeric graph, typed-array queue | #150 | Killer Extreme 4998 → 2679 ms |
| ALS-XZ on cell bitsets, de-duplicated ALS list | the final engine PR | HumanSolver Extreme 18.1 → 9.1 ms; classic Extreme gen 79.8 → 44.6 ms; Killer Extreme 2679 → 1953 ms |

Net across the three: Killer 9×9 Extreme generation **5752 → 1953 ms** (3.0×), HumanSolver Extreme
**20.8 → 9.1 ms** (2.3×), classic Extreme generation **884 ms per 5 → 45 ms each**. Method every
time: capture grades or full solves first, change only data structures, diff (zero differences),
then benchmark on the seeded rows. Still open: **Claiming** (line → box) is not implemented;
adding it re-grades every tier.

### Accessibility slices

- ~~A12 — move `ConfirmModal`, `SolvedDialog`, `ReviewDialog`, `SettingsMenu` and `Calculator`
  onto native `<dialog>.showModal()`~~ **Done 2026-10-03:** one shared `Modal` shell
  (`features/chrome/Modal.tsx`) on `showModal()` — focus trap, inert page, Escape/backdrop
  dismissal, focus returned to the opener; all six dialogs (the rules dialog included) use it and
  `useDialogFocus` is retired. Proved in Playwright: fifteen Tabs never leave the Settings dialog.
- A13 / G5–G9 in `mobile-a11y-audit.md`: coarse-pointer targets, hover gating, board sizing by
  height, marquee pause control, PWA manifest + icons, `jsx-a11y` strict.
- An `opengraph-image` asset; a live screen-reader session (owed since Phase 11 G8).

### Server

- S9: a `lower(username)` unique index (needs a migration and a check for existing
  case-duplicates first); pagination on `me/attempts`.
- Better-auth `name` length/charset hook — not needed while `name` is never displayed.
- The two-tab single-slot overwrite (B5) is narrowed by the visibility-gated clock but not
  closed; the real fix is the deferred two-slot save
  (see the `two-slot-save-idea` note in the roadmap backlog).
- Time-trust checks A and B from `research/daily-solve-time-trust.md` before any Phase 9 rule
  reads the clock.

### Client

- C8/C9 if RUM INP or mobile battery reports say so.
- `src/features/hint-agent/eval-states.ts` regenerated with `'expert'` now yields different
  states (E2) — note it before re-running the eval.

## 6. Lessons (phrased as rules for the next pass)

- **A gate that measures the wrong element passes forever.** `overflow-x: hidden` on the root
  made the root's `scrollWidth` meaningless; the test needed `body` too. Before trusting a
  "no overflow" check, append something enormous and confirm it fails.
- **Run axe in every theme the app ships.** Light-only coverage let a 1.5:1 pair sit on every
  dark-mode primary button; the first dark run found two more pairs within a minute.
- **A theme-flipping token on a non-flipping fill is a contrast bug waiting to happen.** Fills
  that stay the same in both themes need their own "on-fill" ink token.
- **Middleware order is behaviour.** `temporal(persist())` vs `persist(temporal())` decided
  whether undo persisted at all and whether hydration threw. Write the order's reason next to it.
- **Any selector that returns a value shared by every cell defeats per-cell memoisation.**
  Reduce the selected-cell value to the boolean/digit *this* cell draws.
- **"Not implemented" beats "falls through."** Unknown variants, unknown slots, failed fetches:
  each wants its own branch (400, "empty", "failed + retry"), never the default case.
- **An eval or benchmark seeded on generator output is a contract.** Enforcing Expert changed
  every seeded Expert puzzle; say so where the seeds are consumed.

## 7. Suggested landing order (PR split)

The branch holds one working tree; AGENTS.md's gate wants slices under ~400 LOC. Split by the
same ownership lines the work was done in — each group is independent and can be cut from
`main` in sequence:

1. **Engine** — `src/features/engine/**` (E1–E6, budgets) + README strategy line + its
   benchmark rows. Re-run `benchmark.ts` on the PR branch.
2. **Server/API** — `src/app/api/**`, `leaderboard.service.*`, `dailies.service.*`,
   `rate-limit.*`, `rate-limit-storage.*`, `auth-schema.md` (S1–S7) + the route budget wiring
   (depends on 1 — land after it). `/security-review` on this one (auth/data-access change).
3. **Board + store** — `src/features/interactive-board/**`, the two Experience files, hub
   banner (B1–B8, C2–C5), `calc-types`/`calc-generator` `calcGridConfig` move.
4. **Design tokens + a11y chrome** — `globals.css`, `template.tsx`, `SolvedStamp`, `layout.tsx`,
   pages, `error.tsx`/`not-found.tsx`, auth components, header/menu, `LeaderboardView`,
   `PuzzleForm`/`GridSizeSelector`, `Sticker`, `settings.ts`, e2e `a11y.spec.ts`, the `motion`
   removal (A1–A11, C1, C6, C7). **Visual change — the owner checks it in their own browser
   before merge** (per the standing visual-check handoff rule).
5. **Docs** can ride with each slice (mirrored `.md`s are per file) — this document, the
   pre-merge log entry, the roadmap/audit/index updates go with whichever lands first.

Two PRs that both prepend to `Docs/pre-merge-log.md` conflict at the top of the file; resolve
by taking `main`'s copy and re-inserting the branch's entry, newest first.
