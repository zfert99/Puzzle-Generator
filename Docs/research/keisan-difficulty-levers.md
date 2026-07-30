# Keisan — Difficulty Lever Tables (per size × tier)

Companion to `kenken-difficulty-calibration.md`. This is the implementable version: every lever, every size, every tier, with a recommended value.

Scope matches the agreed plan:

- **Stage 1 (now):** 3 tiers — Easy / Medium / Hard — at 4×4, 5×5, 6×6, 7×7. Standard mode only (operators shown).
- **Stage 2 (later):** Mystery (no-op) as an orthogonal toggle, available at every size.
- **Stage 3 (later):** 9×9 Keisan with a true 5-tier ladder including Extreme.

---

## 0. The gate rule (read this before the tables)

Every number below is a **generation constraint**. None of them *decide* the difficulty. The tier is decided by the graded logical solver:

> A puzzle is tier **T** if and only if the solver solves it using techniques ≤ T **and fails to solve it** using techniques ≤ T−1.

This is Tatham's method in `keen.c` and it is the only thing that keeps tiers from bleeding into each other. The parameter tables exist to make the generator *land in band often enough* that re-rolling is cheap. If a puzzle passes the parameter constraints but grades one tier down, throw it away — don't ship it because the parameters said it should be hard.

**Re-roll order (cheapest first):** clue targets → operator assignment → cage geometry → whole solution grid.

### Technique ladder (the grading scale)

| Tier code | Techniques unlocked |
|---|---|
| **T1** | Naked singles, hidden singles, single-combination cages |
| **T2** | Cage-line reduction (pointing / claiming from a cage into a row or column) |
| **T3** | Naked & hidden pairs/triples, X-wing / basic fish |
| **T4** | Rule of N (line sum = N(N+1)/2), innies & outies, cage splitting, parity arguments |
| **T5** | Forcing chains / AIC, multi-cage combination enumeration, limited bifurcation |

---

## 1. The levers

| Lever | What it controls | Direction |
|---|---|---|
| **Single-cell cages** | Free givens; each one collapses a row + column instantly | ↓ count = ↑ difficulty. Sharpest lever there is. |
| **Max cage size** | Ceiling on cells per cage | ↑ size = ↑ combos = ↑ difficulty (and ↑ solver cost) |
| **Cage size mix** | Distribution across 2/3/4/5-cell cages | More 3+ cells = harder |
| **Bent-cage ratio** | % of multi-cell cages that span ≥2 rows *and* ≥2 columns | ↑ bent = ↑ difficulty (bent cages permit repeats → more combos) |
| **Operator palette** | Which of + − × ÷ are enabled | Adding × is a real difficulty step (factor reasoning) |
| **Operator mix** | Target distribution across enabled ops | Even mix reads better; ×-heavy is harder |
| **maxCombos (hard cap)** | No cage may admit more than N digit multisets | ↑ cap = ↑ difficulty. The core ambiguity knob. |
| **Mean combos (soft target)** | Average across all cages | Better tier discriminant than the cap alone |
| **Gift-clue ban** | Reject clues with exactly one forced combination | More bans = harder |
| **Technique ceiling** | Hardest technique the solver may use | The actual definition of the tier |
| **Technique floor** | Must NOT be solvable below this | Prevents tier bleed |
| **Bifurcation** | Is guessing permitted in the grade? | Never, in Stage 1 |

### Gift-clue bans (from `keen.c`, applies at every size and tier)

These clues are near-freebies because they admit exactly one combination. Ban level scales with tier.

| Clue pattern | Why it's a gift |
|---|---|
| 2-cell `+` with target 3 or 4 | Only 1/2 or 1/3 |
| 2-cell `+` with target 2N−1 or 2N−2 | Only the top two digits |
| 2-cell `−` with difference N−1 | Only 1 and N |
| 2-cell `÷` with quotient > N/2 | Only one factor pair fits |
| Any `×` clue with ≤2 factorizations | Effectively a given |
| Any cage where combos == 1 | Definitionally a given |

**Hard rule at every size and tier: `−` and `÷` cages are exactly 2 cells.** Order-dependence makes 3+ cell subtraction/division ill-defined. No exceptions.

---

## 2. Size tables — Standard mode, 3 tiers

Grid cell counts: 4×4 = 16, 5×5 = 25, 6×6 = 36, 7×7 = 49.

### 4×4 (digits 1–4, 16 cells)

The compressed one. There genuinely isn't enough room here for T4 logic, so "Hard" at 4×4 tops out mild. `keen.c` refuses to generate Hard at 3×3 for exactly this reason — 4×4 is one step above that.

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Single-cell cages | 2–3 (13–19%) | 1 (6%) | **0** |
| Max cage size | 2 | 3 | 4 |
| Cage size mix (2/3/4) | 90 / 10 / 0 | 60 / 40 / 0 | 45 / 40 / 15 |
| Bent-cage ratio | ≤20% | 40–60% | ≥60% |
| Operator palette | `+ − ÷` | `+ − × ÷` | `+ − × ÷` |
| Operator mix target | 50/30/20 | ~even | ×-weighted (≥30%) |
| maxCombos (cap) | 3 | 5 | 8 |
| Mean combos target | ~1.8 | ~3.0 | ~4.5 |
| Gift-clue bans | combos==1 only | + all 2-cell patterns | + `×` with ≤2 factorizations |
| Technique ceiling | T1 | T2 | T3 |
| Technique floor (must need) | — | > T1 | > T2 |
| Bifurcation | No | No | No |
| Target solve time | 30–60 s | 1.5–3 min | 3–6 min |

> **Recommendation:** accept that 4×4 Hard is "spicy warm-up," not hard. Don't try to force it — the alternative is generating degenerate puzzles or letting bifurcation in. If the band feels too compressed in playtest, drop 4×4 to two tiers (Easy/Hard) rather than shipping three that feel identical.

### 5×5 (digits 1–5, 25 cells)

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Single-cell cages | 4 (16%) | 1–2 (4–8%) | **0** |
| Max cage size | 2 | 3 | 4 |
| Cage size mix (2/3/4/5) | 85 / 15 / 0 / 0 | 58 / 38 / 4 / 0 | 44 / 40 / 15 / 1 |
| Bent-cage ratio | ≤25% | 45–60% | ≥65% |
| Operator palette | `+ − ÷` | `+ − × ÷` | `+ − × ÷` |
| Operator mix target | 50/30/20 | ~even | ×-weighted (≥30%) |
| maxCombos (cap) | 4 | 7 | 11 |
| Mean combos target | ~2.0 | ~3.6 | ~5.5 |
| Gift-clue bans | combos==1 only | + all 2-cell patterns | + `×` with ≤2 factorizations |
| Technique ceiling | T1 | T3 | T4 |
| Technique floor (must need) | — | > T1 | > T3 |
| Bifurcation | No | No | No |
| Target solve time | 1–2 min | 4–7 min | 8–14 min |

### 6×6 (digits 1–6, 36 cells)

Your flagship size — this is where the 3-tier ladder has the most room to separate cleanly. Calibrate here first.

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Single-cell cages | 4–5 (11–14%) | 1–2 (3–6%) | **0** |
| Max cage size | 3 | 3 | 4 |
| Cage size mix (2/3/4/5) | 80 / 18 / 2 / 0 | 55 / 38 / 7 / 0 | 42 / 40 / 16 / 2 |
| Bent-cage ratio | ≤25% | 50–65% | ≥70% |
| Operator palette | `+ − ÷` | `+ − × ÷` | `+ − × ÷` |
| Operator mix target | 50/30/20 | ~even | ×-weighted (≥30%) |
| maxCombos (cap) | 6 | 10 | 15 |
| Mean combos target | ~2.4 | ~4.5 | ~7.0 |
| Gift-clue bans | combos==1 only | + all 2-cell patterns | + `×` with ≤2 factorizations |
| Technique ceiling | T1 | T3 | T4 |
| Technique floor (must need) | — | > T1 | > T3 |
| Bifurcation | No | No | No |
| Target solve time | 3–5 min | 8–14 min | 18–30 min |

### 7×7 (digits 1–7, 49 cells)

Prime size — no box constraint means this works where Sudoku can't. It's also where generation cost starts to bite, so watch the uniqueness-check budget.

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Single-cell cages | 5–6 (10–12%) | 2–3 (4–6%) | **0–1** |
| Max cage size | 3 | 4 | 4 |
| Cage size mix (2/3/4/5) | 72 / 25 / 3 / 0 | 50 / 38 / 11 / 1 | 40 / 40 / 18 / 2 |
| Bent-cage ratio | ≤30% | 50–65% | ≥70% |
| Operator palette | `+ − ÷` | `+ − × ÷` | `+ − × ÷` |
| Operator mix target | 50/30/20 | ~even | ×-weighted (≥30%) |
| maxCombos (cap) | 8 | 13 | 19 |
| Mean combos target | ~2.8 | ~5.2 | ~8.5 |
| Gift-clue bans | combos==1 only | + all 2-cell patterns | + `×` with ≤2 factorizations |
| Technique ceiling | T1–T2 | T3 | T4 |
| Technique floor (must need) | — | > T2 | > T3 |
| Bifurcation | No | No | No |
| Target solve time | 6–10 min | 14–24 min | 28–45 min |

---

## 3. Mystery (no-op) — Stage 2

Mystery is a **modifier applied on top of a size × tier**, not a tier of its own. The operator is hidden; the solver must deduce it alongside the digits.

### Why it needs its own slice

1. **Uniqueness gets more expensive.** You must verify no *other* (operator, multiset) pairing also satisfies every clue. This multiplies solver work by roughly the number of plausible operator interpretations per cage.
2. **Gradability changes.** Operator deduction is its own technique class and has to be slotted into the T1–T5 ladder before you can grade a Mystery puzzle at all.
3. **Ambiguity traps.** A cage like `6` on two cells is satisfiable as `2×3`, `1+5`, `2+4`, and more — Mystery puzzles fail uniqueness far more often, so generation success rate drops and you need a retry budget.

### Recommended technique insertion

| Tier code | Mystery addition |
|---|---|
| T1 | Cages where only one operator is arithmetically possible |
| T2 | Operator elimination via row/column digit availability |
| T3+ | Joint operator + digit subset reasoning |

### Mystery deltas (apply to the Standard table for that size × tier)

| Lever | Delta | Reason |
|---|---|---|
| Single-cell cages | **+1** | Mystery is already a big difficulty jump; buy some back |
| Max cage size | **−1** | Combination space is already multiplied by operator ambiguity |
| maxCombos (cap) | **×0.6** | Combos are now counted *across all operator interpretations* |
| Bent-cage ratio | **−15pp** | Bent + hidden operator compounds too aggressively |
| Operator palette | unchanged | All four stay live — that's the point |
| Gift-clue bans | **relax the 2-cell patterns** | Those clues aren't gifts when the operator is hidden |
| Effective difficulty | roughly **+1 tier** | A Mystery Medium plays close to a Standard Hard |
| Generation retry budget | **×3** | Expect substantially more uniqueness failures |

### Surfacing recommendation

Ship Mystery as a **toggle on the puzzle picker**, orthogonal to size and difficulty — not as a fourth tier and not as a 9×9-only feature. It works at every size, and a 4×4 Mystery is a genuinely good on-ramp for teaching the concept (small enough to brute-force mentally, which is how players learn what the toggle means).

**Gate for the Mystery slice:** ≥90% generation success within the retry budget, 100% uniqueness, and grading reproducible across two independent runs of the solver.

---

## 4. 9×9 Keisan — Stage 3, full 5-tier ladder

81 cells. This is where the ladder has enough room for Expert and Extreme to mean something.

> **⚠️ Measured-reality correction (2026-07 de-risk).** The table below was a *pre-measurement*
> starting point, and a 9×9 de-risk overturned three of its core assumptions. Read
> [keisan-9x9-feasibility-findings.md](keisan-9x9-feasibility-findings.md) and the
> [9×9 honest-ladder research](keisan-9x9-honest-ladder.md)
> before using these numbers. What changed:
>
> - **Max cage size stays 3, all tiers — not 3→5.** maxSize-5 cages are infeasible (verify ~50×
>   slower, 3% unique, **0%** gradable); maxSize-4 costs ~13× verify for negligible difficulty gain.
>   Real 9×9 Calcudoku is 2–3-cell-cage dominated. So the "Max cage size" and "Cage size mix" rows
>   are wrong — hold at maxSize 3 everywhere.
> - **The "Technique ceiling" row (T3/T4/T5) does not hold.** Our T1–T4 solver caps at **~T2** on
>   9×9 in practice; T3/T4 essentially never fire. Named tiers come from **givens + score band**, not
>   a technique ladder.
> - **"T5" = bounded recursion, and it discriminates *all* the hard tiers, not just Extreme.** The
>   honest top-end axis is counted guess-and-check depth (the `keen.c` `EXTREME`/`UNREASONABLE`
>   transplant — those tiers have `NULL` technique functions). So the "Bifurcation: No / …/ Bounded
>   only" row is inverted: bounded recursion is the *mechanism* the top tiers are built on, gated by
>   depth (provisionally depth-1 = Nishio, depth-2 = Extreme — **verify depth-2 is human-reproducible
>   before committing, else keep 4 tiers**).
>
> Net: the ladder is **givens count → score band → bounded-recursion depth**, all at maxSize 3.
> Treat the single-cell-cage counts and combo caps below as still-useful starting shape; ignore the
> max-cage-size, cage-size-mix, technique-ceiling, and bifurcation rows. See the re-sliced K7a/K7b/K7c
> in [kenken-implementation-plan.md](../kenken-implementation-plan.md).

| Lever | Easy | Medium | Hard | Expert | Extreme |
|---|---|---|---|---|---|
| Single-cell cages | 6–9 (7–11%) | 3–5 (4–6%) | 1–2 (1–2%) | 0–1 | **0** |
| Max cage size | 3 | 4 | 4 | 5 | 5 |
| Cage size mix (2/3/4/5) | 65 / 30 / 5 / 0 | 50 / 38 / 11 / 1 | 42 / 40 / 16 / 2 | 38 / 38 / 20 / 4 | 34 / 36 / 24 / 6 |
| Bent-cage ratio | ≤30% | 45–60% | ≥65% | ≥70% | ≥75% |
| Operator palette | `+ − ÷` | `+ − × ÷` | `+ − × ÷` | `+ − × ÷` | `+ − × ÷` |
| Operator mix target | 50/30/20 | ~even | ×-weighted | ×-weighted (≥35%) | ×-weighted (≥40%) |
| maxCombos (cap) | 10 | 14 | 20 | 28 | 36 |
| Mean combos target | ~3.2 | ~5.5 | ~8.5 | ~12 | ~16 |
| Technique ceiling | T1–T2 | T3 | T3–T4 | T4 | T5 |
| Technique floor | — | > T2 | > T3 | > T3 (+ chains helpful) | > T4 |
| Bifurcation | No | No | No | No | Bounded only (≤2 levels) |
| Target solve time | 12–20 min | 20–35 min | 35–55 min | 55–80 min | 80+ min |

**On Extreme + Mystery.** Mystery *can* be part of what makes a 9×9 brutal, and 9×9 Mystery Extreme is probably the single hardest thing you'll ever ship. But keep it as the toggle, not as a baked-in property of the Extreme tier — otherwise Extreme stops being reachable for players who bounce off Mystery, and you lose a difficulty rung.

**Generation cost warning.** 9×9 Extreme with 5-cell cages and maxCombos 36 is where the uniqueness check gets slow. If a single puzzle takes more than ~2 s to generate-and-grade, pull `maxCombos` and max cage size down before you start optimizing the solver — the parameters are almost always the problem, not the algorithm.

---

## 5. Cross-size normalization

Tiers are **normalized within each size**, not across sizes. A 7×7 Easy takes longer in wall-clock time than a 4×4 Hard, and that's correct and intentional.

- "Hard" means *the hard end of this size* — the hardest logic this grid can sustain without guessing.
- Size is the coarse outer ladder; tier is the fine inner one.
- Surface **both** in the UI. `6×6 · Hard` is the unit, never just `Hard`.

This matches how kenkenpuzzle.com and calcudoku.org actually work, and it's the only version that doesn't produce misleading labels.

**Do not** try to make "Hard" an absolute cross-size constant. It sounds tidier but it means either 4×4 Hard is impossible to generate or 9×9 Hard is trivially easy, and you'll end up with dead tiers at both ends of the size range.

---

## 6. Implementation order

| Step | What | Gate |
|---|---|---|
| **1** | Wire the parameter tables in as per-(size, tier) config. Nothing else changes. | Config loads, generator respects every constraint |
| **2** | Implement the graded logical solver through **T4**. T5 can wait until 9×9. | Reproduces `keen.c` Easy/Normal/Hard classification on imported keen puzzle IDs |
| **3** | Add the tier gate (solve at T, confirm failure at T−1) and the re-roll loop. | ≥95% of generated puzzles land in band; median generation <200 ms at 6×6 |
| **4** | Calibrate at **6×6 first**, then port the shape to 5×5 and 7×7, then 4×4 last. | Solve-time distributions separate cleanly between adjacent tiers |
| **5** | Instrument real solve times and abandonment. Recalibrate the tables from telemetry. | Solve-rate curve is monotonic across tiers within each size |
| **7a** | 3-tier 9×9 (Easy/Medium/Hard), maxSize 3, givens + score band. No new engine. | ≥95% Hard gradable by T1–T4; interactive p95 < 250 ms; bands disjoint |
| **7b** | Bounded-recursion "T5" (keen.c transplant): counted guess-depth; instrument intermediate-technique firing rates. | ≥90% of 0-given maxSize-3 boards get a bounded rating (depth ≤ 2); depth-band monotonic vs solve-time proxy |
| **7c** | 5-tier 9×9: Expert/Extreme via score band + guess-depth, generated offline into the daily-cron pool. | Pool buffer ≥ N days; per-tier leaderboard variance under threshold |
| **8** | Mystery / No-Op slice (own uniqueness + gradability gates, see §3) — after 9×9 so it lands on the finished tiers. | ≥90% generation success, 100% uniqueness |

> **Order note:** steps 7a–7c (9×9) now come **before** the Mystery slice (was step 6 → now step 8),
> so No-Op lands on top of the completed 9×9 ladder rather than being redone when those tiers arrive.
> The original step-7 gate ("Extreme requires T5; generation under 2 s") was written against a
> hand-coded T5 that doesn't exist — superseded by the 7a/7b/7c gates above.

---

## 7. Where these numbers came from

- **Sourced from primary code/sites:** the `−`/`÷` 2-cell rule, the gift-clue patterns, max-cage-size ceiling of 5–6, the tier-gate method (all from Tatham's `keen.c`); the maxCombos / min-max-singles concept (KSudoku `cagegenerator.h`); the technique ladder shape (billabob's KenKen grader).
- **Reasoned recommendation, not published fact:** every specific number in the tables — the singles counts, size mixes, bent-cage ratios, combo caps, mean-combo targets, and solve times. No source publishes per-(size, tier) tables. These are a calibrated starting point, and Step 5 above exists precisely to replace them with your own telemetry.
- **Most likely to need adjustment:** the mean-combos targets (they're the least grounded and the most sensitive), and the 4×4 Hard band (which may simply not be achievable as specified).
