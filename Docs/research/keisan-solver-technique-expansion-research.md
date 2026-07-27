# Keisan Solver Technique Expansion — Research Brief (K7c option 4)

**Purpose.** A research brief, not a plan. K7b established that bounded-recursion guess-*depth* gives
only one new tier (depth-1 Nishio; depth-2 never fires), so it can't separate Expert from Extreme on
9×9. Option 4 of the [K7c fork](keisan-9x9-feasibility-findings.md#6b-k7b-result--bounded-recursion-works-but-is-a-single-step-the-k7c-fork)
is to **widen the *named*-technique ladder** so difficulty spreads across more tiers *before* the
Nishio backstop — giving honest, technique-separated Expert and Extreme tiers. This document frames
what to add, the Calcudoku-specific caveats, and the questions to answer before committing to build.

Written to be researched against (like the 9×9 de-risk → external honest-ladder research loop). The
prior external research ([honest-ladder research](compass_artifact_wf-feb5af89-67a1-51e8-bf2f-f348f76adfdd_text_markdown.md)
§Q1) already surveys the technique *landscape*; this brief narrows it to *our* solver and the
specific empirical questions that decide whether option 4 is worth the K3-scale cost.

---

## 1. The problem, precisely

On 9×9 our logical solver's hardest-required tier concentrates at **~T2**, then jumps straight to
**T5 (Nishio)** for the ~23% of boards T4 can't finish. There is almost nothing at T3/T4 — so the
difficulty axis is really just three points: *technique-light (T1–T2)*, *needs-a-guess (T5)*, and
*ungradable*. That's enough for Easy/Medium/Hard + one Expert, but not a fifth distinct tier.

**The goal of option 4:** add intermediate deductions that genuinely fire on 0-given 9×9 boards, so a
meaningful slice of boards top out at a real T3/T4/… step. Then Expert = "needs the new hard
technique(s)" and Extreme = "needs the new technique(s) *and* a Nishio guess" (or a higher new tier),
each with an honest solve path.

## 2. What our solver has today (and its two confirmed weak spots)

Current ladder (`calc-logical-solver.ts`):

| Tier | Techniques |
|---|---|
| 1 | cage arithmetic, naked/hidden single |
| 2 | naked/hidden pair, **cage-combo restriction** |
| 3 | **line-sum invariant — single-line only** |
| 4 | X-Wing (rows/columns) |
| 5/6 | bounded recursion (Nishio / depth-2) — K7b |

Two weak spots, both confirmed in code, both flagged by the external research:

- **T3 `lineSum` is the degenerate case.** It fires only when a row/column has **exactly one** empty
  cell (`emptyCount === 1`) — a near-endgame trigger, almost never the *hardest* step. The powerful
  version is **multi-line innies/outies (rule-of-45 across a block of 2–3 rows/columns)**: sum the
  cage totals wholly inside the block, subtract from `k · N(N+1)/2`, and pin the one cell that pokes
  in/out of the block. That's the technique that actually carries mid/late-game difficulty.
- **No cage↔line intersection.** T2's `cageComboRestriction` reasons *within* a cage's own multisets.
  It never reasons about a cage's *interaction with a line* (a cage confined to one row forces its
  digits into that row → claiming; a digit confined within a cage to one line → pointing). This is a
  whole family we don't have.

## 3. Candidate techniques (narrowed to our engine)

From the external research §Q1, ranked by expected value *for our specific situation* (0-given 9×9,
boxless, arithmetic cages, −/÷ 2-cell-only):

1. **Multi-line region-sum / innies-outies (generalise T3).** Highest-value, most natural — it's an
   upgrade of a technique we already have. **Caveat (load-bearing):** it needs each in-block cage's
   *sum contribution*, which for ×/÷/− cages is only known once the cage's multiset is pinned. On
   0-given boards many cages are multiplicative and un-pinned early, so this fires *later* than in
   Killer (all-additive). Open question: how often is a 2–3 line block sufficiently sum-pinned to
   fire on our boards?
2. **Cage-region intersection (pointing / claiming).** Cheap, likely fires often (the research
   expects it on "most boards"). A cage wholly inside a row/column claims its digits into that line;
   a digit confined within a cage to one line is eliminated from the rest of that line. No arithmetic
   caveat beyond what `cageComboRestriction` already computes. Good candidate for a new low-mid tier.
3. **Parity / prime-factor filters on product cages.** Cheap, best folded into the *combination
   tables* (a `105×` 3-cell cage in 9×9 must be {3,5,7}) rather than as a standalone tier — sharpens
   cageArithmetic/comboRestriction, may reduce how often Nishio is needed.
4. **AIC / chains.** The research warns strong links are *sparse* on a boxless Latin square (no boxes;
   only bivalue cells, bilocal candidates, and cage-combo groupings), so chains fire only
   *occasionally*. Higher implementation cost, lower/uncertain firing — lowest priority.

## 4. The decision this research must answer

Option 4 is only worth its cost **if the new technique(s) actually create a monotonic tier spread on
our boards.** Concretely, before building:

1. **Firing rate.** On unique 0-given 9×9 boards, what fraction have a *hardest required step* of
   (a) new cage-line intersection, (b) multi-line region-sum, (c) still just T1–T2, (d) still need
   Nishio? We want a healthy population topping out at the *new* techniques — not everything still
   collapsing to T2-or-Nishio.
2. **Monotonicity.** Do boards graded "needs multi-line region-sum" actually play harder than
   "T2-only" and easier than "needs Nishio"? (Proxy: solve-time, or the two-factor score, or a
   human/solver panel.) If the new tier doesn't sit *between*, it's not a tier.
3. **Yield.** Can the generator produce boards in each new band at acceptable cost (offline-pool
   budget), or do the tighter technique requirements crater the accept rate the way `maxFootholds`
   did at 9×9?
4. **Which technique(s) to implement.** Likely (2)+(1) from §3 — but the firing data decides. If
   cage-line intersection alone gives a clean intermediate tier, we may not need the harder
   region-sum generalisation.

## 5. Suggested measurement plan (to run once a technique is prototyped)

- Prototype the cheapest high-value candidate first: **cage-region intersection (pointing/claiming)**
  as a new tier between current T2 and T3, since it has no arithmetic-pinning caveat.
- Re-run the K7b-style population scan: generate unique 0-given 9×9 boards, record the hardest tier
  with the expanded ladder, and bucket. Look for a distribution that puts a real fraction of boards at
  the new tier (target: enough to sustain an Expert band) and *reduces* the fraction that need Nishio.
- Only if intersection alone is insufficient, prototype **multi-line region-sum** and measure how
  often it fires given the ×/÷ pinning caveat.
- Gate: a monotonic solve-time/score ordering across `T2-only < new-technique < Nishio`, and a
  sustainable per-band generation yield.

## 6. If the research says "not worth it"

Fall back to **K7c option 1 (4 tiers)** — Easy/Medium/Hard/Expert, Expert = needs a depth-1 Nishio
guess, no Extreme at 9×9. It's honest and already fully supported by the K7b solver; the only cost is
5-tier parity with Classic/Killer, which can wait. That fallback needs *no* new engine work — just an
Expert config + daily board generated into the offline cron pool.

## 7. Sources to build on

- [honest-ladder research §Q1](compass_artifact_wf-feb5af89-67a1-51e8-bf2f-f348f76adfdd_text_markdown.md)
  — billabob's KenKen technique-cost table (pointing/claiming, region sum/parity, AIC, multi-cage
  combination elimination), with ratings; the definitive external survey.
- [keisan-9x9-feasibility-findings.md](keisan-9x9-feasibility-findings.md) — the 9×9 de-risk + the
  K7b bounded-recursion result (§6b) that opened this fork.
- `src/features/engine/calc/calc-logical-solver.ts` / `.md` — the current ladder; `lineSum` is the
  single-line T3 to generalise, `cageComboRestriction` is the within-cage reasoning to extend to
  cage↔line.
