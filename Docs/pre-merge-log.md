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

| Test | Symptom | Established |
|---|---|---|
| `src/features/engine/calc/calc-sudoku.test.ts` → `generateCalcSudoku > "hard leans on × …"` | Times out (`Test timed out in 5000ms`) in ~10–15% of **full-suite** runs. Solo: 261/453/640 ms. Under parallel load: measured **5738 ms** against Vitest's default 5000 ms (`vitest.config.ts` sets no `testTimeout`). Cause is real randomized generation + worker CPU contention, not the assertions. | 2026-08-03, ~18 full-suite runs. Fix tracked separately. |

---

## 2026-08-03 — Step 5: archive completion counts (X/N)

Branch `feat/daily-step5-archive-counts` on `341b987` · working tree, uncommitted · ~282 LOC of
source plus 224 of tests and the docs (source under the ~400 target).

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
**Read only:** the signed-in UI — the X/N line and calendar dots need an owner visual check.

### Reviews

`/security-review` **run** — full pass no findings, plus a focused re-verify of both server files
(session-only id, authorize→validate→read ordering, parameterized dates, aggregate-only response,
ON-clause ownership, no cross-user render path): all pass.
**`/code-review` NOT run** — user-triggered and billed; an agent cannot launch it.

**Verdict:** gate green, not merged.
