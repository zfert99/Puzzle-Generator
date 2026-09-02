# Project Status — PAUSED 2026-08-11

> **Read this first when picking the project back up.** It is a cold-start handoff: where things
> stand, what to do next, and the traps that already cost time once. Written at the moment of
> pausing, so treat dates as the last known truth rather than today's.

**`main` is at `331dc67`, green, and deployed.** Nothing is half-finished on `main`; every branch
listed below is either merged or explicitly parked. There is no work in progress to recover.

---

## 60-second orientation

| | |
|---|---|
| Plan of record | [qa-remediation-plan.md](qa-remediation-plan.md) — 9 ordered steps, per-step logs |
| Gate before any merge | [pre-merge-log.md](pre-merge-log.md) — **read its Known flaky tests table first** |
| Doc index | [README.md](README.md) |
| Longer-term phases | [roadmap.md](roadmap.md) |
| App | `biscuitlab.net/puzzles`, mounted at `basePath: '/puzzles'` |

**Run it:** `npm run dev` → <http://localhost:3000/puzzles> (note the path — bare `/` 404s).
**Test it:** `npx vitest run` · `npm run test:e2e` (add `E2E_PORT=3100` if a dev server is already up).

---

## What shipped on 2026-09-02 (one-day detour, not on the plan)

[#78](https://github.com/zfert99/Puzzle-Generator/pull/78) — **hint agent**: an MCP server over
`HumanSolver`, a one-hint agent on the Anthropic SDK, and an eval harness that scored 52 positions
against the solver as ground truth (100% valid / 0% leak / 12 of 12 refusals on Opus 5, with a
recorded ceiling effect — every hint was a single). New engine file `deductions.ts` gives
`listDeductions()`, the first way to ask the solver "what are *all* my options here?"; nothing is
routed into the app. Living doc: [hint-agent-plan.md](hint-agent-plan.md). Devlog:
[https://biscuitlab.net/log/grading-a-hint-agent-with-the-solver](https://biscuitlab.net/log/grading-a-hint-agent-with-the-solver). Running the eval needs `ANTHROPIC_API_KEY` **and** `ANTHROPIC_WORKSPACE_ID` (the
Console's keys are identity-linked now). The Next-up table below is unchanged by this.

---

## What shipped in the last working session (2026-08-07 → 08-11)

Five PRs, all merged and green:

| PR | What |
|---|---|
| [#69] | Hub grouped into **Play / Compete / Print**, with a Sudoku card added |
| [#70] | **The Playwright suite runs for the first time** — it had never executed |
| [#71] | Multi-zone write-up closed out |
| [#72] | Archive stops handing out today's board unranked |
| [#73] | `nanoid` high-severity advisory patched via `overrides` |

The headline is #70. `baseURL` was the bare origin while the app is mounted at `/puzzles`, so every
`page.goto` 404'd, the axe scans passed **against Next's 404 page**, and `npm run test:e2e` aborted
before a single test ran. CI never ran e2e, so nothing surfaced it. It now runs on every PR, and
`e2e/fixtures.ts` fails any test whose navigation returns ≥ 400 — so this cannot silently recur.

---

## Next up

Step 3a is done. The running order from the plan, unchanged:

| # | Step | Size | Note |
|---|---|---|---|
| **1** | **Step 3b** — calendar bounds + grey out empty days | M | **Start here.** Has substantial prior art — see below |
| 2 | **Step 3c** — legacy days do not explode the picker | M | Days 2026-07-20→07-31 render up to 33 tabs |
| 3 | **Step 6** — board accessibility (F4, F6, F7) | S | **6a is the best value in the plan** |
| 4 | Step 7 — labels, page titles, toggle semantics | S | |
| 5 | Step 8 — PDF bookmark/link parity for Killer + Keisan | S–M | |
| 6 | Step 9 — polish (mobile nav, leaderboard `userId`, mini board size) | M | |
| 7 | Step 5 — per-type rules dialogs | L | Last: net-new content, and depends on 6c |

**If you only do one thing, do Step 6a.** The puzzle board is unreachable by keyboard — every
gridcell is `tabindex="-1"` and the grid container is not focusable, so a keyboard-only player
cannot start at all (WCAG 2.1.1). Roving tabindex and arrow keys already work *after* a mouse
click, so the fix is seeding the initial index: roughly ten lines for a High-severity defect.

---

## ⚠ Step 3b has prior art — do not start from scratch

This is the single most valuable thing in this document.

**`fix/qa-findings-aug-2026`** (3 commits, never merged, no PR) already contains much of Step 3b:

```text
src/app/api/daily/days/route.ts        ← the endpoint 3b needs
src/app/api/daily/days/route.md
src/app/api/daily/days/route.test.ts   ← with tests
src/features/dailies/components/ArchiveExperience.tsx   ← calendar bounds wiring
src/features/leaderboards/components/LeaderboardView.tsx
```

**`stash@{0}`** ("wip: ArchiveExperience calendar-bounds fix from the discarded QA branch") is a
refinement *on top of that branch*, fixing a **calendar deadlock**: a provisional `minDate` plus
`maxDate` disables both arrows, and if the bounds request fails the effect only re-runs on a month
change neither arrow can now produce — a dead calendar with reload as the only escape.

Three decisions were paid for once already and should not be re-derived:

1. **One endpoint, not two.** `/api/daily/days?month=` returns the month's populated days *and* the
   global floor (`first`) in a single call.
2. **`loadedMonths` is load-bearing.** Without it, "this month has no boards" and "not fetched yet"
   are the same state, so every unfetched day greys out on arrival.
3. **Fix the deadlock in the PARENT, not `Calendar`.** Its commit message is explicit: making an
   absent `minDate` mean "cannot page back" would change the contract for any unbounded caller.

That branch was set aside, not rejected on merit. **Read it before writing new code**, and check
whether its other fixes are still needed — some may have landed separately since.

**Data 3b must handle** (measured 2026-08-11):

- The first daily is **2026-07-11**; before that the archive holds nothing.
- **2026-07-24 has zero boards** — a real one-day hole from the Vercel Cron outage fixed in `38ec174`.
- So "greyed" means *no boards*, which is **not** the same as *before the floor*. Two cases.
- Days 2026-07-20 → 07-31 carry the retired 30-key scheme (19–33 slots). Those keys must stay
  readable and replayable — a standing `/pre-merge` invariant. Do not "clean up" the rows.

---

## Branches

**Safe to delete — all merged via squash** (which is why `git branch --merged` does not list them):

```text
docs/multi-zone-cost (#68)          fix/e2e-basepath (#70)
docs/rate-limit-verified (#63)      fix/invalid-date-500 (#61)
feat/hub-reorg (#69)                fix/leaderboard-dto (#64)
fix/archive-not-today (#67)         fix/mistakes-plausibility-bound (#62)
fix/archive-today-to-daily (#72)    fix/nanoid-cve (#73)
fix/cron-via-github-actions (#66)
```

**Keep:**

- **`fix/qa-findings-aug-2026`** — the Step 3b prior art above. **Do not delete before 3b lands.**
- `claude/compassionate-pasteur-38d4f3` — a worktree branch at `bb10da9`, no unique commits.
  Its worktree is still registered; `git worktree remove` it if that tooling is no longer in use.

**Stashes:** `stash@{0}` is the 3b refinement (keep). `stash@{1}` is "phase 7 roadmap section, wip"
from `feature/strategy-courses` — a branch that no longer exists; check it before discarding.

**Open PR:** [#65] Dependabot, `minor-and-patch` group, 4 updates. Untouched by the last session.

---

## Open items not owned by a step

| Item | Status |
|---|---|
| **`DATABASE_URL` as a repository secret** | ⏳ Owner action. Unlocks 4 skipped `/daily` e2e specs. **CI is green without it** — coverage, not a blocker. `ci.yml` already reads it and derives `E2E_HAS_DB` from its presence. |
| **`killer-sudoku.ts:124` cites a moved doc** | 🔴 Open. Points at `Docs/killer-6x6-implementation-plan.md`; the file is in `Docs/archive/`. PR #71 fixed *different* stale pointers despite its title. |
| **The roller can be late** | 👀 Watch. On 2026-08-11 today had **zero boards** at ~02:00 UTC. Same class as the outage behind #66. `/archive` and `/daily` now degrade gracefully, but the cause is upstream. |

---

## Traps that already cost time

- **Read the Known flaky tests table before blaming a red test on your diff.** An e2e test that
  fails under `fullyParallel` but passes solo is the documented contention flake, not your change.
  Confirm with `npx playwright test <file> -g "<title>"`.
- **`reuseExistingServer` will attach to a server running a different branch's code.** It matches on
  port, not commit. Use `E2E_PORT` whenever another server might be up. This produced two confident,
  wrong failures once.
- **`npm run build` needs `DATABASE_URL`** even though `next dev` does not — `/api/daily` evaluates
  the DB client at module scope, and a production build collects page data for every route.
- **A test runner does not see `.env.local`.** Next injects it into the app process only. A
  `process.env.X`-gated skip silently over-skips unless the config loads the file itself.
- **Gate tests on the condition they need, not a proxy.** "Is a database configured" stood in for
  "does today have boards" and the two diverged the first morning the roller was late.
- **Squash merges make `git branch --merged` lie.** Check the PR, not the merge-base.

---

## Beyond this plan

[roadmap.md](roadmap.md) — Phases 1–6 and 8 are done. Still planned:

- **Phase 7 — Strategy Courses** ([plan](strategy-courses-implementation-plan.md)); `stash@{1}` holds
  an unfinished roadmap section for it.
- **Phase 9 — Social & Economy** ([plan](social-progression-economy-plan.md)) — crumbs,
  achievements, friends, battles.
- **Solo-dev QA hardening** (roadmap backlog) — branch protection, an AI reviewer, axe/Lighthouse in
  CI, property-based and mutation testing. #70 delivered the first slice of this by making e2e real.

[#65]: https://github.com/zfert99/Puzzle-Generator/pull/65
[#69]: https://github.com/zfert99/Puzzle-Generator/pull/69
[#70]: https://github.com/zfert99/Puzzle-Generator/pull/70
[#71]: https://github.com/zfert99/Puzzle-Generator/pull/71
[#72]: https://github.com/zfert99/Puzzle-Generator/pull/72
[#73]: https://github.com/zfert99/Puzzle-Generator/pull/73
