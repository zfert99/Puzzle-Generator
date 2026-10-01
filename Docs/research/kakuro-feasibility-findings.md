# Kakuro Generation Feasibility — Measured Findings (E3 yield spike)

Findings from the Kakuro plan's **E3** slice: measure generation yield *before* writing the
generator (the K7 lesson — see
[keisan-9x9-feasibility-findings.md](keisan-9x9-feasibility-findings.md)). Plan:
[kakuro-implementation-plan.md](../kakuro-implementation-plan.md); decisions and the running
numbers: [kakuro-log.md](../kakuro-log.md). Measured 2026-10-01 against `main` at `132e24a`
(exact solver E1, logical solver E2a/E2b with chain tiers).

**TL;DR:** The research's headline warning is confirmed and, at the same time, defused.
**Random fills of a legal layout are essentially never unique** — 2 of 2,000 across every
size and density tried — so a "fill, verify, retry" generator would never finish. But a
**one-cell-at-a-time repair** of a random fill toward uniqueness (keep a mutation if the
solution count does not rise) reaches a unique puzzle in **milliseconds at 6×6/7×7, tens to
hundreds of milliseconds at 9×9**, well inside the plan's gates — provided the layout is dense
enough. **Black-cell density is the lever**, exactly as the research said, with a floor around
35% at 9×9 below which repair starts failing and the accepted puzzles turn extreme-or-unrated.
The **6×6 carries a real Hard tail** (and expert/extreme, with chains), which answers G6: the
mini is **6×6**. Every size needs a *difficulty-targeting* search, not a yield fix: the natural
tier distribution of unique fills is bottom-heavy on hard/extreme, so easy and medium are the
ones a generator must search *for*.

---

## 1. Method

A throwaway script in the session scratchpad (not committed — see §6 to reproduce). For each
size × target black density:

1. **Layouts.** 20 random 180°-symmetric layouts: start all-white, place black cells in
   symmetric pairs at random positions, accepting a placement only if no white cell is left
   without an across or down run; break any run longer than 9 the same way; the real
   `validateKakuroLayout` (connectivity, critical rectangles, Mathimagics' bounds) has the last
   word. Not the plan's edges-inward method — a stand-in good enough to measure fills on.
2. **Random fills.** 200 fills per config (10 per layout): a randomised DFS with per-run
   all-different, clues derived from the fill, then `countKakuroSolutions` (limit 2, 20k-node
   budget) → **P(unique)** and **verify time**.
3. **Repair.** 20 random fills per config hill-climbed toward uniqueness: mutate one cell to a
   digit legal in both its runs, keep it if the solution count (capped at 50) does not rise,
   stop at 1 or after a step cap (3,000 at 6/7, 4,000 at 9/13). Wall-clock per attempt; success
   rate; and for each accepted puzzle the classifier's **tier** and Mathimagics' `fixed` /
   `rating` (`classifyKakuro(…, { metrics: true })`).

Single-threaded on the dev machine (Node 24, `tsx`). Absolute times are indicative; the
ratios between rows are the signal.

---

## 2. Results

### 2a. Mini candidates — 6×6 and 7×7

| size | black | random fills unique | verify avg | repair ok | repair median / max | tiers of accepted (e/m/h/x/X/unrated) | `fixed` med | `rating` med / max |
|---|---|---|---|---|---|---|---|---|
| 6×6 | 39% | 0 / 200 | 0.10 ms | 19 / 20 | 10 ms / 122 ms | 1 / 5 / 6 / 4 / 3 / 0 | 5 | 3.36 / 5.00 |
| 6×6 | 44% | 1 / 200 | 0.07 ms | 20 / 20 | 3 ms / 10 ms | 1 / 5 / 11 / 0 / 3 / 0 | 4 | 3.55 / 4.85 |
| 7×7 | 32% | 1 / 200 | 0.13 ms | 18 / 20 | 20 ms / 1.3 s | 0 / 1 / 8 / 1 / 6 / 2 | 6 | 3.76 / 4.45 |
| 7×7 | 37% | 0 / 200 | 0.16 ms | 19 / 20 | 24 ms / 1.6 s | 0 / 2 / 7 / 3 / 7 / 0 | 4 | 3.23 / 4.74 |
| 7×7 | 41% | 0 / 200 | 0.17 ms | 20 / 20 | 5 ms / 1.5 s | 0 / 0 / 8 / 2 / 10 / 0 | 6 | 3.41 / 4.58 |

(e = easy, m = medium, h = hard, x = expert, X = extreme; "unrated" = needs a chain longer than
the tier-5 ceiling of 12.) The 6×6 bounds table allows at most 24 whites, i.e. **black ≥ 33%**;
a 28% target produced no legal 6×6 layout at all.

### 2b. Standard — 9×9

| black | random fills unique | verify avg | repair ok | repair median / max | tiers of accepted (e/m/h/x/X/unrated) | `fixed` med | `rating` med / max |
|---|---|---|---|---|---|---|---|
| 29% | 0 / 200 (6 budget-outs) | 7.4 ms | **9 / 20** | 498 ms / 3.2 s | 0 / 0 / 1 / 0 / 4 / **4** | 6 | 4.19 / 5.40 |
| 37% | 0 / 200 | 2.9 ms | 13 / 20 | 167 ms / 5.2 s | 0 / 1 / 4 / 3 / 5 / 0 | 7 | 3.27 / 4.55 |
| 34%† | 0 / 200 | 0.55 ms | 18 / 20 | 64 ms / 538 ms | 0 / 1 / 7 / 2 / 7 / 1 | 6 | 3.66 / 5.06 |

† Target was 44%: the stand-in layout generator saturates near 34% at 9×9 (a black pair is
only placed where it strands no white cell, and past a point every candidate does). The row is
a second sample at mid density, not a high-density one — the real generator (E4, edges-inward)
will need to reach 40%+ to see that regime.

### 2c. Large — 13×13

| black | random fills unique | verify avg | repair ok (60 s cap) | repair median | tiers of accepted | `fixed` | `rating` |
|---|---|---|---|---|---|---|---|
| 33% | 0 / 100 (**43 budget-outs**) | 90 ms | **0 / 3** | — (all three hit the cap) | — | — | — |
| 39% | 0 / 100 (19 budget-outs) | 46 ms | **1 / 3** | 32 s (6,283 steps) | X 1 | 27 | 2.75 |

Six layouts per row, 100 fills, three repair attempts each (the unbounded first attempt — 4,000
steps, no time cap — was still running after 52 minutes and was stopped). At 13×13 the cost
model changes: a random fill has so many solutions that the counter hits its node budget
(43% of fills at 33%, each ~90 ms), and the repair loop pays that on *every* step — 6,283
steps × ~5 ms for the one success. The 13×13 is where "count solutions" stops being a cheap
objective.

---

## 3. What this means

### 3a. Fill-and-retry is dead; repair is the generator

P(unique) for a random fill is **≈ 0.1%** everywhere (2 of 2,000). A generator that fills and
verifies would need ~1,000 fills per puzzle at 6×6 and effectively never finish at 9×9 (the
nine budget-outs at 29% are fills with so many solutions the 20k-node counter gave up). The
repair loop turns that into a search that *converges*: at 6×6/7×7 nearly every attempt reaches
a unique fill in ≤ 115 steps (median), i.e. milliseconds. **E4's fill stage must be
"fill, then repair toward uniqueness", not "fill and retry"** — the plan's L7, now with numbers.

### 3b. Density is the lever, with a floor near 35% at 9×9

Every 9×9 column improves with density: repair success 45% → 90%, median repair 0.5 s → 64 ms,
"unrated" accepted puzzles 4 → 1, verify time 7.4 → 0.55 ms. At 29% the repair *fails more often
than it succeeds* and what it accepts is extreme-or-beyond. The gate's "< 1 s average per
accepted 9×9" holds at 34–37% (≈ 0.1–0.4 s including failed attempts) and fails at 29%
(≈ 5 s). **E4 should bias 9×9 layouts to ≥ 35% black and treat lower density as an explicit
"harder" knob, not a default.** Note Mathimagics' bound (≤ 59 whites = ≥ 27% black at 9×9) is a
*uniqueness-possible* floor, not a *uniqueness-cheap* one.

### 3c. The natural distribution is bottom-heavy — easy and medium must be searched for

Across every config the accepted puzzles are mostly **hard / expert / extreme**; easy appears
only at 6×6 (1 in 20) and medium is rare everywhere. This is the flip side of 3a: the
mutations that make a fill unique are the ones that make it *tight*, and tight is hard. So
E5's difficulty bias cannot be "generate and filter" for the lower tiers — it needs the same
repair loop with **the classifier in the objective** ("unique AND finishable at tier ≤ N"),
which is exactly how the served fixtures were found (0.5–2.4 s per 7×7 tier, 11–90 s per 9×9
tier with the slower E2a-era scorer). Expert and extreme, by contrast, come for free.

### 3d. G6 answered: the mini is 6×6

6×6 produces every tier — hard 6–11 of 20, and with the chain tiers even expert (4) and extreme
(3) at 39% black — with repair at **3–10 ms**. The research's "hard 6×6 verges on T&E" was
written without chain tiers; with them, hard and beyond are logic-only here too. 7×7 is not
*needed* for an honest ladder, and 6×6 plays faster (24 vs 32 cells). **D6′: mini = 6×6**,
standard = 9×9, large = 13×13 on paper (deferred — §3f). The two served 7×7 layouts stay as fixtures and
can stay as a size on `/play`; the daily's mini slot takes 6×6 (R1).

### 3e. The tier-5 ceiling is real

"Unrated" accepted puzzles (needing a chain longer than 12) appear at 7×7 (2 of 18 at 32%) and
9×9 (4 of 9 at 29%, 1 of 18 at 34%). They are unique and logic-solvable in principle, just
beyond the current bound. E5 must either raise `CHAIN_TIER5_MAX_LENGTH`, add g-whips/surface
sums as accelerators, or reject them — and a generator that targets easy–hard will simply not
produce them. Recorded for E5's calibration; not a blocker.

---

### 3f. 13×13 needs a different objective, not a faster loop

At 13×13 a random fill's solution count is astronomical, so "count up to 50 solutions" — the
repair loop's objective — costs the whole node budget on almost every step, and the climb
needs thousands of steps. The one success took 32 s; the plan's cron budget is 5 s. Nothing
about the puzzles themselves is wrong (the accepted one is a clean extreme, `rating` 2.75,
`fixed` 27 of 103) — the *search* is. Options for a later slice, not E4: a cheaper objective
(count only up to 2–5 solutions with a small node budget, and climb on "budget exhausted →
fewer nodes to the second solution" instead), seeding from a curated template library, or
repairing region by region. **D6′'s large size stays 13×13 on paper and ships nothing until one
of those is measured** — the daily never needed it (R1 is 6×6 + 9×9), and `/play` and the PDF
can wait.

## 4. Gates (plan E3)

| Gate | Result |
|---|---|
| Unique 9×9 in < 1 s average, naive templates | **Pass at ≥ 34% black** (≈ 0.1–0.4 s per accepted incl. failures); fail at 29% (≈ 5 s) |
| Mini in < 200 ms | **Pass** — 6×6 3–10 ms, 7×7 5–24 ms median |
| 13×13 inside a cron budget (< 5 s) | **Fail** — 0/3 repairs at 33% in 60 s; 1/3 at 39%, in 32 s. The large size is **deferred** (the plan: a slow 13×13 defers, it does not block); see §3f |

No re-slice needed for the mini and the standard: E4 proceeds at 6×6 / 7×7 / 9×9 with 3a–3c as
its design inputs. The large size is deferred to its own measurement (3f), not built in E4.

---

## 5. Open questions for E4/E5

1. **Layout density at 9×9 above ~35%** was not reachable with the stand-in generator; the
   edges-inward method (E4) should be measured at 40–45% to see whether yield keeps improving
   or the puzzles get trivial.
2. **Repair step cap vs. restarts.** Failed repairs ran to the cap (3–5 s at 9×9). Restarting
   from a fresh fill after ~500 fruitless steps may beat a long climb; untested.
3. **Classifier in the objective** (3c): the measured cost per tier-targeted 7×7 was seconds
   with the E2a scorer; re-measure with E2b's faster engine when E5 builds it.
4. **Ceiling** (3e): raise the chain bound, or add accelerators, or reject — E5's call once a
   distribution exists.
5. **13×13 objective** (3f): a repair objective that does not count solutions — or a template
   library — measured on its own before the large size is promised anywhere.

---

## 6. Reproducing

The measurement was a one-off script (not committed). To regenerate: build a symmetric layout
(random black pairs, rejecting any placement that leaves a white cell without a run, breaking
runs longer than 9, validating with `validateKakuroLayout`); fill with a randomised DFS under
per-run all-different; `deriveRuns` the fill; time `countKakuroSolutions({ gridSize, runs },
{ limit: 2, nodeBudget: 20000 })` for P(unique); then hill-climb the fill (one-cell mutations,
accept if `countKakuroSolutions(…, { limit: 50 }).solutions` does not rise) and grade the
result with `classifyKakuro(shape, { metrics: true })`. 200 fills and 20 repairs per
size × density; 100 and 6 at 13×13.
