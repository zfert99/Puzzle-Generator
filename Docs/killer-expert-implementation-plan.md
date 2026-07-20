# Killer Sudoku Expert/Extreme — Implementation Plan (K10)

> **Status:** 📋 Planned · **Branch:** `feature/killer-sudoku` (kept open for exactly this)
> **Parent plan:** [killer-sudoku-implementation-plan.md](killer-sudoku-implementation-plan.md) (slice K10)
> **Research:** [killer-sudoku-difficulty-tiers.md](research/killer-sudoku-difficulty-tiers.md) ·
> [killer-difficulty-grading-systems.md](research/killer-difficulty-grading-systems.md)
> **History that constrains this plan:** [killer-difficulty-rebalance-report.md](killer-difficulty-rebalance-report.md)

Adds **expert** (and, gated on measurement, **extreme**) Killer difficulties. Everything here
follows from walls we *measured* during the July 2026 rebalance, not from speculation — the
plan is ordered so each slice knocks down the wall the next slice depends on.

## 1. Where we are (the measured baseline)

The shipped pipeline: cage-shape gates (singles budget + foothold band) → logical solve
capped at the difficulty's tier ceiling (~0.5 ms) → two-factor score band → uniqueness
verification (once, ~10 ms). Speeds: easy 12 ms / medium 117 ms / hard 404 ms avg, zero
failures. Score bands (easy < 42, medium 42–62, hard ≥ 62) are disjoint relative cuts.

Three measured walls block harder tiers:

| # | Wall | Measurement |
|---|---|---|
| W1 | Exact solver thrashes on big/loose cages | maxSize-4 no-givens uniqueness: 25–47 ms per check and minutes per accepted puzzle; pure 3-cell grids: 579 ms per check. Documented cliff at size 5 moves down to 4 once givens vanish. |
| W2 | Technique set can't grade harder shapes | ~86% of maxSize-4 unique layouts are unsolvable by the current tiers; thinning 2-cell cages collapses tier-3-solvable from ~10% → ~1% → 0 (the techniques lean on tight 2-cell cages). |
| W3 | Solvable tier-4 band is thin | ~1% of uniques — consistent with Stuart's ~1-in-5,000 extremes; expert generation must over-produce heavily and cheaply. |

W1 gates W2's usefulness (can't generate what we can't verify), and W1+W2 gate W3's
economics. Hence the slice order below.

## 2. What the research prescribes (and where it lands here)

- **Technique ladder for Hard+** (SudokuWiki ordering): multi-cell innies/outies, **cage
  splitting**, hard combinations, Rule of Parity, Cage/Unit Overlap, Cage Comparison (≈
  "Killer Combinations hard"), then the classic chain arsenal (X-Cycles, XY-Chains, 3D
  Medusa, Jellyfish, APE; extreme adds grouped X-Cycles, finned fish, AIC, ALS, forcing
  nets). → slice **E2**.
- **Necessity testing by capability-toggling** — verify a technique is *required* by
  disabling it and re-solving, never by reading one solve trace (order-dependence). Our
  tier-cap check already works this way at band granularity; per-technique tests in E2 must
  too. → **E2 test discipline**.
- **Over-produce and filter, with a cheap pre-filter** before the expensive grade when top
  tiers accept < ~1-in-thousands (backdoor / "Magic Cells" count, or branch-difficulty
  score). → **E3**, only if measured acceptance demands it.
- **Quality rejection** — discard puzzles that are trivial except one bottleneck step
  (Stuart's rule). Our opportunity-density factor already *scores* this; E3 adds it as a
  reject if expert output feels degenerate. → **E3 stretch**.
- **Weights for new techniques** (SE-scale): cage splitting ≈ 4.5, Rule of Parity / Cage
  Comparison ≈ 5.0, multi-cell innies/outies ≈ 4.5; chains 6.5–8.0 per the SE ladder. →
  **E2/E3 scoring**.
- **Cage-shape targets for expert** (difficulty-tiers research): ~0 singles, max cage size
  4–5, bigger sums (> 24 requires 4+ cells), high ambiguity (few footholds). → **E3 config**.

## 3. Design decisions (locked unless measurement vetoes)

1. **Tier ladder remap.** `KillerTier` grows to `0–5`:
   - Tier 4 (new meaning): *Killer-tough* — multi-cell innies/outies, cage splitting,
     combo-restricted hard combinations — plus classic X-Wing/Swordfish/Y-Wing (the current
     tier-4 basics).
   - Tier 5: *extreme* — XYZ/W-Wing, ALS-XZ, AIC (current tier-4 tail), and any chains added
     later.
   - Tiers 1–3 unchanged, so easy/medium/hard caps (2/3/3) are untouched — but their **score
     distributions will shift** because new techniques change solve traces → full band
     recalibration is mandatory (§5 E3).
   - Difficulty mapping: **expert = solveCap 4, extreme = solveCap 5**.
2. **Exact-solver pruning, not a new solver.** Same bitmask/MRV backtracking (house rule);
   E1 adds tighter, measured pruning + a node budget. No DLX.
3. **`maxSizeBias` finally engages** (shipped unused in the cage generator) — expert wants a
   3–4-cell-heavy mix, not rejection-sampling a uniform draw's tail.
4. **The Killer daily stays engine-medium.** Expert/extreme are free-play + PDF tiers first;
   promoting the daily is a separate later decision.
5. **Recalibration is part of the definition of done** for any slice that touches weights,
   gates, techniques, or the generator (the protocol in the parent plan's K10 entry).

## 4. Slices

### E1 — Exact-solver pruning + verify budget (unlocks W1) — ✅ done (July 2026)

**Outcome:** gate met. P1 (memoized combo-filtered masks) + P3 (node budget, 100 k default
for expert candidates): maxSize-4 hard-shaped verifies **191 ms avg / 7.7 s max → 33.6 ms
avg / 94 ms max**; biased class 33 s → 2.6 s avg; existing tiers *faster* (easy 8 / medium
62 / hard 343 ms, 0 fails). P2 (45-rule house bounds) was implemented, A/B'd on fixed
fixtures, found a pure 25–30 % loss, and **removed**. Unique-throughput with the budget is
~3× unbounded. Details: `killer-solver.md`, `cage-combinations.md`.

The current `candidates()` prunes with `candidateMaskFor(remCells, remSum) & ~cageUsed` —
but that mask is the union over **all** combinations, including ones containing already-used
cage digits. A digit that appears *only* in used-digit-incompatible combinations survives
the mask and spawns doomed branches; big loose cages amplify this.

- **P1 — combo-filtered candidate masks:** union only over combinations disjoint from
  `cageUsed` (filter `combosFor(remCells, remSum)` by `comboMask & used === 0`; memoize on
  `(cells, sum, used)` — combo lists are ≤ 12 entries, so even unmemoized is cheap).
- **P2 — house remaining-sum bounds (if P1 isn't enough):** for each house, the min/max
  achievable sum of its empty cells' candidates must bracket `45 − placedSum`. Prune the
  branch otherwise. Costlier per node; implement only if the P1 benchmark misses the gate.
- **P3 — node budget for generation:** `countSolutions(limit, { nodeBudget })` — bail out
  returning "reject" after N search nodes so a pathological layout costs bounded time. The
  generator treats budget-exhaustion as a failed candidate (never a false "unique").
- **Also:** re-verify the grade-before-uniqueness soundness argument still holds (it does —
  pruning only *removes* impossible branches).

**Gate (benchmark, stage-rate style):** maxSize-4, minSize-2, ≤1-single layouts verify
uniqueness in **≤ 50 ms avg** (parent plan §7 target) and easy/medium/hard generation shows
**no regression** (re-run the 20-sample benchmark). If P1+P2 both miss, stop and rethink —
do not ship expert on multi-second verifies.

### E2 — Killer techniques + tier remap (unlocks W2) — ✅ done (July 2026)

**Outcome:** gate met — gradable maxSize-4 uniques 7% → **57%** (target ≥ 40%). Shipped:
`cageComboRestriction` (combo viability + Hall's condition), `ruleOf45MultiCell`
(2–4-cell pseudo-cages under cage/house distinctness guarantors), box regions, the 0–5
tier remap (tier 4 = Killer-tough + classic advanced, tier 5 = extreme), technique
weights, and `solve({ disable })` with a capability-toggling necessity test. Soundness:
93 solved layouts fuzzed against the exact solver, 0 mismatches. Existing tiers:
identical traces, bands hold, no speed regression. Details: `killer-logical-solver.md`.

In `killer-logical-solver.ts` (technique table just grows rows):

- **Combo-restricted cage arithmetic (hard combinations):** intersect each cage's allowed
  mask with combinations filtered by *current cell candidates*, not just arithmetic — the
  logical-solver mirror of E1/P1.
- **Multi-cell innies/outies:** for a region, when the innie/outie *set* (2–4 cells) has a
  known sum, restrict those cells via `candidateMaskFor(k, sum)` (we currently only place
  single-cell leftovers).
- **Cage splitting / pseudo-cages:** derive virtual cages (e.g. region-sum minus contained
  cages → a pseudo-cage over the leftover cells) and run cage arithmetic on them.
- **Rule of Parity / Cage Comparison** — stretch; add only if the E3 acceptance gate needs
  a wider gradable band.
- `KillerTier` 0–5 remap per §3; `TECHNIQUE_WEIGHTS` gains the new entries (SE-scale values
  from §2).
- **Tests:** each new technique gets (a) a fixture puzzle it alone unsticks, verified by
  capability-toggling (disable → stall, enable → solve), and (b) soundness fuzzing against
  the exact solver's solution (the existing pattern).

**Gate:** the fraction of maxSize-4 unique layouts gradable (solvable ≤ tier 5) rises from
**~14% to ≥ 40%**, measured on a 100-layout sample. Below that, expert generation stays
uneconomical — add the stretch techniques before proceeding.

### E3 — Expert/extreme generation + full recalibration — ✅ done for expert (July 2026)

**Outcome:** gate obliterated — expert generates in **271 ms avg / 687 ms max** (gate ≤ 5 s /
15 s), 0 fails in 20, scores 93–163 in a disjoint ≥ 90 band (hard re-cut to 62–90; cut keeps
~85% of both). Config: solveCap 4 + **minTier 4 necessity** (fresh cap-3 solve must stall),
sizes 2–4, ≤ 1 single, ≤ 1 foothold, no bias (measured 3× worse yield for nothing), 100 k-node
verify budget. Max cage sums reach 29 — big cages are expert's signature since max4 layouts
are ~never tier-3-solvable. **Extreme deferred by measurement** (0 tier-5-necessary layouts
in 40 s — needs more tier-5 techniques first). **Hard keeps maxSize 3** — the E2 gains are
all tier-4 by design (tiers 1–3 frozen), so the "hard gets big cages back" hope was
measured away rather than shipped blind.

- Config (starting point, tuned by stage-rate sweeps exactly like the rebalance):
  `expert: { solveCap: 4, minSize: 2, maxSize: 4, maxSingles: 0–1, maxFootholds: 1,
  maxSizeBias: ~0.5, scoreBand: measured }`; extreme same shape with solveCap 5 — **ship
  extreme only if its measured acceptance and speed clear the gates**, otherwise expert
  alone this round.
- **Uniqueness via the E1 node budget**; if acceptance < ~1-in-2000, add the research's
  cheap pre-filter (backdoor count or branch-difficulty score) ahead of grading.
- **Hard gets its big cages back (explicit deliverable):** retry hard at `maxSize 4` with
  E1+E2 in place — the rebalance had to forgo sums > 24; this is where that debt is paid.
- **⚠️ Full recalibration (all difficulties):** 30+-sample score distributions → re-place
  ALL cuts disjointly (easy/medium/hard shift because E2 changed traces; expert/extreme
  bands placed fresh) → update `killer-score.md`, `killer-sudoku.md`, band regression
  tests, and the benchmark tables.

**Gate:** expert ≤ **5 s avg / 15 s max** generation, zero fails in 20; distributions
monotone and disjoint across all shipped difficulties.

### E4 — Surfaces

- `/play`: Killer difficulty ladder gains expert (and extreme if shipped) — loading state
  already handles multi-second generation; verify INP untouched (generation is async).
- `/generate` + PDF: Killer sections accept the new tiers; sample regenerated.
- Daily: unchanged (decision §3.4).
- E2E: extend the Killer play spec to the new tier; full suite green.

### E5 — Docs, benchmarks, QA, status

- Mirrored `.md` files for every touched engine file; rebalance report gets a dated
  addendum; parent plan K10 marked as-built; roadmap/README status updated.
- Benchmark tables recorded (engine + generation) with the same stage-rate discipline.

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | E1 pruning slows the *existing* fast path (per-node overhead on easy/medium/hard) | Benchmark before/after on all three; memoized masks; P2 only behind the gate. |
| 2 | `KillerTier` remap ripples (types, tests, configs, score weights) | Mechanical sweep in one commit; tier 1–3 semantics frozen; 67+ Killer tests catch drift. |
| 3 | Recalibration shifts easy/medium/hard bands players already know | Bands are internal (never shown as numbers); played difficulty ordering is preserved by construction. |
| 4 | Expert acceptance stays uneconomical even after E2 | Stretch techniques (Parity/Comparison), then pre-filter; if still < 1-in-thousands, ship expert without extreme and defer. |
| 5 | Node budget mislabels unique puzzles as rejects (yield loss, never correctness loss) | Budget-exhaustion only ever *rejects*; tune budget from the P1/P2 node-count distributions. |
| 6 | Multi-second expert generation feels broken on `/play` | Existing "Generating…" state; consider a one-line "expert can take a few seconds" hint. |

## 6. Definition of done

- `generateKillerSudoku('expert')` (and `'extreme'` if gated in): unique, shape-gated,
  score-banded, ≤ 5 s avg / 15 s max, 0 fails in 20.
- Hard regenerated at maxSize 4 (sums > 24 present) within its speed budget.
- Every E2 technique necessity-tested by capability-toggling; solver soundness fuzzed.
- All score bands re-placed on fresh distributions; disjoint; regression-tested.
- Playable on `/play`, printable via `/generate`; E2E green; benchmarks logged; docs synced.
