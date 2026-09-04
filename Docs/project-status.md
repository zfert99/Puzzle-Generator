# Project Status — resumed 2026-09-03 (paused 2026-08-11)

> **Read this first when picking the project back up.** It is a cold-start handoff: where things
> stand, what to do next, and the traps that already cost time once. Written at the moment of
> pausing, so treat dates as the last known truth rather than today's.
>
> **Resumed 2026-09-03 — six PRs landed in one session:** Step 6a board keyboard entry (#81), the
> salvaged killer-6x6 doc restore (#86, from the abandoned worktree below), Step 3b calendar
> bounds (#83), Step 3c legacy picker collapse (#84), and Step 2's `bg-pattern` basePath fix
> (#85) — Step 2 turned out to be **silently still open**; this doc's own next-up list omitted it
> and the omission read as done (lesson in `pre-merge-log.md`: reconcile a handoff against the
> plan's per-step logs — trust the logs). Branches and stash cleaned up. The QA plan's remaining
> work is Steps 6b/6c → 7 → 8 → 9 → 5; sections below are updated where they had gone stale and
> otherwise left as the historical record of the pause.

**`main` is at `fda4004` (2026-09-03), green, and deployed.** Nothing is half-finished on `main`; every branch
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

## Next up (refreshed 2026-09-03)

Steps 2, 3a, 3b, 3c, and 6a are done and merged. The remaining running order from the plan:

**The QA remediation plan is COMPLETE (2026-09-04)** — every step landed and merged; see the
plan's own banner and per-step logs. The final sessions' order: Step 9 (`fix/polish-step9`:
mobile nav overflow, mini board caps; 9b had already landed via #64) and Step 5
(`feat/per-type-rules`: per-type rules dialogs on the native `<dialog>` element).

**Next horizons** (nothing in-flight; pick from the roadmap):

| Option | What it is |
|---|---|
| Phase 7 — Strategy Courses | The "crown jewel" (`strategy-courses-implementation-plan.md`; `stash@{0}` holds a roadmap-section wip) |
| Puzzle type 4 | Kakuro research is complete (`research/kakuro.md`); the daily was restructured to absorb new types cheaply |
| Solo-dev QA hardening | Roadmap backlog: branch protection, AI reviewer, axe/Lighthouse CI, property/mutation tests |
| Phase 9 — Social & Economy | Gated on the solve-time-trust work for clock-based rules |

**Step 8 landed 2026-09-04** (`fix/pdf-parity`): Killer/Keisan booklets gained the classic PDFs'
bookmarks + puzzle↔answer links via shared nav helpers.

**Step 7 landed 2026-09-04** (`fix/names-titles-semantics`): input labels, per-route titles under
a `%s · Puzzle Lab` template (brand reconciled), `aria-pressed` toggle groups.

**Step 6 completed 2026-09-04** (`fix/board-rows-dialog-focus`): 6b `role="row"` structure and 6c
dialog focus — the latter generalized into a shared `useDialogFocus` hook because the dialog
shell is a repeated JSX pattern, so F7 existed once per paste (four dialogs + ConfirmModal).

---

## ⚠ Step 3b has prior art — do not start from scratch

> **✅ Landed 2026-09-03 (#83).** The port kept all three paid-for decisions below and used the
> stash's three-state floor. The prior-art branch and `stash@{0}` have been deleted — their
> content is on `main`. Kept as the record of what the port drew on.

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

**All of the above were deleted 2026-09-03**, plus two the pause had said to keep, both now
landed on `main`:

- `fix/qa-findings-aug-2026` — the Step 3b prior art, ported and merged via #83.
- `claude/compassionate-pasteur-38d4f3` — its worktree held a finished, gate-passed,
  never-committed doc fix (the killer-6x6 restore), invisible to every branch/commit listing;
  salvaged and merged via #86. Lesson: an "empty" worktree branch can still carry uncommitted
  work — `git -C <worktree> status` before writing one off.

**Stashes:** `stash@{0}` (the 3b refinement) was dropped after landing in #83. `stash@{1}` —
"phase 7 roadmap section, wip" from the deleted `feature/strategy-courses` branch — is **kept**;
check it when Phase 7 starts.

**Open PRs:** Dependabot only — #80 (17 minor/patch npm bumps) and #74 (upload-artifact 4→7).

---

## Open items not owned by a step

| Item | Status |
|---|---|
| **`DATABASE_URL` as a repository secret** | ⏳ Owner action. Unlocks 4 skipped `/daily` e2e specs. **CI is green without it** — coverage, not a blocker. `ci.yml` already reads it and derives `E2E_HAS_DB` from its presence. |
| **`killer-sudoku.ts:124` cites a moved doc** | ✅ Merged 2026-09-03 (#86) — the abandoned worktree (see Branches) had already fixed it the right way per AGENTS.md §7: the doc moved *back* out of `archive/`, the citation stands. |
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

[#69]: https://github.com/zfert99/Puzzle-Generator/pull/69
[#70]: https://github.com/zfert99/Puzzle-Generator/pull/70
[#71]: https://github.com/zfert99/Puzzle-Generator/pull/71
[#72]: https://github.com/zfert99/Puzzle-Generator/pull/72
[#73]: https://github.com/zfert99/Puzzle-Generator/pull/73
