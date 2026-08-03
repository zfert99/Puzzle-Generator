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

## 2026-08-03 — Docs folder organization + `Docs/README.md`

Branch `chore/pre-merge-log` on `341b987` · docs only, no source touched.

### Mechanical

`npx markdownlint-cli` clean on every file this branch touches. **Vitest / lint / build skipped —
no `.ts`/`.tsx` changed.** A repo-wide relative-link checker was run instead, since moving docs is
exactly the change a test suite cannot catch.

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
4. *(pre-existing, not this branch)* Three mirrored source docs have broken links —
   `src/app/page.md` → `../../features/hub/PuzzleHub.md`, `src/app/globals.md` →
   `../../features/juice/SolvedStamp.md`, `src/app/api/auth/[...all]/route.md` →
   `../../../features/auth/auth.md`. **Confirmed broken on `main`** by checking out and re-running
   the link check there. Not fixed here — out of scope for a docs-organization slice.
5. *(pre-existing, untracked)* `Docs/research/compass_artifact_wf-e8ed3fd9-…_text_markdown.md` —
   an auto-generated filename that violates the kebab-case rule and fails markdownlint. Left alone:
   it is uncommitted and not this branch's to adopt.

### Rules this run produced

- **Live source rationale outranks "completed."** Before archiving a doc, grep for it in `src/` and
  `*.config.ts` — **not just `*.md`**. The doc-only reverse-reference sweep structurally cannot see
  a code comment, and code comments are how a reader gets from a puzzling line to its reason.
- **Moving a doc breaks links in two directions.** Every inbound link *and* every relative link
  *inside* the moved file (its depth changed by a level). Verify with a resolver that walks every
  `](…md)` in the repo, not by eye.

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
