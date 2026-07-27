# Building an Honest 9×9 Keisan (Calcudoku) Difficulty Ladder: Solver Techniques, Uniqueness Speedups, and Generation Economics

## TL;DR
- **There IS an implementable tier between X-Wing and full bifurcation, and Tatham's `keen.c` shows the cleanest design: make bounded recursion (guess-and-check with a counted depth) its own named tier.** The billabob KenKen solver proves a concrete ladder above X-Wing exists (AIC rated 4.x, multi-cage combination elimination rated 6.x) — so your missing "T5" is really *two* things: cage-combination/AIC chains (hard but rarely firing on 0-given boards) and bounded bifurcation (always available, honestly gradable by depth). Build bounded recursion as T5.
- **Your "difficulty = inverse of givens count" finding matches how the whole industry actually works.** calcudoku.org (Patrick Min) rates by empirical human solve-rate, not technique; HoDoKu and Sudoku Explainer are the only "objective" raters and both are weighted-sum / technique-ceiling scores that constructors themselves treat as approximate. A score band is a *defensible* basis for named tiers **only if** you stop promising a pure-logic solve path — which at 0 givens you already cannot keep.
- **Recommendation: ship Design C now (3 tiers, all maxSize 3), then add a bounded-recursion T5 and move to a modified 5-tier Design A.** maxSize 4 is not worth its ~13× verify cost for visual "chunkiness"; real 9×9 Calcudoku is dominated by 2–3 cell cages. Fix generation yield with constructive "dig-out" generation and offline pooling, not brute rejection.

## Key Findings

1. **The technique ceiling is not the real problem — the *grading philosophy* is.** Every serious puzzle product either (a) rates by weighted-sum score (HoDoKu), (b) rates by hardest-technique-required (Sudoku Explainer, sudoku.coach), or (c) rates by empirical human solve rate (calcudoku.org). None of these guarantees a unique "solve path"; they are all statistical or score proxies. Your score-band approach is mainstream. What is *not* defensible is calling a tier "logic-solvable" when 0-given 9×9 boards are 0% gradable by your current T1–T4 solver.

2. **Tatham's `keen.c` already solves your exact problem** and is directly transplantable. Its difficulty enum is `EASY, NORMAL, HARD, EXTREME, UNREASONABLE`. Crucially, EXTREME and UNREASONABLE have **NULL** technique functions in the `DIFFLIST` macro — they are produced *entirely* by the shared `latin.c` solver's forcing-chain and recursion machinery, not by hand-coded human techniques. This is a shipped, working proof that "bounded recursion as a graded tier" is a viable design. (`keen.c`, Simon Tatham's Portable Puzzle Collection, © 2004–2021, MIT/Expat licence.)

3. **billabob's KenKen solver publishes a full technique-cost table** that answers Q1 directly: there are named, implemented techniques above X-Wing — cage-region intersection (pointing/claiming), region sum/parity (single- and multi-region), AIC chains, and multi-cage combination elimination, on a rating scale mirroring Sudoku Explainer.

4. **Uniqueness proving can be sped up 1–2 orders of magnitude** by (a) GAC `alldifferent` propagation (Régin 1994) on rows/columns, (b) precomputed cage-combination tables with geometric pruning, and (c) a CP-SAT / OR-Tools or DLX backend for the counting solve. Your counting backtracker is the slow path precisely because it lacks strong propagation.

5. **Generate-and-test is the wrong architecture for the hard end.** CanCan, KSudoku, and the Sudoku "dig-hole" literature all point to constructive generation: build a gradable board, then remove givens / merge cages while re-checking, targeting the difficulty band directly instead of rejecting ~1,000 boards per accept.

## Details

### Q1. Cheap T5-class inference techniques

**The single most useful source is the billabob KenKen solver's published rating ladder** (`billabob.github.io/kenkensolver`), which grades KenKen/Calcudoku on a Sudoku-Explainer-style scale. Above your current T4 (X-Wing at rating 2) it defines:

- **1.2 / 1.5: Cage-region intersection (pointing / claiming)** — a cage wholly inside a row/column forces its digits into that line (claiming), or a digit confined within a cage to one line is removed elsewhere (pointing). This is *beyond* your T2 "cage-combo restriction," which only reasons within a single cage's own candidate multisets; pointing/claiming reasons about the cage's *interaction with the line*.
- **3.0–3.9: Region Parity and Region Sum**, including *multi-region* variants and "region sum with N unknown cages in 1 or >1 regions" (rating `3 + (N−1)/5`, capped 3.9). This is the Killer-Sudoku innie/outie / rule-of-45 family generalized to boxless Latin squares — your line-sum invariant T3 is the *degenerate single-line case*.
- **4.0–4.9: AIC (Alternating Inference Chains)** — rating `4 + (N−1)/10` for N strong links. billabob notes the AIC implementation is "KenKen-specific" because it must chain across *both* the Latin-square constraint and the cage-combination constraint; using one or the other alone "isn't enough."
- **6.0+: Multi-cage combination elimination** — jointly enumerate valid combinations across pairs, then triples, then N-tuples of cages, eliminating combinations that cannot co-exist. billabob explicitly flags this as "effectively bruteforcing larger and larger subdivisions of the puzzle" — i.e. it shades into bounded bifurcation.

**What this means for your ladder:**

- **Multi-cage combination elimination** is the most powerful *deductive* technique but is expensive (enumerate-and-cross-check every cage pair, then triple…) and billabob warns preprocessing "could take an extremely long time" with large cages. On 0-given 9×9 it *will* find eliminations, but its cost approaches bifurcation. Implement it **pairwise-only** first (rating ~6.0) as a bounded, cheap version.
- **Region sum / innies-outies across 2–3 lines** (your T3 generalized): the reason your T3 "never fires" is almost certainly that you implemented only the *single-line* rule (one row/column must sum to N(N+1)/2 = 45). The powerful version subtracts summed cage-totals from k·45 across a *block* of 2–3 rows/columns to pin an "innie" or "outie" cell, and can *split* cages across a line boundary (SudokuWiki's "Cage Splitting"; djape's rule-of-45 write-ups). On a boxless grid you lose the 3×3-box version but keep the row/column-block version. Caveat: with arithmetic cages you must first convert ×/÷/− cages to a known sum-contribution, which only works once a cage's multiset is pinned — and on 0-given boards many cages are multiplicative and un-pinned early, limiting how often this fires.
- **Parity / modular arguments**: product cages give divisibility/prime-factor constraints (e.g. a "105×" cage over 3 cells in 9×9 must be {3,5,7}, since 105 = 3·5·7 and no other in-range factorization fits); sum-cage parity across a line is the parity half of the region-sum family (billabob rates "Region Parity" 3.0). These are cheap and best added as **combination-table filters** (see Q2) rather than standalone tiers.
- **Chains (AIC / X-Chain / XY-Wing / coloring/Medusa)**: these *do* transfer to a boxless Latin square, but the strong-link structure is thinner without boxes — your only strong links are (i) bivalue cells, (ii) bilocal candidates in a row/column, and (iii) cage-combination groupings. billabob's implementation leans heavily on cage-combination strong links precisely because the pure-Latin-square link structure is sparse. Expect chains to fire *occasionally* on 0-given 9×9, not reliably enough to hang a whole tier on.
- **Bounded bifurcation as its own tier — the recommended T5 (the Tatham transplant).** In `keen.c` the difficulty list is:

  ```c
  #define DIFFLIST(A) \
      A(EASY,Easy,solver_easy,e) \
      A(NORMAL,Normal,solver_normal,n) \
      A(HARD,Hard,solver_hard,h) \
      A(EXTREME,Extreme,NULL,x) \
      A(UNREASONABLE,Unreasonable,NULL,u)
  ```

  The `NULL` for EXTREME and UNREASONABLE means those tiers have *no bespoke technique function*: they are produced by the shared `latin.c` solver. The dispatch call is:

  ```c
  ret = latin_solver(soln, w, maxdiff,
                     DIFF_EASY, DIFF_HARD, DIFF_EXTREME,
                     DIFF_EXTREME, DIFF_UNREASONABLE,
                     keen_solvers, &ctx, NULL, NULL);
  ```

  The threshold arguments map `latin.c`'s internal technique tiers onto keen's named levels: simple deductions → EASY; set/subset reasoning → HARD; the extended set variant and **forcing chains** → EXTREME; and **recursion (guess-and-backtrack)** → UNREASONABLE. So: **forcing chains earn "Extreme"; genuine backtracking earns "Unreasonable."** A puzzle's rating is read back from the solver: solve at max difficulty, see which tier was actually needed. A comment in `keen.c` documents that the generator double-checks by re-solving one level down and requiring it to *fail*, guaranteeing the puzzle genuinely needs its assigned tier ("solving an Easy puzzle on Normal difficulty will typically return Normal. Hence the uses of the solver to determine difficulty are all arranged so as to double-check by re-solving at the next difficulty level down and making sure it failed"). `latin_solver_recurse()` picks the cell with fewest candidates (minimum-remaining-values), tries each candidate, recurses on a copy of the solver state, and detects 0 / 1 / >1 solutions for uniqueness.

  **This is your directly transplantable T5.** Define T5 = "solvable only with ≤ D levels of guess-and-check, each guess propagated with T1–T4 and each hypothesis either closed by contradiction or completed uniquely." Count the max recursion depth reached. Depth-1 (Nishio-style: one hypothesis to contradiction) is a defensible, human-reproducible tier; depth-2 is "Extreme." This gives you a *continuous, always-available difficulty axis* on 0-given boards, which the technique ladder cannot provide.

- **Nishio** (assume one candidate, propagate, look for a contradiction) is exactly bounded-recursion depth 1 using only the "contradiction" branch. It is widely accepted as human-reproducible and is a good floor for T5.

**Likelihood of firing on 0-given 9×9 (the crucial question):** cage-region intersection and pairwise cage-combination elimination will fire on most boards; single-line region-sum (your T3) rarely fires and multi-line innies/outies fire only in the mid/endgame; AIC/chains fire occasionally; **bounded recursion always "fires" and is the only technique that reliably discriminates the hardest boards.** This is exactly why Tatham hangs his top two tiers on it.

### Q2. Faster uniqueness proving

Your counting backtracker at 428 ms (maxSize 5, 0 givens) is slow because it lacks strong propagation. Concrete speedups, in rough order of value:

1. **GAC `alldifferent` on every row and column (Régin 1994).** Model each row and column as an `alldifferent` constraint and enforce generalized arc consistency via bipartite-matching + SCC filtering (Régin's algorithm: find a maximum matching in the value graph, then remove edges in no maximum matching using Tarjan strongly-connected-components). Régin's method "enforces generalized arc-consistency, which is the strongest level of consistency for a single constraint" (van Hoeve, "The alldifferent Constraint: A Survey," arXiv cs/0105015). This is *far* stronger than the per-cell forward-checking a naive backtracker does and is the single biggest lever. Primary reference: **Jean-Charles Régin, "A Filtering Algorithm for Constraints of Difference in CSPs," AAAI-94, Seattle, vol. 1, pp. 362–367 (1994).**

2. **Cage-combination precomputation with geometric pruning.** Memoize, keyed by `(op, target, cageSize, N)`, the set of valid multisets; then prune by *geometry*: a straight-line cage (all cells in one row or column) cannot hold repeats, so drop any multiset with a repeated digit; a bent/L-shaped cage *can* hold repeats but only in cells not sharing a line. This is exactly the "cage combinations" preprocessing billabob describes, and it front-loads most of the arithmetic. Bounds consistency on the arithmetic relation (min/max reachable product/sum) prunes further. Note −/÷ are 2-cell-only in your engine, so those tables are tiny.

3. **CP-SAT / OR-Tools or a DLX backend for the counting solve.** KenKen is a natural CSP; multiple public solvers (chanioxaris, MikeXydas, JohnPapad on GitHub) report that **MAC (maintaining arc consistency)** is the consistently fastest method for dimensions ≥ 7, though it has higher constant overhead below 7. For *uniqueness specifically*, the standard trick is "solve, add a blocking clause forbidding that exact solution, re-solve": if the second solve is UNSAT the solution is unique; if SAT, it is not. This is the documented AllSAT / blocking-clause method (e.g. the SAT investigation of orthogonal Latin squares, arXiv 2509.09633, adds `¬(⋀ cell assignments)` after each solution; Toda & Soh, "Implementing Efficient All Solutions SAT Solvers"). Because you only need "≤1 vs ≥2," cap at the second solution — exactly your `countSolutions(cap 2)` but with a vastly stronger engine underneath.

4. **DLX / exact cover**: KSudoku's generator uses a **DLX solver** (`dlxsolver.h`) that explicitly supports "Killer Sudoku and MathDoku (aka KenKen™)… MathDokus can have N×N cells, for N ≥ 3, but no boxes." DLX is excellent for the pure Latin-square part, but arithmetic cages must be encoded as additional "at most one valid combination per cage" columns; the enjoysudoku forum documents that DLX degrades badly on under-constrained (many-solution) instances — it can go "into a fugue state" and run for hours on ambiguous grids. For *proving non-uniqueness fast*, CP/SAT with early abort is safer than DLX on your low-uniqueness 0-given boards.

5. **Variable/value ordering + restarts**: MRV / fail-first variable ordering (pick the cell with fewest candidates) is the cheap, high-value heuristic; dom/wdeg and conflict-directed backjumping help on the hard tail. Because "a second solution usually exists near the first," a good tactic for the *non-uniqueness* check is to seed the second search with the first solution and branch first on cells in the largest/most-ambiguous cages, where alternate solutions concentrate.

6. **Engineering**: precompute combination tables once at module load; compile the hot counting loop to **WebAssembly** (Rust/C) for the cron and optionally client-side — a 5–20× constant-factor win over interpreted TS is realistic for backtracking inner loops. Parallelism (worker threads splitting the first branch) helps the offline cron but not the interactive path.

### Q3. Is maxSize 4 worth it?

**No, not for the top tiers, on the evidence.** Real published 9×9 Calcudoku/KenKen is dominated by **2- and 3-cell cages**. CanCan's generator documentation (William P. McNeill, `wpm.github.io/CanCan`) describes the tiling algorithm — "Partition this graph into its connected components, limiting each component to a randomly chosen maximum size… You need a distribution over cage sizes from which to sample… Its exact values are manually adjusted to produce a range of cage sizes that makes for interesting puzzles" — and notes that as a grid fills, "larger cages will not fit inside the remaining space, so the resulting empirical distribution of cage sizes will skew smaller than the one used for sampling." I.e. even generators that *try* for big cages end up mostly small. Will Shortz's published KenKen restricts −/÷ to 2-cell cages (as your engine does), further biasing large cages toward + and ×. calcudoku.org offers sizes up to 15×15 but its difficulty is driven by *operation mix and solve-rate*, not cage size.

**Perceived difficulty does not track cage size the way visual "chunkiness" suggests.** A large + or × cage with many candidate multisets actually carries *less* localized information early (more possibilities), but the arithmetic is more tedious — which reads as "annoying," not "hard." Tatham caps cage size at `MAXBLK 6` in `keen.c` and comments that very large clue blocks are "annoying in UI terms… and also in solver terms (too many possibilities to iterate over)." Given your measured **~13× verify cost and gradability collapse from 65%→33% at maxSize 4, and 0% gradable at maxSize 5**, the cost/benefit is clearly negative. Keep maxSize 3 as the default; reserve maxSize 4 only for an *offline-generated* top tier if you want cosmetic variety, never for interactive generation.

### Q4. Givens count as the primary difficulty axis

Your empirical finding — feasibility and gradability are monotonic in givens count, difficulty is its inverse — is correct and matches constructor convention. Key points:

- **Classic-Sudoku givens intuition does NOT transfer**, and you are right to distrust it. There are no boxes (removing one constraint family) but cages carry information ordinary Sudoku givens do not. A single-cell cage is *exactly* a Sudoku given; a 2-cell cage carries roughly "1.5 givens" worth of constraint depending on op. So "givens count" for you should be measured as *total clue information* = (single-cell cages) + (information content of multi-cell cages).
- **calcudoku.org's rating is empirical, not structural.** Patrick Min rates puzzles by the **percentage of regular solvers who solve them on publication day**. Verbatim from his "10 Hardest Logic/Number Puzzles" (© Patrick Min, London, July 5, 2013): "the hardest Calcudoku was a 9×9 puzzle published on the 2nd of April 2013, which only 9.6% of the regular puzzlers at calcudoku.org managed to solve," identified by "what percentage of puzzlers solved them on the day they were published." Star ratings (2–6 in his books) are calibrated to this solve-rate, not to a technique or a givens count. This is the strongest evidence that **empirical solve-rate, not technique ceiling, is the industry's real difficulty metric** — which validates a score-band approach *if* you calibrate bands against real solve data.
- **Minimum-clue theory**: the Latin-square-completion literature (Palomo, "Latin Puzzles," arXiv 1602.06946) formalizes "a completable partial Latin board is a Latin puzzle iff it completes to exactly one board" and discusses CP-based difficulty measurement, but gives **no closed-form minimum clue count** for boxless N×N with arithmetic cages — so there is no theoretical number to target; you must calibrate empirically.
- **How other generators choose givens**: the Sudoku "dig-hole" papers (Li et al., "Sudoku Puzzles Generating: from Easy to Evil") define difficulty from *total givens, distribution of givens, technique level, and search complexity* jointly, and dig holes until a target is hit — the direct analogue for you is "merge cages / remove single-cell givens until the score band is hit."

**Practical guidance:** treat single-cell-cage count as your primary difficulty *dial*, calibrated against measured human/solver solve-rate per band, not against an absolute number. Your own data (15.2 givens → 100% gradable; ~10.3 → 91%; 0 → 0%) already gives you the calibration curve's endpoints; fill in the middle empirically.

### Q5. Improving accept rate / generation yield

Your ~0.1% accept rate at 6×6 hard (≈1,000 rejects/accept) is the signature of pure generate-and-test against a narrow band. The literature is unanimous that **constructive generation** is the fix:

- **CanCan's approach** (Scala, open source): generate a random Latin square → build an adjacency graph of cells → randomly partition into connected components (cages) with a size cap → assign operators → *then* filter puzzles with too many single-cell cages, and *then* solve to discard non-unique ones. CanCan ships a set of "over 40,000 KenKen puzzles of sizes ranging from 4x4 to 9x9 with unique solutions" (verbatim, `wpm.github.io/CanCan`), demonstrating pooling works at scale.
- **KSudoku's MathDoku generator** (`mathdokugenerator.h`, `cagegenerator.h`, Ian Wadham) pairs a cage generator with the DLX solver and rejects during carving using solver feedback rather than only at the end.
- **Sudoku "dig-hole" with difficulty target** (Li et al.; the fuxia distributed generator): start from a full solution and remove clues in a controlled order, checking uniqueness after each removal and stopping when the difficulty metric hits the target band. **The cage analogue**: start from a board that is *known gradable* (many single-cell givens), then iteratively (a) remove a single-cell given or (b) merge two adjacent small cages into one, re-running the fast uniqueness + grading check after each step, stopping when you enter the target score band. This walks *into* the band instead of sampling blindly.
- **Simulated annealing / hill-climbing on a difficulty objective**: define an objective = distance from target score band; propose local moves (merge/split cage, flip operator, add/remove given); accept moves that reduce distance. This is the standard technique for narrow-band puzzle generation and directly attacks the 1,000:1 waste.
- **Pooling / offline pre-generation**: for the hardest tiers, pre-generate a pool via the daily cron and serve from it. This is effectively what calcudoku.org and CanCan do. It fully decouples expensive hard-tier generation from interactive latency and is the pragmatic answer for Expert/Extreme.

## Recommendation on A / B / C (Q6)

**Ship Design C now; evolve to a modified Design A once a bounded-recursion T5 exists. Do not ship Design B.**

Reasoning:

- **Is a score band a defensible basis for named tiers without a technique/solve-path guarantee?** Yes — *conditionally*. It is exactly what HoDoKu does (weighted sum of step scores; a puzzle's level "cannot be smaller than the level of the hardest step contained… but it can be greater"), and empirical solve-rate rating (calcudoku.org) is even further from a solve-path guarantee, yet is the most respected difficulty metric in this exact puzzle family. The enjoysudoku community's own verdict is blunt — one poster: *"The Hodoku rating system is worth 0. The only generally accepted system is the Sudoku Explainer Rating"* — but SER is a *hardest-technique* rating, which is precisely what you *cannot* compute for 0-given 9×9 because your technique ladder tops out. So a weighted-sum score band is a legitimate, industry-standard basis **provided you (a) stop advertising the top tiers as pure-logic-solvable, and (b) calibrate the bands against real solve data.**

- **The risk of score-threshold tiers that are not solve-path guarantees** concentrates in two places: (1) **player trust** — if you label a puzzle "Expert, logic-only" and it actually requires guessing, solvers will notice and lose faith; (2) **leaderboard/streak fairness** — if "Extreme" boards vary wildly in actual human difficulty because the score doesn't track solvability, timed leaderboards and streaks become noisy and feel unfair. Both risks are *mitigated by adding a bounded-recursion tier*: once T5 exists, every accepted board has a *guaranteed* solve path (T1–T4 plus ≤D levels of counted guess-and-check), and you can honestly state the maximum guess-depth per tier.

- **Why C now**: it matches your shipped 4×4/6×6 (Easy/Medium/Hard), is fully interactive (all maxSize 3), needs no new solver, and avoids shipping a dishonest "Extreme." It buys time to build T5.

- **Why modified A next, not B**: B (all maxSize 3, 5 tiers) is honest but, as you note, Expert/Extreme look visually indistinguishable from Hard — and without T5 they'd be pure score bands carrying the trust risk above. A (top tiers at maxSize 4, offline cron) gives visual distinctiveness *and* isolates the expensive generation offline. But **modify A**: top-tier distinctiveness should come from **guess-depth (T5) and score band, not from maxSize 4**, because Q3 shows maxSize 4 costs ~13× for little difficulty gain. So the modified A is: 5 tiers, all *interactive* tiers at maxSize 3; Expert/Extreme generated *offline into a pool* and distinguished by score band + bounded-recursion depth; maxSize 4 used only optionally for cosmetic variety in the offline pool, never required.

## Staged implementation plan (slice-and-gate)

**Slice 0 — Ship Design C (3 tiers, maxSize 3, givens-driven).**
- Build: map Easy/Medium/Hard to single-cell-given-count bands using your existing curve (≈15 givens → Easy/gradable; fewer → harder), all maxSize 3, keep hard operator weights `{mul:3, add:2, sub:3, div:3}`.
- **Gate to proceed:** ≥ 95% of accepted Hard boards gradable by current T1–T4; interactive p95 generation < 250 ms; ≥ 24/25 Hard boards carry a − or ÷ cage (your existing A/B benchmark).

**Slice 1 — Faster uniqueness proving.**
- Build: precomputed cage-combination tables with geometric (line-repeat) pruning; add GAC `alldifferent` (Régin) propagation to the counting solver; keep `cap 2` early-abort. Optionally prototype a CP-SAT/OR-Tools or WASM backend for the cron path.
- **Gate:** ≥ 5× reduction in p95 verify time at maxSize 3, 0 givens (target < 6 ms vs current 28 ms p95); correctness parity with current solver on a regression set of ≥ 500 boards (identical unique/non-unique verdicts).

**Slice 2 — Constructive "dig-out" generation.**
- Build: start from a heavily-given, known-gradable board; iteratively remove givens / merge adjacent small cages, re-checking uniqueness + score after each step; stop on entering target band. Add simulated-annealing fallback for the narrow hard band.
- **Gate:** accept rate for Hard improves from ~0.1% to ≥ 5% (≥ 50× fewer rejects/accept); no regression in score-band distribution vs Slice 0.

**Slice 3 — Build bounded-recursion T5 (the Tatham transplant).**
- Build: after T1–T4 stall, invoke a counted guess-and-check: pick the min-remaining-values cell, hypothesize each candidate, propagate with T1–T4, close by contradiction or unique completion; record max depth D. Define T5-Nishio = depth-1; T5-Extreme = depth-2. Reject boards needing depth > 2 (or your chosen human-reproducibility ceiling). Instrument firing rates of pointing/claiming, region-sum, AIC, and pairwise cage-combination while you're in there.
- **Gate:** ≥ 90% of 0-given maxSize-3 boards now receive a *bounded* difficulty rating (depth ≤ 2); measured monotonic relationship between assigned depth-band and an external solve-time proxy on a human or solver panel.

**Slice 4 — Ship modified Design A (5 tiers) with offline pool.**
- Build: Easy/Medium/Hard interactive (maxSize 3); Expert/Extreme generated by the daily cron into a served pool, distinguished by score band + T5 depth; optional cosmetic maxSize-4 only in the offline pool.
- **Gate:** Expert/Extreme pool holds ≥ N days of buffer; player-facing copy states the honest guarantee ("solvable with logic plus at most one/two hypothesis steps"); leaderboard variance within a tier below an agreed threshold.

**Thresholds that would change the plan:** if Slice 1 fails to get verify under ~50 ms at maxSize 4, permanently abandon maxSize 4 for interactive use (confirming Q3). If Slice 3 shows depth-2 boards are not human-reproducible on your panel, cap T5 at depth-1 (Nishio) and keep only 4 named tiers. If constructive generation (Slice 2) cannot exceed ~2% accept for Hard, switch fully to offline pooling for Hard as well as Expert/Extreme.

## Caveats

- **Sourced fact vs inference.** The `keen.c` difficulty enum, the `MAXBLK 6` cap, the `latin_solver` dispatch line, and the NULL technique functions for EXTREME/UNREASONABLE are **verbatim from the ghewgill/puzzles mirror of `keen.c`** (© 2004–2021 Simon Tatham, MIT/Expat licence). The precise internals of `latin_solver_recurse()` and `latin_solver_forcing()` (MRV cell selection, depth handling, result codes `diff_impossible`/`diff_ambiguous`/`diff_unfinished`) are **corroborated from the puzzle manual and the keen.c call pattern, but `latin.c` itself could not be fetched** (robots.txt / URL-permission guards). Treat "recursion-depth-as-a-graded-tier" as a *reconstructed recommendation*, not verbatim Tatham behaviour — the manual language ("backtracking will be required… the solution should still be unique") suggests Tatham treats recursion as a *single* top tier rather than a finely graded depth, so grading by depth is *my recommended extension*.
- The billabob rating numbers (AIC 4.x, cage-combination 6.x, region-sum 3.x, pointing 1.2 / claiming 1.5) are **verbatim from that solver's published documentation**, but billabob explicitly calls the ratings "a work in progress and impermanent" — treat the exact numbers as indicative ordering, not gospel.
- calcudoku.org's 9.6% solve-rate figure and its solve-rate-based rating are **sourced verbatim** (Patrick Min, "10 Hardest Logic/Number Puzzles"); the claim that his star ratings are *calibrated to* solve rate is a reasonable inference from his stated methodology, not an explicit published formula.
- The "~13× verify cost" and gradability numbers are **your measurements**, restated; I have not independently reproduced them.
- Whether multi-line innies/outies and AIC "will fire" on your specific 0-given 9×9 boards is **reasoned inference** from technique structure and billabob's notes, not measured on your engine — the only way to know firing rates is to instrument your solver (folded into Slice 3). This is the single biggest open empirical question.
- CanCan's "over 40,000 puzzles" (verbatim) and KSudoku's DLX/cage architecture (verbatim from `dlxsolver.h`) are **sourced from their repos/docs**; I did not benchmark them against your engine.
- Régin 1994 full citation: Jean-Charles Régin, "A Filtering Algorithm for Constraints of Difference in CSPs," AAAI-94, Seattle, vol. 1, pp. 362–367.