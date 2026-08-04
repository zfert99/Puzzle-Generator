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
