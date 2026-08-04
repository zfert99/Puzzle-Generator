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
| `src/features/engine/calc/calc-sudoku.test.ts` → `generateCalcSudoku > "hard leans on × …"` | Times out (`Test timed out in 5000ms`) in ~10–15% of **full-suite** runs. Solo: 261/453/640 ms. Under parallel load: measured **5738 ms** against Vitest's then-default 5000 ms. Cause was worker CPU contention against real randomized generation, not the assertions. | **✅ Resolved 2026-08-04** (`fix/keisan-test-flake`). Kept here because branches cut before that fix still hit it. Established 2026-08-03 over ~18 full-suite runs; root-caused and fixed the next day — see the entry below, which found **three** distinct causes under this one test name. |

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
