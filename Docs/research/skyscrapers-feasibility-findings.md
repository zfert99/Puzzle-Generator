# Skyscrapers Generation Feasibility — Measured Findings (E3 yield spike)

Findings from the Skyscrapers plan's **E3** slice: measure generation yield *before* writing the
generator (the K7 lesson — see
[keisan-9x9-feasibility-findings.md](keisan-9x9-feasibility-findings.md) and the Kakuro
counterpart [kakuro-feasibility-findings.md](kakuro-feasibility-findings.md)). Plan:
[skyscrapers-implementation-plan.md](../skyscrapers-implementation-plan.md); decisions and the
running numbers: [skyscrapers-log.md](../skyscrapers-log.md). Measured 2026-10-02 against `main`
at `226a7fa` (exact solver E1, logical solver + classifier E2 as merged in #133).

**TL;DR:** The sizes hold — **mini 5×5, standard 6×6, large 7×7** — and the generator design
holds: *fill, repair toward uniqueness by intercalate swaps, remove clues*. Repair is
sub-millisecond at 5×5, ~4 ms median at 6×6, and at 7×7 converges only with a **restart policy**
(a fresh square after ~40 fruitless swaps: 30/30 in a median 180 ms, versus 24/50 for the plain
climb). **9×9 is out as a live size**: the capped-count objective never converged in eight
60-second attempts and a single classify costs 130–470 ms. The hard finding is about the
**ladder, not the puzzles**: under the E2 tiering, a random unique square needs tier 3 (line
filtering) *even with all 4N clues present* — 273 of 300 at 6×6, 260 of 300 at 5×5 — so
clue removal can never produce an easy or medium 6×6 (**1 and 2 of 300**), and hard/extreme
are all that comes out. The line-filter steps those squares need are mostly tiny scans (1–6
surviving arrangements of the line), i.e. what every published "easy" Skyscrapers asks a
player to do by hand. **Re-tier line filtering by how many arrangements it scans before E4**
(a ≤ 6-survivor scan as medium, ≤ 3 as easy, say) and easy/medium exist at 22% / 56% of
squares at 6×6 instead of 0.3% / 0.7%; the numbers for the cut are in §3c. The plan's gate
said "if expert/extreme are not populated, stop and re-slice" — they are populated; it is the
*bottom* of the ladder that needs the re-slice, and the fix is a calibration, not a new engine.

---

## 1. Method

Throwaway scripts in the session scratchpad (not committed — §6 to reproduce). For each size
N ∈ {4, 5, 6, 7, 9}:

1. **Random squares.** `fillGrid` on the boxless config (a randomised backtracking Latin fill).
2. **Repair (a).** All 4N clues derived; if the square is not unique, random **intercalate
   swaps** (a 2×2 sub-square `a b / b a` → `b a / a b`, which preserves the Latin property),
   each kept when `countSkyscrapersSolutions(…, { limit: cap })` does not rise (cap 60; 20 at
   9×9); stop at 1 solution, a step cap (2,000; 300 at 9×9) or a wall-clock cap (20 s; 60 s at
   9×9). 50 attempts per size (8 at 9×9). A second script adds a **restart policy** at 7×7.
3. **Verify and classify wall time (d)** on the repaired squares with all clues.
4. **Clue survival (b, e).** Greedy uniqueness-preserving removal in random order over 200
   repaired squares per size: how many of the 4N clues survive, and the E2 tier of the result.
5. **Tier reachability (c).** Tier-bounded removal toward each target tier T1–T5 (keep a removal
   only if the puzzle stays unique **and** the ladder finishes it at ≤ the target; 1s and Ns are
   removed last for T1–T2 and first for T3+), 40 attempts per (size, tier): yield, wall-clock
   per attempt and per accepted puzzle, clues kept.
6. **All-clue tier floor (f).** The classifier's tier of a repaired square *with every clue
   present*, over 300 squares at 5×5 and 6×6 (200 at 7×7) — a floor no removal can lower.
7. **Line-filter survivor counts.** For each `lineFilter` step the ladder takes on an all-clue
   unique square, the number of arrangements of that line still consistent with the candidates
   just before the step — the size of the scan a player would do.

Single-threaded, Node 24, `tsx`, with three to four spike processes sharing the machine, so
absolute times are indicative (10–30% pessimistic); the ratios are the signal. Guess count is
0 throughout by construction: the ladder has no guessing tier (D6).

---

## 2. Results

### 2a. Repair toward all-clue uniqueness (a) and wall time (d)

| size | already unique | repair ok | swaps med / max | ms med / mean / max | initial count med (cap) | verify ms med | classify ms med / max |
|---|---|---|---|---|---|---|---|
| 4×4 | 37 / 50 | 48 / 50 | 0 / 8 | 0.1 / 7.7 / 199 | 1 (60) | 0.04 | 0.55 / 4.3 |
| 5×5 | 17 / 50 | 47 / 50 | 1 / 33 | 0.2 / 0.5 / 2 | 2 (60) | 0.06 | 0.48 / 1.2 |
| 6×6 | 4 / 50 | 43 / 50 | 11 / 188 | 3.6 / 70 / 735 | 6 (60) | 0.15 | 3.5 / 14 |
| 7×7 | 0 / 50 | **24 / 50** | 69 / 208 | 98 / **1,852** / 8,202 | **60 = cap** | 0.41 | 4.8 / 36 |
| 9×9 | 0 / 8 | **0 / 8** | — | — / 29,458 / 43,689 | **20 = cap** | 60–100 | 130–470 (→ unrated) |

"Already unique" replicates V1's G4 numbers (74% / 34% / 8% / 0% / 0%). The 7×7 plain climb
fails half the time: a random 7×7 starts at or above the count cap, so the objective is flat
("60 → 60") and the climb wanders. The failed attempts are what drive the mean to 1.9 s.

**7×7 with a restart policy** (fresh square after R fruitless swaps; 30 runs each, 30 s cap):

| restart after | count cap | ok | ms med / mean / max | restarts med | swaps med |
|---|---|---|---|---|---|
| 60 | 60 | 30 / 30 | 274 / 466 / 2,371 | 1 | 191 |
| 30 | 60 | 30 / 30 | 301 / 309 / 901 | 3 | 166 |
| **40** | **20** | **30 / 30** | **178 / 203 / 722** | 2 | 164 |

A small cap and an early restart beat a long climb: the cap is only there to give the climb a
gradient, and most of a 7×7's progress happens in its first 40 swaps or not at all.

**9×9:** eight attempts, none converged within 300 swaps / 60 s; every square sat at the cap
of 20 for the whole climb, and each count costs 60–100 ms (the all-clue 2-solution count on a
random 9×9: 60–100 ms, 16–39 nodes; the table build 135–205 ms once). Classifying a random
all-clue 9×9 takes 130–470 ms and every one came back `unrated`.

### 2b. Clue survival (b) and the minimum surviving count (e)

Greedy uniqueness-preserving removal in random order, 200 repaired squares per size:

| size | 4N | kept med / min / max | kept histogram | ms med | E2 tier of the result (T1 / T2 / T3 / T4 / T5 / unrated) | N − 1 |
|---|---|---|---|---|---|---|
| 4×4 | 16 | 4 / **3** / 6 | 3: 37 · 4: 91 · 5: 68 · 6: 4 | 0.8 | 9 / 42 / 130 / 0 / 18 / 1 | 3 |
| 5×5 | 20 | 7 / **4** / 10 | 4: 1 · 5: 14 · 6: 41 · 7: 69 · 8: 51 · 9: 20 · 10: 4 | 2.2 | 0 / 0 / 124 / 1 / 71 / 4 | 4 |
| 6×6 | 24 | 11 / 7 / 14 | 7: 2 · 8: 12 · 9: 29 · 10: 50 · 11: 56 · 12: 33 · 13: 12 · 14: 6 | 8.3 | 0 / 0 / 63 / 7 / 116 / 14 | 5 |
| 7×7 | 28 | 14 / 11 / 18 | 11: 4 · 12: 19 · 13: 48 · 14: 39 · 15: 47 · 16: 23 · 17: 15 · 18: 5 | 41 | 0 / 0 / 48 / 8 / 113 / 31 | 6 |

Roughly **half the clues survive** random removal at every size (4/16, 7/20, 11/24, 14/28). The
minimum observed hits Nakamura's **N − 1 floor exactly at 4×4 and 5×5** (3 and 4 clues; the
G5 measurement, now at 5×5 too) and sits two above it at 6×6 and 7×7 after 200 tries. What
survives is **hard or extreme**: greedy removal to the uniqueness floor produces no easy or
medium puzzle at 5×5 or above, and 7% / 15% of 6×6 / 7×7 results are beyond the ladder
(`unrated` — unique, but needing more than a 200-step forcing chain over 2–3 candidates).

### 2c. Tier reachability (c) — tier-bounded removal, 40 attempts per cell

Yield = accepted exactly at the target; `ms/acc` = total wall-clock divided by accepted puzzles.

| size | T1 easy | T2 medium | T3 hard | T4 expert | T5 extreme |
|---|---|---|---|---|---|
| 4×4 | 25% · 18 ms/acc | 40% · 8 ms | 88% · 4 ms | **0%** | 23% · 17 ms |
| 5×5 | 3% · 383 ms/acc | 8% · 125 ms | 100% · 9 ms | 10% · 113 ms | 38% · 26 ms |
| 6×6 | **0%** | **0%** | 85% · 35 ms | 10% · 274 ms | 73% · 66 ms |
| 7×7 | **0%** | **0%** | 88% · 122 ms | 15% · 749 ms | 65% · 295 ms |

Where a target was missed the attempt landed on a *higher* tier: at 6×6 every T1 and T2 attempt
landed on T3 (34) or T5 (6) — the all-clue square was already hard before any clue came off.

### 2d. The all-clue tier floor (f) and a larger easy/medium sample

The tier a repaired square needs **with every clue present**:

| size | squares | T1 | T2 | T3 | T4 | T5 | unrated | tier-bounded T1 (exact) | T2 (exact) |
|---|---|---|---|---|---|---|---|---|---|
| 5×5 | 300 | 3 (1%) | 30 (10%) | 260 (87%) | 0 | 6 | 1 | 3 / 300 = **1%** · 1 ms/attempt | 33 / 300 = **11%** |
| 6×6 | 300 | 1 (0.3%) | 1 (0.3%) | 273 (91%) | 2 | 20 | 3 | 1 / 300 = **0.3%** | 2 / 300 = **0.7%** |
| 7×7 | 200 | **0** | **0** | 147 (74%) | 6 | 42 (21%) | 5 | 0 / 200 = **0%** | 0 / 200 = **0%** |

The floor *is* the yield: every square whose all-clue floor was ≤ the target then removed down
to exactly the target, and no square above the floor ever came down. At 7×7 **no** square in 200
had an easy or medium floor; a fifth were already extreme with all 28 clues present. **Under the E2 tiering,
easy and medium 6×6 Skyscrapers do not exist as a practical output of clue removal.**

### 2e. What the line-filter steps actually scan

For every `lineFilter` step the ladder took on all-clue unique squares, the number of
arrangements of that line still consistent with the candidates just before the step:

| size | squares | lineFilter steps | survivors 1 / 2 / 3 / 4 / 5 / 6 | 7–12 | 13–24 | > 24 | squares needing another T3+ technique |
|---|---|---|---|---|---|---|---|
| 5×5 | 300 | 857 | 310 / 178 / 219 / 46 / 46 / 15 | 41 | 2 | 0 | 6 (2%) |
| 6×6 | 200 | 1,860 | 245 / 167 / 261 / 160 / 118 / 227 | 391 | 164 | 127 | 29 (15%) |

Share of squares the ladder finishes with **every** line-filter step at ≤ K survivors and
nothing else above tier 2 — i.e. what a "small line scan" rung at tier ≤ 2 would make easy or
medium:

| K survivors | 5×5 | 6×6 |
|---|---|---|
| 1 | 116 / 300 (39%) | 1 / 200 |
| 2 | 155 (52%) | 1 |
| 3 | 244 (81%) | 10 (5%) |
| 4 | 259 (86%) | 20 (10%) |
| 6 | 275 (92%) | 45 (22%) |
| 8 | 281 (94%) | 62 (31%) |
| 12 | 293 (98%) | 123 (62%) |
| 24 | 294 (98%) | 149 (75%) |
| ≥ 60 (any lineFilter, no subsets/fish/chains) | 294 (98%) | 171 (86%) |

At 5×5 a third of the line-filter steps have **one** surviving arrangement — "only one
arrangement of this row fits its clues" — and 81% of all-clue squares need nothing more than
3-arrangement scans; at 6×6 the scans are longer (a 6-cell line with two clues keeps 1–12
arrangements) but 62% of squares are finishable with ≤ 12-arrangement scans.

---

## 3. What this means

### 3a. Fill-and-repair holds at 5×5 and 6×6; 7×7 needs restarts, 9×9 is out

The repair objective converges quickly where a random square starts *below* the count cap
(median initial count 2 at 5×5, 6 at 6×6) and wanders where it starts *at* the cap (7×7: 60,
9×9: 20). The fix at 7×7 is cheap — restart from a fresh square after ~40 fruitless swaps and
lower the cap to 20 — and brings every attempt home in a median 180 ms. At 9×9 nothing
converged in 60 s and a single count is 60–100 ms, so even a convergent climb would be seconds
per puzzle before any clue is removed; with classifies at 130–470 ms on top, tier-bounded
removal (28 counts + 28 classifies per attempt) would run ~10 s per attempt. **E4's fill stage
is fill → repair-with-restart → remove; 9×9 does not ship** (D4: large = 7×7; 9×9 stays the
research's "weekly special" footnote and needs a different objective, as Kakuro's 13×13 did).

### 3b. D4 settled: 5 / 6 / 7

- **Mini = 5×5**, not 4×4. 4×4 has the best raw yields (25 / 40 / 88% at T1–T3) but its "hard"
  is line filtering over 24 arrangements of a 4-cell line and its expert tier does not exist
  (0 / 40 X-wings); the research's reading — Tatham ships only 4×4 Easy — is confirmed from the
  other side. 5×5 has three tiers at guess count 0 with distinct hardest-rung signatures (T1 ·
  T2 · T3) and an attested extreme (38%); its easy/medium yields are the ladder problem of §3c,
  not a size problem.
- **Standard = 6×6.** Expert 10% and extreme 73% of tier-bounded output: the plan's gate
  ("expert/extreme ≥ ~10% at the standard size") passes, hard is 85%, every tier-bounded accept
  is 35–274 ms.
- **Large = 7×7.** Same shape as 6×6 at 2–3× the cost (hard 122 ms, extreme 295 ms, expert
  749 ms per accepted), repair 180 ms median with restarts — inside the 1 s gate. 9×9 fails
  both gates (§3a).

### 3c. The ladder's bottom is miscalibrated: line filtering is the human's basic move

This is the finding that changes the plan. Under E2's tiering (`lineFilter` = tier 3), 91% of
unique 6×6 squares are already **hard with all 24 clues on the board**, and removing clues can
only move a puzzle *up*. So tier-bounded removal toward easy or medium accepts 0.3% / 0.7% of
squares at 6×6 — ~300 fills (≈ 25 s) per easy puzzle — and 1% / 11% at 5×5. Published easy
Skyscrapers are fully or nearly fully clued *and* solvable by a beginner, which means the
beginner is doing something our tier-1/2 rungs do not: looking at one line with its two clues
and asking which few arrangements fit. §2e measures that scan: at 5×5 a third of the needed
line-filter steps have **one** surviving arrangement, 81% of all-clue squares need nothing
beyond 3-arrangement scans; at 6×6 62% need nothing beyond 12-arrangement scans. A scan of one
to three arrangements is not a tier-3 technique by any published ladder — Conceptis's "basic"
rules and Tatham's `solver_easy` both include single-line clue reasoning.

**Proposed recalibration (for E5's tier cuts, applied before E4 so the generator targets real
tiers):** grade a `lineFilter` step by the number of arrangements it scanned —

| survivors scanned | rung | rationale |
|---|---|---|
| ≤ 3 | tier 1 (easy) | "only one/two/three arrangements fit this line" — the clue-reading a beginner does; 81% of all-clue 5×5 squares need nothing more |
| 4–12 | tier 2 (medium) | a real enumeration of a 5- or 6-cell line, still one line at a time; takes 6×6 from 0.7% to 62% of squares |
| > 12 | tier 3 (hard) | the catch-all the research assigned to rung 6 — long scans, as today |

With that cut, the all-clue floor at 6×6 becomes roughly easy 5%, medium 57%, hard 24%, and
the rest expert/extreme — a generator can then search *down* from the floor by removal as
designed, and easy becomes a one-in-twenty fill (≈ 150 ms at 6×6) rather than one in three
hundred. The exact cuts are E5's to fit against the scorer; **the decision for E4 is only that
line filtering is tiered by scan size, not flat.** The explanation text already names the
line and its clues; it should also say how many arrangements fit ("only 2 arrangements of row 3
match its clues 3 and 2"), which is the hint a player can actually follow.

### 3d. The natural distribution is top-heavy — expert is the rare tier, not extreme

Unlike Kakuro, where hard/expert/extreme all came for free, Skyscrapers' expert (X-wing) is
**scarce at every size** (0% at 4×4, 10–15% elsewhere) while extreme (forcing chains) is
abundant (38–73%). The X-wing is a Latin-square technique that a clued grid rarely needs: the
clue rules and line scans resolve the pattern first, and when they do not, a chain does. G7's
question "is T4 ever needed?" has its answer: rarely, and it will be the slow tier for the
generator (274–749 ms per accepted). E5 should either accept expert as the small-yield tier,
add the research's two-line clue interaction as a second T4 technique (a clue-driven rather
than Latin-driven rung — the corpus now exists to test whether it fires), or fold T4 into T5.
The 7–15% `unrated` share after greedy removal is the ceiling of a 200-step, 2–3-candidate
chain; a generator targeting ≤ extreme will simply not produce them (the Kakuro 3e pattern).

### 3e. D12 settled (conditionally): the 5×5 mini carries three tiers — once §3c is applied

Hard is separable from medium at 5×5 at guess count 0: distinct hardest-rung signatures,
distinct yields (today 8% / 100%; with the §3c cut roughly 10% / 80% / small). Before the cut,
easy and medium are 1% and 11% of squares — producible (1 ms per attempt, so ~0.1 s per easy
puzzle) but a degenerate ladder in which hard is everything. **D12: easy / medium / hard at
5×5, with E5 verifying the three bands are populated after the re-tier.** 4×4 is a tutorial
board at most (D4's footnote), not a daily mini.

### 3f. G3 and G5

- **G3 (clue survival, per-tier yield):** answered above — ~half the clues survive random
  removal (4/16 · 7/20 · 11/24 · 14/28 median), per-tier yields in §2c, with the ladder caveat
  of §3c. Kept-clue count is **not** the difficulty lever the research half-expected: hard and
  extreme accept with the same median kept count (11 at 6×6, 15 at 7×7); *which* clues are
  blank matters, the count does not.
- **G5 (minimum clue count):** random uniqueness-preserving removal reached Nakamura's N − 1
  floor at 4×4 (3) and 5×5 (4) within 200 tries, and N + 1 at 6×6 (7) and 7×7 (11). Consistent
  with the conjecture; not a proof of it at 6 and 7 (the floor is a property of the best square,
  not a random one).

---

## 4. Gates (plan E3)

| Gate | Result |
|---|---|
| Unique 6×6 at any tier in < 200 ms average | **Pass for hard / extreme** (35 / 66 ms per accepted); expert 274 ms (10% yield); **easy / medium not producible under the E2 tiering** — see §3c, a ladder recalibration, not a size or engine problem |
| 7×7 in < 1 s | **Pass with the restart policy** (repair 180 ms median; hard 122 ms, extreme 295 ms, expert 749 ms per accepted); the plain climb fails (24/50, 1.9 s mean) |
| Expert / extreme populated at the standard size (≥ ~10% of tier-bounded output) | **Pass** — 10% / 73% at 6×6 (expert is the scarce one at every size, §3d) |
| 9×9 (D4 alternative) | **Fail** — 0 / 8 repairs in 60 s, 60–100 ms per count, 130–470 ms per classify; not a live size |

**Stop-and-re-slice verdict:** the gate's own clause ("if not, stop and re-slice — a finer
visibility ladder … before E4 rather than tuning inside E4") applies to the *bottom* of the
ladder. The re-slice is small and fully specified by §3c: tier `lineFilter` by scan size,
inside `skyscrapers-logical-solver.ts`, with the all-clue floor distribution (§2d/§2e) as the
acceptance test, then re-run §2c. E4 is unblocked on everything else (sizes, repair policy,
removal design, 9×9 out).

---

## 5. Open questions for the re-tier and E4/E5

1. **Where exactly to cut the line-filter scan** (≤ 3 / ≤ 12 proposed): fit against the
   scorer's within-band ordering on the §2d corpus in the same change, and check that the
   three fixtures keep sensible grades (the 5×5 fixture's three line-filter steps are the
   survivor counts to look at first).
2. **The restart policy's parameters at 6×6** (40 fruitless swaps, cap 20) were measured at 7×7
   only; 6×6's plain climb already succeeds 86% in 70 ms mean, so the policy is a safety net
   there — confirm it does not slow the common case.
3. **Expert's scarcity (§3d):** accept ~10% yield, add the two-line clue interaction as a
   clue-driven T4 rung, or merge T4 into T5 — E5's call once the re-tiered distribution exists.
4. **Clue-removal *order* as a tier lever** was only crudely tested (1s/Ns last for easy, first
   for hard). With the re-tier in place, measure whether order moves yield at all, or whether
   the all-clue floor dominates and E4 should spend its budget on *squares* rather than orders.
5. **9×9** needs an objective that is not a solution count (a propagation-based ambiguity
   measure, or seeding from the 7×7 corpus) before it is promised anywhere; deferred, not
   scheduled.

---

## 6. Reproducing

The measurements were one-off scripts (not committed). To regenerate: fill a square with
`fillGrid(createEmptyGrid(N), skyscrapersGridConfig(N))`; derive all clues with `deriveClues`;
hill-climb toward uniqueness with random intercalate swaps, keeping a swap when
`countSkyscrapersSolutions({ gridSize: N, clues }, { limit: 60 }).solutions` does not rise
(restart from a fresh square after 40 fruitless swaps at 7×7); for survival, blank clues in a
random order keeping each blank only if the count stays 1, then `classifySkyscrapers`; for tier
reachability, additionally require `classifySkyscrapers(...).tier ≤ target` per removal and accept
only when the final tier equals the target; for the all-clue floor, classify the repaired square
with every clue present; for the scan sizes, snapshot the solver's candidate masks before each
`step()` and count the permutations in `permutationTable(N).buckets[bucketIndex(N, left, right)]`
consistent with the snapshot on the line the `lineFilter` step names. 50 repairs, 200 survivals
and 40 tier-bounded attempts per (size, tier) at 4–7; 300 / 300 / 200 squares for the all-clue
floor at 5 / 6 / 7; 8 repair attempts at 9×9 with a 60 s cap.
