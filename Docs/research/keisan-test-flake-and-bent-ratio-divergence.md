# Keisan test flake: two independent causes, and a stale bent-ratio figure

**Date:** 2026-08-03
**Trigger:** `src/features/engine/calc/calc-sudoku.test.ts` →
`hard leans on × (operator-mix weighting), keeps −/÷ variety, and is bent-heavy` was failing
roughly 10–15% of full-suite runs, unrelated to the branch under test.
**Status:** Resolved. Both causes fixed and verified; the bent-ratio divergence is explained,
corrected at source, and its cause confirmed by measurement across four commits.

## Summary

The reported flake turned out to be **two unrelated failure modes wearing the same test name**,
plus a documented structural figure that measurement does not support:

1. **Timeout flake** (the reported one) — a scheduling artifact, not slow code. **Fixed.**
2. **Statistical flake** (found during verification) — the `bent / multi` assertion fails ~2.0% of
   the time on its own merits, with no timeout involved. **Not yet fixed.**
3. **`~61% bent` is wrong** — measured at **48.8%** over 4200+ boards. The flaky threshold was
   calibrated against this stale figure, which is *why* cause 2 exists.

## Cause 1 — timeout flake (fixed)

Not slow code. The suite runs ~11 forked workers on a 12-core machine, and a large share of tests
drive the *real* generators (each saturating a core), so a generator test's wall clock stretches
**2–13×** over its isolated time.

For the failing test: 14 × `generateCalcSudoku('hard', { gridSize: 6 })` needs
**157–673 ms** of actual CPU (40 idle samples, p99 673 ms) — yet was observed at **5738 ms**
in a loaded run, against Vitest's 5000 ms default.

Fixed by raising the global floor to `testTimeout: 30_000` in `vitest.config.ts` rather than
annotating one test, because the amplification is a property of *suite scheduling* and applies to
every generator-backed test. Full reasoning, the measured amplification table, and the per-test
overrides live in **`vitest.config.md`**.

Verification also surfaced a **second timeout flake the global floor could not fix**, precisely
because a per-test value overrides it: the `9×9 Extreme` test was seen at **35094 ms** against its
`30000`. Sizing it needed the generator's *distribution*, not its average:

| Tier | p50 | mean | p90 | max | max ÷ p50 |
| --- | --- | --- | --- | --- | --- |
| Expert | 152 ms | 292 ms | 795 ms | 1264 ms | 8.3× |
| Extreme | 1663 ms | 2322 ms | 5019 ms | 11635 ms | 7.0× |

(30 idle samples each.) The **means matched the docs** (`~240 ms`, `~2.3 s/board`); the tails were
undocumented, and the tail is what breaks CI. Timeouts raised: Extreme `30000 → 120_000`, Expert
and the `calc-logical-solver` T4-stuck test `30000 → 60_000`.

**Verified:** 54 full-suite runs post-fix, 387 tests each, zero timeout failures.

## Cause 2 — statistical flake (open)

Run 1 of the final verification batch failed in **1631 ms** — no timeout — on:

```text
AssertionError: expected 0.39325842696629215 to be greater than 0.4
```

Measuring all three of the test's aggregate assertions over **300 independent N=14 trials**:

| Assertion | Threshold | Mean | sd | Margin | Failure rate |
| --- | --- | --- | --- | --- | --- |
| `bent / multi` | `> 0.4` | 0.482 | 0.039 | 2.1 sd | **6/300 = 2.0%** |
| `mul / multi` | `> 0.25` | 0.380 | 0.032 | 4.1 sd | 0/300 |
| `puzzlesWithSubDiv / N` | `> 0.6` | 0.935 | 0.067 | 5.0 sd | 0/300 |

Only the bent assertion is mis-calibrated. The other two have ample margin and need no change.

## The bent-ratio divergence

`calc-sudoku.md:53` defines a bent cage exactly as the test does — "spans ≥2 rows AND columns" —
and claims `maxSize: 4` "already yields **~61%** bent naturally". Measured over 800 boards:

| Denominator | Measured |
| --- | --- |
| cages of size ≥ 2 — **what the test asserts** | **0.488** |
| cages of size ≥ 3 | 0.778 |
| all cages | 0.488 |

No denominator reproduces 61%. (Size≥2 and "all" coincide because 6×6 hard carries 0 single-cell
givens.) A 2-cell cage is always orthogonally adjacent, so it can never be bent — which is what
pulls the size≥2 figure well below the size≥3 one.

The docs' *other* two structural figures for this tier are close, though **neither is exact**:
`~39% ×` vs measured **0.380** (1 pt out) and `−/÷ in ~96% of boards` vs measured **0.935**
(2.5 pt out). Both are now carried as `~38%` / `~94%` in `calc-sudoku.md` and
`calc-sudoku.ts` — those rounded measurements are the figures to trust. What matters here is the
*relative* size of the error: 1–2.5 pt against 61-vs-48.8's **12+ pt**, which isolates 61% as the
outlier rather than a systematic drift. Most likely it was measured while the `minBentRatio` floor was still active —
the same walkthrough records that the floor was later dropped because it "halved the generation
yield for no structural gain", and dropping it would lower the natural bent rate.

Affected live text: `calc-sudoku.md:54`, `calc-sudoku.md:149`,
`Docs/archive/keisan-walkthrough.md:347`, `Docs/archive/keisan-walkthrough.md:366`.

## Root cause of the divergence (confirmed by measurement)

The initial hypothesis — that 61% was measured while the `minBentRatio` floor was active — is
**wrong**, and the source comment says so itself: it cites 61% as the *ungated natural* rate, which
is the whole argument for skipping the floor. Measuring the actual bent rate at each commit in the
chain (800 boards each, ~9500 cages, SE ≈ 0.005):

| Commit | What it did | bent/multi |
| --- | --- | --- |
| `4388b1c` | wrote the "~61%" claim | **0.527** |
| `48442c7` | operator reweight — restore `−`/`÷` variety | **0.481** |
| `080438a` | K7a 9×9 tiers | 0.483 |
| HEAD | — | 0.488 |

Two independent facts, not one:

1. **61% was never accurate.** It was 0.527 at the commit that wrote it. The 6×6 hard config is
   *byte-identical* between that commit and HEAD, so this is a mismeasurement, not drift.
2. **A real 0.527 → 0.481 shift happened at `48442c7`**, and everything after is flat within noise.

The mechanism is confirmed, not merely plausible. `−` and `÷` are **2-cell-only** operators, so
reweighting toward them shifts the cage-size mix:

| | 2-cell | 3-cell | 4-cell |
| --- | --- | --- | --- |
| `4388b1c` | 31.7% | 33.3% | 35.0% |
| HEAD | **38.6%** | 31.7% | 29.7% |

A 2-cell cage is orthogonally adjacent by definition, so it can *never* be bent. With a bent rate of
0.778 among cages of size ≥3, the mix predicts 0.778 × (1 − 0.317) = **0.531** then (measured 0.527)
and 0.778 × (1 − 0.386) = **0.478** now (measured 0.488). The mechanism fully accounts for the drift.

**This is therefore a deliberate tradeoff, not a regression** — the reweight was made specifically to
restore `−`/`÷` variety, an explicitly wanted property, and the bent cost is its arithmetic
consequence. Recalibrating the test threshold against ~0.48 is sound; it is not baking in a defect.

## Options for cause 2

The constraint is that the assertion is **real difficulty-calibration coverage** and must not be
weakened into meaninglessness.

| Option | Change | Failure rate | Cost |
| --- | --- | --- | --- |
| **A — raise N** | `N: 14 → 52` | ~4 sd, <0.01% | Runtime ×3.7: ~1645 ms isolated, but a projected **~17 s** in-suite worst — needs its own `60_000` timeout |
| **B — seed the RNG** | pass `rng: seededRng(k)` (already supported: `CalcGenPipelineOptions.rng`) | 0% (deterministic) | Free; but the test can no longer catch a distribution shift that spares that seed |
| **C — recalibrate threshold** | `0.4 → 0.36` against the *true* 0.482 mean | ~3.1 sd, ~0.1% | Free; keeps randomness, but is a threshold move |

### Resolution: option D (hybrid), from the literature

Externally-researched guidance (Dutta et al., *To Seed or Not to Seed?*, ICST 2022 — 114 projects,
461 seed-dependent tests, 500 runs each) ranks these differently from the initial recommendation:

- **Seeding (B) is the option the evidence argues against.** Fixed seeds are for tests checking
  exact reproducibility; everything else should randomize *and log the seed*. The paper documents a
  TensorNetwork test whose fixed seed was hiding a real truncation bug — unseeded, it failed 519/1000.
  The instinct recorded above ("can no longer catch a distribution shift that spares that seed") is
  precisely that failure mode.
- **Tuning the bound or the sample size (A/C) is preferred** — it fixed >78% of their selected tests.
- **`retry` is not an option.** It hides real bugs; quarantine-and-fix is the standing policy.

Adopted: **N = 28, threshold 0.39, random seed logged on failure** — the reproducibility half of B
without its fault-detection loss. It holds detection power identical to the original test while
cutting the flake rate ~45×, at half of A's runtime cost. N=28 also clears the conventional
~30-run floor for characterising a randomised algorithm (Arcuri & Briand) that N=14 sat below.

Measured empirically at N=28 rather than extrapolated from the N=14 sd (per FLEX, ESEC/FSE 2021,
which derives bounds from the empirical tail rather than assuming normality) — 400 trials:

| Threshold | Observed FPR | Gaussian prediction | Margin |
| --- | --- | --- | --- |
| `> 0.40` | 0/400 | 0.054% | 3.10 sd |
| **`> 0.39`** | **0/400** | **0.011%** | **3.48 sd** |
| `> 0.36` | 0/400 | 0.000% | 4.61 sd |

N=28: mean 0.4825, sd **0.0266** (vs 0.0276 extrapolated — extrapolation was slightly conservative,
so normality holds here), observed min over 400 trials **0.4178**.

> **⚠️ The table above was measured on the wrong RNG**, and is kept only as the historical record.
> It drove `generateCalcSudoku` off `Math.random`, whereas the shipped test draws a random seed and
> runs its 28-board sample off the **seeded LCG**. Two independent 400-trial re-runs on the *shipped*
> path:
>
> | Run | mean | sd | observed min | `> 0.40` | `> 0.39` | margin at 0.39 |
> | --- | --- | --- | --- | --- | --- | --- |
> | review pass | 0.4812 | 0.0270 | **0.3934** | ≥1 breach | 0/400 | 3.38 sd |
> | independent re-run | 0.4809 | 0.0247 | **0.4096** | **0/400** | 0/400 | 3.68 sd |
>
> **Mean and sd replicate tightly; the minimum does not** — 0.3934 vs 0.4096, a gap wider than the
> distance from either to the threshold. That is expected: the minimum of 400 draws is an extreme
> order statistic and is by far the least stable number here, which is precisely why it should not
> carry an argument on its own.
>
> **Consequence:** the review pass's inference that *"`> 0.40` would have breached at least once on
> this path"* **does not replicate** — the independent run saw 0/400 at `> 0.40`. Treat that as one
> unlucky sample, not a property of the seeded path. The decision is unaffected and arguably better
> supported: **`> 0.39` is 0/400 across both runs**, at 3.38–3.68 sd. Do not move the threshold, and
> do not cite the `> 0.40` breach as a reason for it.

For calibration: Google reports ~1.5% of all test runs across its corpus report a flaky result, with
a common practical threshold of ~2% for investigation. The 2.0% measured here sat exactly on that
line, so fixing rather than tolerating was the right call.

### A prerequisite bug: seeding was only partial

"Log the seed" is worthless if the seed doesn't reproduce the failure — and it didn't.
`CalcGenPipelineOptions.rng` was threaded into `generateCalcCageShapes` and `assignCalcCages` but
**not** into the `fillGrid` call that builds the Latin square, so that step silently fell back to
`Math.random`. Verified before the fix: same seed → different puzzle. Fixed by passing `rng`
through; now same seed → same puzzle, different seed → different puzzle.

This class of bug fails silently and only toward *more* entropy, so a test that seeds for
determinism keeps passing while quietly being randomised. **The same omission remains in
`killer-sudoku.ts` (2 sites) and `calc-generator.ts`** — meaning `calc-generator.test.ts` and
`calc-logical-solver.test.ts` pass `rng: seededRng(n)` and are *not* deterministic today. That also
explains the wide runtime spread of the `findT4StuckUnique` seed search. Left for a separate change:
making those suddenly deterministic alters which cases they cover and deserves its own review.
`sudoku.ts` threads it correctly and is the reference implementation.

## Cause 1, revisited: cap the workers, don't just raise the ceiling

The initial fix raised `testTimeout` only. That treats the symptom — Vitest defaults to ~one worker
per logical CPU minus one, which for a suite full of core-saturating generators is textbook
oversubscription. Capping the pool with **`maxWorkers: '50%'`** attacks the amplification at source.

Measured worst-observed durations, default workers (24 runs) vs capped (14 runs):

| Test | Default | `maxWorkers: '50%'` | Change |
| --- | --- | --- | --- |
| `hard leans on ×` | 4698ms | **1812ms** | −61% *(and at N=28 — double the work)* |
| killer `extreme` | 22033ms | 7382ms | −66% |
| calc `Expert` | 11492ms | 3118ms | −73% |
| strategies solve-every Extreme | 29497ms | 15107ms | −49% |
| calc `Extreme` | 18556ms | 16264ms | −12% |

**Wall-clock did not regress**: 14.9–19.4s capped vs 16–20s uncapped — fewer workers, less context
switching, same throughput. The timeouts stay sized from the measured tails as belt-and-braces, but
the cap is now the primary defence. Revisit the cap on p95 runtime and flake rate, not on intuition.

One accepted tradeoff, worth naming: a 120s timeout is a weak hang detector — a genuinely wedged
generator now costs two minutes to surface. That is accepted for Extreme specifically, whose
intrinsic tail (11635ms max) is the heaviest in the engine, and it matches the Killer precedent.
If generator tests later dominate scheduling again, the next step is a separate Vitest project for
them with its own worker cap, rather than pushing timeouts higher.

## Follow-ups from the review pass — ✅ all five resolved (2026-08-04)

Five issues were raised reviewing this change and were initially committed **unfixed**, so the record
would be honest about what had been verified against what. All five were closed in a follow-up pass
the same day; each is marked below with what was actually done. None was ever a runtime defect — the
executable code was checked and cleared (the LCG's `s * 1664525 + 1013904223` peaks at ~7.15e15,
safely under 2^53, so no precision loss; same-seed reproduction was verified empirically after the
`fillGrid` fix; and no production caller passes `rng` to `generateCalcSudoku`, so that fix is
behaviour-neutral in prod).

**A sixth issue surfaced while fixing #5** — see that entry. The review pass found the
walkthrough-vs-`calc-sudoku.md` contradiction but missed that the *same* stale `~39%` also sat in
`calc-sudoku.md:56` **and in the source comment at `calc-sudoku.ts:121`**, which this change never
touched. A contradiction between two documents is a signal to grep for every instance of the figure,
not to reconcile the two you happen to be looking at.

1. **The 0.39 threshold was validated on the wrong RNG.** The FPR table above was measured with
   `Math.random`, but the shipped test runs its 28-board sample off the seeded LCG.
   **✅ Resolved — re-derived independently rather than accepting the review pass's numbers, which
   turned out to matter.** A fresh 400-trial run on the shipped path gives mean 0.4809, sd 0.0247,
   min **0.4096**, and **0/400 at `> 0.40`**. Mean and sd replicate the review pass tightly
   (0.4812 / 0.0270); the **minimum does not** (0.3934 vs 0.4096), so its claim that `> 0.40` *would*
   have breached **does not replicate** and must not be cited. `> 0.39` is 0/400 across both runs at
   3.38–3.68 sd. Table above corrected and both runs recorded; **threshold unchanged**, as the
   original fix instruction required.
2. **`vitest.config.ts` comment contradicts its own value** — the block said "Raising the floor to
   20s" directly above `testTimeout: 30_000`, a leftover from revising 20s → 30s. A maintainer
   "correcting" the code to match would reintroduce the ~2.3× margin the same block argues against.
   **✅ Resolved** — the stale figure is gone and the paragraph now carries an explicit *do not
   correct this value down* warning, since the trap was the comment inviting the wrong edit.
3. **The timeout table in `vitest.config.md` mixes measurement conditions.** Its column read "Worst
   of 30 runs", but the `hard leans on ×` row (1812ms) is a *post*-`maxWorkers`-cap figure from a
   14-run batch while every other row is pre-cap.
   **✅ Resolved** — added an explicit **Measured under** column plus a note that the last row is not
   comparable. Also recorded the direction of the error: post-cap equivalents of the pre-cap rows
   would be *lower*, which **raises** their headroom, so every timeout derived from that table is
   conservative and none needed changing.
4. **`maxWorkers: '50%'` is justified entirely by 12-core measurements.** CI is `ubuntu-latest`
   (2–4 vCPU), where Vitest's default is already 1–3 workers — so the oversubscription the cap
   removes does not exist there, and the measured 49–73% tail reduction does not transfer.
   **✅ Resolved — measured on real CI, keep the cap.** Wall clock 27.71s capped vs 24.76s / 27.19s
   uncapped, i.e. *inside* the uncapped spread, so the CI cost is not separable from noise. That
   settles the actual objection: there is no meaningful CI penalty, so the local flake reduction is
   free. Σ test time was also lower capped (25.63s vs 30.66s / 35.79s), hinting the cap helps even on
   a small runner — but n=1 per config on different dependency trees, so that is explicitly **not**
   claimed as a result. Full table in `vitest.config.md`.
5. **`keisan-walkthrough.md` contradicts `calc-sudoku.md`.** The correction note said `~39% ×` and
   `−/÷ in ~96%` "hold up", while this same change edited those figures to 38% / 94% in the mirrored
   doc.
   **✅ Resolved, and it was a three-way contradiction, not two.** Grepping the figure rather than
   reconciling the two known documents found the same stale `~39%` in **`calc-sudoku.md:56`** and in
   the **source comment at `calc-sudoku.ts:121`**, neither touched by this change. All now read
   `~38% measured` (0.380). The walkthrough's "hold up" was also too strong — `~96%` vs 0.935 is
   2.5 pt out — so it now states the measured values and notes the argument survives anyway, since
   61-vs-48.8 is a 12 pt gap by comparison.

## Reproduction

```bash
npx vitest run src/features/engine/calc/calc-sudoku.test.ts -t "hard leans on"
```

The statistical flake needs ~50 repeats to show at 2%; the timeout flake needs full-suite
parallel load and does not reproduce in isolation at all.
