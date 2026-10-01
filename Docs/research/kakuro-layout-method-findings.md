# Kakuro layout method — edges-inward vs scatter (E4 findings)

> **Status:** measured 2026-10-01 during plan slice E4. A plan divergence record (AGENTS.md →
> Roadblock & Research Rules): the plan prescribed Mathimagics' *edges-inward* layout method;
> built and measured, it produced layouts that repair to unique 2–5× less often than the
> random-pair "scatter" method the yield spike had used as a stand-in. E4 ships scatter as the
> default and keeps edges-inward as an option. Parent: [kakuro-implementation-plan.md](../kakuro-implementation-plan.md)
> (E4); inputs: [kakuro-feasibility-findings.md](kakuro-feasibility-findings.md) (E3);
> research gap G3 in [kakuro-research-gaps-findings.md](kakuro-research-gaps-findings.md).

## 1. What was planned

E4's layout generator was to be Mathimagics' edges-inward template method (G3): decide the
outer edge, let every edge white force its inward neighbour white (no orphans), fill the rest
outside-in under 180° symmetry with forced values where contiguity or run length demands them,
restart on a dead end. The method's stated purpose is producing *valid* high-density layouts
with the invariants (symmetry, connectivity, run-length cap, no orphans) held throughout.

## 2. What was built

Both methods, behind `generateKakuroLayout({ method })` in `kakuro-generator.ts`:

- **edges-inward** as specified, with the coin steered toward the target density (forced
  whites make a layout whiter than its coin), plus an experimental `blockBreak` knob;
- **scatter**: all white, mirror pairs of blacks at random until the target count, each pair
  refused if it orphans a neighbour, the static validator last. This is what E3 measured with.

Both pass the same validator and hit the same densities; the only difference is *which* valid
layouts they produce.

## 3. What was measured

Same pipeline (fill → repair, repair capped at 10 s), 10 layouts per cell, dev machine.

| Size · density | Method | Repaired to unique | Repair median | Mean run length | Runs ≥ 6 cells (per 30 layouts) | All-white 2×2 blocks per layout |
|---|---|---|---|---|---|---|
| 9×9 · 0.36 | edges-inward | **5 / 10** | 394 ms | 3.20 | 105 | **20.5** (12–30) |
| 9×9 · 0.36 | scatter | **10 / 10** | 519 ms | 2.79 | 66 | 15.6 (10–22) |
| 7×7 · 0.36 | edges-inward | 7 / 10 | 569 ms | 3.21 | 54 | 12.8 (8–18) |
| 7×7 · 0.36 | scatter | 9 / 10 | **39 ms** | 2.93 | 37 | 9.7 (8–14) |

With the block-breaker (edges-inward, 9×9 · 0.36): `blockBreak` 0.5 → 19.2 blocks, 2/10
repaired; 0.8 → 18.8 blocks, 5/10. It barely moves the count.

End to end with scatter (`generateUniqueKakuro`, 30 per size, incl. classification): 6×6 avg
95 ms (median 20), 7×7 avg 320 ms (median 43), 9×9 avg 659 ms (median 245), 0 failures — the
numbers in `kakuro-generator.md`.

## 4. Why

Uniqueness fails through **sum-preserving swap cycles**, and the smallest one lives in an
all-white 2×2 block (`a b / c d` → `a+k b−k / c−k d+k` keeps every run sum). Repair's job is to
choose digits for which no such swap stays legal; the more 2×2 blocks a layout has, the more
cycles it must defeat at once. Edges-inward's defining rule — an edge white *forces* its inward
neighbour white — turns every white stretch on the edge into a 2-deep band, and the same rule
repeats on each ring, so its layouts carry ~30% more 2×2 blocks and more long runs (which have
the most combinations). The block-breaker only touches coin-flip decisions, and most whites in
an edges-inward layout are forced, not flipped — which is why it cannot fix it.

The method is not wrong for what Mathimagics built it for (valid layouts at high density, fast);
it is wrong for *our* objective, which is layouts that repair cheaply. Scatter's rejection
rule enforces the same invariants without the banding.

## 5. Decision

- **E4 ships `scatter` as the default** layout method. The plan's E4 text is amended; the
  invariants it listed are all kept (the validator enforces them for both methods).
- **`edges-inward` stays in the code as an option**, documented, for E5's layout-bias
  experiments — a tier-targeting generator may want its longer runs on purpose (long runs are
  where chains live).
- G3's practical answer is amended in the log: no template catalog, and the edges-inward
  *procedure* is not the generator either — the generator's layouts are its own.

## 6. Open questions for E5

1. Does a per-tier density bias (easy denser, extreme sparser) move the natural tier
   distribution enough, or does E5 need the classifier in the objective regardless? E4's
   numbers say regardless: easy is 0–3% at every density tried.
2. Is the 2×2-block count a usable *layout-level* predictor of repair cost (and of tier)? If so
   it is a free pre-filter before any solver call — measure the correlation on E4's corpus.
3. Edges-inward's long runs: do its (rarer) repaired puzzles grade harder? If yes, it is a
   lever for expert/extreme, not a dead end.

## 7. Reproducing

`generateKakuroLayout({ gridSize, blackDensity, method })` for both methods; count runs with
`deriveRuns` on the mask, 2×2 blocks by a direct scan, repair with `repairToUnique(fill, { msCap:
10_000 })` on `fillKakuroLayout(white)`. The measurement script was a session scratch file
(not committed).
