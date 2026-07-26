# KenKen / Calcudoku / Mathdoku Difficulty Calibration: A Technical Reference for Procedural Generation

## TL;DR

- **What makes KenKen hard is candidate-branching per clue, not grid size alone.** The dominant levers are: how many single-cell "given" cages you seed, the maximum cage size, the number of valid digit combinations each clue admits, the operation mix (large multiplication and no-op cages are hardest), and — most decisively — the hardest *solving technique* required (naked/hidden singles → cage-line reduction → subsets/fish → row-sum/parity → chains → bifurcation).
- **The right way to rate difficulty is a graded logical solver**: run a technique-ordered solver, grade the puzzle by the hardest technique it needs, and re-roll until it lands in the target band. This is exactly what Simon Tatham's `keen.c` and the billabob KenKen grader do. Brute-force node counts and human solve-time/solve-rate data are secondary calibration signals.
- **Recommendation: make grid size AND technique-tier BOTH part of the ladder, but normalize tiers within each size.** A 9×9 "Easy" is genuinely harder in wall-clock terms than a 4×4 "Extreme," so "Extreme" should mean "requires the hardest techniques *for that size*," not an absolute cross-size constant.

## Key Findings

- **Primary source `keen.c` (Simon Tatham) uses 5 tiers**: Easy, Normal, Hard, Extreme, Unreasonable — gated by which solver deductions suffice, with Extreme/Unreasonable requiring recursion/backtracking. Subtraction and division cages are hard-coded to exactly 2 cells (`assert(n == 2)`). Max cage size `MAXBLK` = 6.
- **KSudoku's Mathdoku generator uses 5 tiers** (Very Easy, Easy, Medium, Hard, Diabolical) and exposes `maxSize`, `maxValue`, `maxCombos`, and singles counts as parameters; the user's report that only `maxCageSize` meaningfully scales is plausible and consistent with the header, though I could not read the `.cpp` body to confirm the other three are dead code.
- **A published SE-style technique-cost scale exists for KenKen** (billabob/kenkensolver): each technique has a numeric cost from 0 (naked single) up through 6+ (multi-cage brute force), and the puzzle is graded by the single hardest technique required.
- **Commercial tiers**: kenkenpuzzle.com (official Nextoy) offers 3×3–9×9 with "10 degrees of difficulty and your choice of math operations" (Easiest→Hard public tiers, premium Expert and No-Op), endorsed on-page by Will Shortz as "the most addicting puzzle since sudoku." calcudoku.org (Patrick Min) rates each puzzle in points and 0–5 stars; the hardest KenKen it ever published (a 9×9 on 2 Apr 2013) was solved by only 9.6% of its regular solvers.
- **KenKen is NP-complete** — stated by Bultel, Dreier, Dumas & Lafourcade, "Physical Zero-Knowledge Proofs for Akari, Takuzu, Kakuro and KenKen" (FUN 2016, arXiv:1606.01045): *"KenKen is known to be NP-complete,"* and the same paper confirms *"division and subtraction operators are restricted to cages of only two cells"* in most grids. The underlying Latin-square completion problem is NP-complete (Colbourn, 1984). So there is no known polynomial solver; generators must verify uniqueness with an actual solver and accept re-rolling.
- **No-op ("Mystery") cages add substantial difficulty** because the solver must also deduce the operator; calcudoku.org states *"The 'no-op' puzzles are sometimes called 'Mystery Calcudoku'"* and they are a first-class hard variant on both calcudoku.org and kenkenpuzzle.com.

## Details

### 1. What actually makes a KenKen puzzle hard

**Single-cell "freebie" cages (givens).** These are the single strongest, sharpest lever. A single-cell cage fixes one digit with no deduction, collapsing candidates in its row and column. Even a handful of them cascades: place enough and the whole puzzle falls to a "naked/hidden singles" sweep with no advanced logic. Consequently, hard puzzles use *zero or very few* single-cell cages, and easy puzzles use many. In `keen.c` there is no explicit "number of givens" knob — givens emerge naturally as size-1 leftovers — but the generation logic deliberately places dominoes with probability 3/4 to *minimize* leftover singletons, keeping easy freebies scarce.

**Max cage size and size distribution.** Larger cages admit many more digit combinations, so they carry less immediate information but create harder combinatorial reasoning once you must enumerate them. `keen.c` caps cage size at `MAXBLK = 6` and notes larger ones are "annoying in UI terms … and also in solver terms (too many possibilities to iterate over)." KSudoku makes `maxSize` (max cells per cage) the difficulty-scaling parameter. The practical pattern: small grids and easy tiers lean on 2-cell cages (which also enable −/÷); harder/bigger puzzles introduce 3-, 4-, and occasionally 5-cell cages.

**Cage shape (straight vs. L/T/zigzag).** This is subtle and important. A straight-line cage that lies entirely within one row or column is *more constraining*, because its cells cannot repeat (Latin-square rule forbids duplicates in a line), so the clue's combinations are all distinct-digit sets — fewer possibilities, easier. A bent cage (L, T, zigzag) spanning multiple rows and columns *permits repeated digits* (the KenKen multiset rule), which multiplies the candidate combinations and makes the clue less informative — harder. So non-linear geometry generally *increases* difficulty. `keen.c` builds irregular shapes by folding leftover singletons into neighbors, producing a natural mix.

**Number of candidate combinations per cage (maxCombos).** This is the quantitative core of difficulty: a clue that admits exactly one digit multiset is nearly a given; a clue admitting a dozen is a search problem. `keen.c` explicitly engineers this: it *avoids* addition clues whose sum is 3, 4, 2w−1, or 2w−2 "because they're too easy — they only leave one option," and above Normal difficulty it *prefers* multiplication clues that "leave multiple options open" (rejecting products with ≤2 factor options when diff > Normal). KSudoku exposes `maxCombos` as an explicit ceiling.

**Operation mix.** Ranked roughly easy→hard:

- **Subtraction / division (2-cell):** easiest — few combinations, order-independent target.
- **Addition:** easy-to-moderate; combination count grows with cage size but arithmetic is intuitive.
- **Multiplication:** hardest of the standard operators, because large products force prime-factorization reasoning and admit many factor splits (e.g., a large product in a 3-cell cage). A clue like "360" essentially forces multiplication and factor enumeration.
- **No-op:** hardest of all — operator omitted, so the solver enumerates *all* operators consistent with the target.

**Clue magnitude.** Extreme (very large or very small) targets tend to be *easier* because they pin down combinations (max/min sums/products have unique multisets); mid-range targets admit the most combinations and are hardest. `keen.c`'s avoidance of sums 3/4/2w−1/2w−2 is exactly this principle.

**Cage adjacency / clustering.** Adjacent hard cages compound difficulty because cross-cage combination reasoning (the "cage combinations" technique) becomes necessary: two neighboring cages jointly constrain each other. The billabob solver's highest-cost techniques are precisely multi-cage combination checks. Clustering high-combination cages is a legitimate difficulty amplifier.

**Advanced technique requirement.** The deepest lever. In ascending order the recognized KenKen techniques are: naked singles → hidden singles → cage-line reduction (pointing/claiming) → naked/hidden pairs & triples → X-wing/swordfish/jellyfish (fish) → row/column-sum logic ("rule of N": every line sums to N(N+1)/2, e.g. 21 in a 6×6) → innies/outies and cage splitting → parity arguments → AIC/forcing chains → multi-cage combination brute force → guessing/bifurcation. A puzzle is "hard" exactly insofar as it *requires* techniques high on this list. Harold Reiter's seminar notes (UNC Charlotte, cited by the Berkeley Math Circle handout) and Reiter, Thornton & Vennebush, "Using KenKen to Build Reasoning Skills" (*Mathematics Teacher* 107(5):341–347, 2013) are the canonical teaching sources for the parity/counting/subset techniques.

### 2. Solver-based difficulty rating

Four approaches are used in practice, in rough order of quality:

**(a) Weighted / hardest-technique scoring (best).** The billabob KenKen grader implements an SE-style hierarchy and grades by the hardest technique required (regardless of how many times used). Its published costs: 0 = constraint propagation & naked single; 1 = hidden single; 1.2 = cage-region intersection (pointing); 1.5 = claiming; 2 = hidden pair / X-Wing; 2.1 = hidden triple / swordfish; 2.2 = hidden quad / jellyfish; 3 = region parity / region sum; 3.1–3.5 = multi-region parity/sum variants; 4–4.9 = AIC (forcing chains, scaled by number of strong links); 6+ = combination of N cages (brute-force subdivision). Tom Davis's `kengen` similarly "keeps track of how many of the harder techniques are required."

**(b) Constraint-propagation depth / guess count.** `keen.c` embodies this: Easy/Normal/Hard each add a class of logical deduction; Extreme and Unreasonable have *no* dedicated deduction function (`NULL` in the `DIFFLIST` macro) and instead require the general `latin_solver`'s recursion/backtracking — Extreme = "some" backtracking, Unreasonable = more. Crucially, `keen.c` determines a puzzle's tier by solving it at a level *and re-solving one level down to confirm that fails*, guaranteeing the tier is the *minimum* sufficient difficulty.

**(c) Brute-force search-node counts.** A raw count of DLX/backtracking nodes correlates with difficulty and is cheap, but it conflates "needs a clever technique" with "needs a lot of bookkeeping," so it is best used as a secondary sanity check, not the primary grader.

**(d) Human-calibrated time/solve-rate data.** calcudoku.org's empirical solve-rate is the gold standard for *perceived* difficulty (its hardest-ever 9×9 was solved by just 9.6% of regulars). Rough human solve times (PlayBrain): 4×4 ≈ 3–5 min, 5×5 ≈ 5–10 min, 6×6 ≈ 10–20 min, 9×9 ≈ 30+ min.

**Mapping Sudoku rating systems onto KenKen.** The SE / Sudoku Explainer "hardest-step" philosophy and Hodoku's weighted-sum philosophy both transfer directly — the billabob grader is explicitly modeled on the SE scale. sudoku.coach / Sudoku Exchange rate by hardest technique; Hodoku sums weighted move costs. The KenKen-specific additions are the *cage-combination* and *arithmetic-parity* techniques, which have no Sudoku analog and must be inserted into the ladder (billabob places them at 3.x and 6+).

### 3. Reference implementations

**Simon Tatham's "Keen" (`keen.c`) — read directly.** Confirmed from source:

- Difficulty enum via `DIFFLIST(A)` macro: `EASY (solver_easy)`, `NORMAL (solver_normal)`, `HARD (solver_hard)`, `EXTREME (NULL)`, `UNREASONABLE (NULL)`.
- `MAXBLK 6` — hard max cage size.
- Presets ship: 4×4 Easy, 5×5 Easy, 6×6 Easy, 6×6 Normal, 6×6 Hard, 6×6 Extreme, 6×6 Unreasonable, 9×9 Normal. This is a strong hint about which size/difficulty combos the author considers reasonable defaults.
- SUB and DIV clues: `assert(n == 2)` — always two cells, and their two digits "can never be the same."
- Cage generation: first places dominoes at random with probability 3/4 (`random_upto(rs, 4)` nonzero), then folds remaining singletons into neighboring blocks of size `< MAXBLK`; if any singleton can't be placed, it discards and restarts.
- Clue-quality heuristics (verbatim logic): addition sums of 3, 4, 2w−1, 2w−2 are flagged "too easy — they only leave one option"; multiplication clues with ≤2 factorizations are demoted above Normal difficulty; a subtraction difference of w−1 is completely avoided; division quotients strictly greater than w/2 are never used ("too easy but also inelegant").
- Easy solver: ORs all a clue's possible values into every cell (no positional tracking). Normal: tracks per-cell candidates. Hard: cross-box deductions — finds digits forced into a row/column by a cage and eliminates them elsewhere in that line.
- 3×3 puzzles at Hard or above are "not generable" and are silently dialed down to Normal.

**KDE KSudoku (`mathdokugenerator` / `cagegenerator`).** Confirmed from `cagegenerator.h` (©2015 Ian Wadham, GPL-2+):

- Member variables: `mSingles` ("number of 1-cell cages (clues)"), `mMinSingles` ("minimum number required"), `mMaxSingles` ("maximum number required"), `mMaxCombos` ("maximum combos a cage can have").
- `makeCages(SKGraph*, QList<int>*, int maxSize, int maxValue, bool hideOperators, int maxCombos)` — the four difficulty knobs are `maxSize`, `maxValue`, `maxCombos`, and singles counts.
- Return contract: number of cages, or `0` (too many failures to make an acceptable cage) or `-1` (no unique solution — caller must retry). The DLX solver verifies uniqueness.
- SUB/DIV restricted to 2-cell cages (explained in the header: order-dependence, "6−(4−1)=3 but (6−4)−1=1"); Mathdoku applies Latin rules to rows/columns only (no box), so "a Mathdoku puzzle can have any size from 3×3 up to 9×9."
- Mathdoku difficulty ladder (from KSudoku docs/handbook and dev history): Very Easy, Easy, Medium, Hard, Diabolical.
- **On the "dead code" claim:** the header confirms `maxValue`, `maxCombos`, and `mMaxSingles` all *exist* as parameters/members. I was unable to read `mathdokugenerator.cpp`/`cagegenerator.cpp` bodies directly (GitHub raw and invent.kde.org were not fetchable in this session, and a dedicated sub-search also could not retrieve the `.cpp` bodies), so I cannot independently verify that only `maxCageSize` varies with difficulty while the others are constants/unused. The user's finding is plausible and consistent with the header, but I flag it as **unverified against the `.cpp` source** rather than confirmed.

**Open-source generators/solvers.** Tom Davis's `kengen` (geometer.org "KenKen For Teachers"): generates a random Latin square, then cages by randomly merging adjacent cells subject to a max-cage-size parameter, grading by how many hard techniques are needed. wpm/CanCan (Scala) is a solver+generator. billabob/kenkensolver (JS) is the most sophisticated open grader, imports Tatham puzzle IDs, and publishes its full technique-cost table.

**Commercial sites.** kenkenpuzzle.com (official Nextoy/Miyamoto), verbatim: "you can design your own puzzles, with grid sizes ranging from 3x3 to 9x9, with 10 degrees of difficulty and your choice of math operations"; public tiers Easiest→Hard, premium Expert, plus No-Op puzzles; larger grid ≈ harder. calcudoku.org (Patrick Min): regular sizes up to "10x10 (every Tuesday and Friday) and 12x12 (every Sunday and Thursday)," each puzzle rated in points + 0–5 stars, empirically calibrated by solver success rate; "no-op" = "Mystery Calcudoku." krazydad "Inkies": 5×5/6×6/7×7/8×8, Beginner/Easy/Mixed, books ordered by ascending difficulty (Book 1 easiest → Book 100 "insanely difficult"). Newspaper KenKen (NYT/Times, Boston Globe) typically publishes 4×4 easy and 6×6 intermediate dailies.

**Academic.** KenKen is NP-complete (Bultel, Dreier, Dumas & Lafourcade, FUN 2016, arXiv:1606.01045, which also confirms the near-universal 2-cell restriction on −/÷); underlying Latin-square completion is NP-complete (Colbourn, *Discrete Applied Mathematics* 8(1):25–30, 1984). Practical implication: no polynomial solver exists, so (i) always verify uniqueness with a real solver, and (ii) bound cage size/combination count to keep generation tractable.

### 4. Recommended parameter tables (see dedicated section below)

### 5. Practical generation strategy

**Cage-generation termination.** The `keen.c` pattern is the proven approach: place 2-cell cages first (probabilistically), then greedily fold leftover singletons into any neighbor below the size cap; if a singleton is stranded (all neighbors full), *discard the whole layout and restart* rather than trying to patch it. This avoids the pathological "last cell can't join anything" loop. Cap attempts (KSudoku returns `0` after "too many failures").

**Guaranteeing unique solutions.** Generate solution grid (random Latin square) → lay cages → assign clues → run a solver that (a) confirms exactly one solution and (b) reports the hardest technique used. If not unique, re-roll clues or cages. Both `keen.c` and KSudoku do exactly this; KSudoku's `-1` return means "no unique solution, retry."

**Landing in the right band.** Grade with the logical solver; if the puzzle is too easy, re-roll clue *operators/targets* (cheap) before re-rolling cage *geometry* (expensive). Tatham's trick of confirming the puzzle is *unsolvable one tier down* is the key to a tight, non-overlapping ladder.

**Expected cost.** For ≤6×6 generation is milliseconds–seconds; the bottleneck for hard/large puzzles is the uniqueness+grading solve, which grows with cage combination counts (the billabob author flags "very large cages" as the major performance weakness because candidate enumeration explodes). Bound max cage size (≤4–5) and max combinations per cage to keep it fast.

**Pitfalls:** (i) too many single-cell cages or extreme-valued clues → trivial singles cascade; (ii) a single large cage with a mid-range target → combinatorial blow-up in the solver; (iii) all-addition puzzles feel flat (Killer-like); (iv) degenerate no-op cages whose target is achievable by multiple operators *and* multiple multisets can push a puzzle past unique-solvability.

### 6. How difficulty scales with grid size

Yes — a 9×9 "Easy" is harder in raw time/effort than a 4×4 "Extreme," because the candidate space and number of cages grow quadratically. Two design philosophies:

- **Absolute (cross-size constant):** "Hard" always means the same technique ceiling regardless of size. Clean semantics, but a 9×9 "Easy" will still take a beginner 30+ minutes, so labels mislead.
- **Per-size normalized:** "Hard" means "the hard end of *this* size." Matches how kenkenpuzzle.com and calcudoku.org actually work (points scale with both size and star rating).

**Recommendation: per-size normalized tiers, with size itself as a coarse outer ladder.** Concretely: define the technique ceiling per (size, tier) so that "9×9 Easy" requires only singles/cage-line logic (but over a big grid) while "4×4 Extreme" requires the hardest techniques available at that tiny size. Surface both the size and the tier to the player. This is the least-surprising design and matches industry practice.

### 7. Prime-sized grids (5×5, 7×7) and the absence of box constraints

Because KenKen (unlike Sudoku) has *no box constraint* — only row/column Latin rules — any N works, including primes. This is the single biggest tuning difference from Killer Sudoku:

- **Fewer constraints per cell** means KenKen relies more heavily on cage-arithmetic deductions and less on geometric (box) elimination. Killer Sudoku's signature "45-rule per box" becomes the "rule of N per line" in KenKen (line sum = N(N+1)/2), and box-based innies/outies are replaced by line-based ones.
- **Prime sizes (5×5, 7×7)** behave no differently structurally from composite sizes in KenKen — there is no box to break — so you can offer a smooth 4→5→6→7→8→9 ladder. This is *impossible* in classic Sudoku (which needs N to be a perfect square or at least factorable into box dimensions).
- **Tuning consequence:** because there is no box to add redundant constraint, KenKen puzzles of a given size are on average slightly *harder* to make uniquely solvable with few givens than Killer Sudoku of the same size, so expect to lean more on cage-combination diversity and to allow a few more singles at the easy end.

## Recommended parameter tables

These tables are a **reasoned engineering recommendation** synthesized from the sourced facts above (keen.c's presets, clue heuristics, and MAXBLK; KSudoku's maxSize-driven scaling; billabob's technique ladder; calcudoku/kenkenpuzzle tiering; and human solve-time data). Where the literature gives no hard number, the value is my recommendation and is flagged. Grid cell counts: 4×4 = 16, 5×5 = 25, 6×6 = 36, 7×7 = 49, 9×9 = 81.

**Legend for technique ceiling (billabob-style cost):** T1 = singles only; T2 = + cage-line reduction (pointing/claiming); T3 = + naked/hidden pairs/triples & simple fish; T4 = + line-sum ("rule of N"), innies/outies, parity; T5 = + AIC/forcing chains / multi-cage combination / limited bifurcation.

### 4×4 (digits 1–4; 16 cells)

| Tier | Single-cell cages | Max cage size | Size mix (2/3/4/5+) | Operations | −,÷ 2-cell only | Max combos/cage | Technique ceiling | Target time |
|---|---|---|---|---|---|---|---|---|
| Easy | 3–4 (≈20–25%) | 2 | 90/10/0/0 | +,−,÷ (no ×) | Yes | ≤3 | T1 | <1 min |
| Medium | 2 (≈12%) | 3 | 70/30/0/0 | +,−,×,÷ | Yes | ≤4 | T1–T2 | 1–2 min |
| Hard | 1 (≈6%) | 3 | 55/40/5/0 | +,−,×,÷ | Yes | ≤6 | T2–T3 | 2–4 min |
| Expert | 0–1 | 4 | 45/40/15/0 | +,−,×,÷ | Yes | ≤8 | T3 | 4–7 min |
| Extreme | 0 | 4 | 40/40/20/0 + some no-op | +,−,×,÷, no-op | Yes | ≤10 | T3–T4 | 7–12 min |

### 5×5 (digits 1–5; 25 cells)

| Tier | Single-cell cages | Max cage size | Size mix (2/3/4/5+) | Operations | −,÷ 2-cell only | Max combos/cage | Technique ceiling | Target time |
|---|---|---|---|---|---|---|---|---|
| Easy | 4–5 (≈18%) | 2 | 85/15/0/0 | +,−,÷ | Yes | ≤4 | T1 | 1–2 min |
| Medium | 2–3 (≈10%) | 3 | 65/33/2/0 | +,−,×,÷ | Yes | ≤6 | T2 | 3–5 min |
| Hard | 1 (≈4%) | 3 | 50/42/8/0 | +,−,×,÷ | Yes | ≤8 | T2–T3 | 5–9 min |
| Expert | 0–1 | 4 | 42/40/16/2 | +,−,×,÷ | Yes | ≤10 | T3–T4 | 9–15 min |
| Extreme | 0 | 4 | 38/40/20/2 + no-op | +,−,×,÷, no-op | Yes | ≤12 | T4 | 15–25 min |

### 6×6 (digits 1–6; 36 cells)

| Tier | Single-cell cages | Max cage size | Size mix (2/3/4/5+) | Operations | −,÷ 2-cell only | Max combos/cage | Technique ceiling | Target time |
|---|---|---|---|---|---|---|---|---|
| Easy | 4–6 (≈14%) | 2–3 | 80/18/2/0 | +,−,÷ | Yes | ≤6 | T1 | 3–5 min |
| Medium | 2–3 (≈8%) | 3 | 60/35/5/0 | +,−,×,÷ | Yes | ≤8 | T2 | 6–10 min |
| Hard | 1 (≈3%) | 4 | 48/40/11/1 | +,−,×,÷ | Yes | ≤10 | T3 | 10–18 min |
| Expert | 0 | 4 | 42/40/16/2 | +,−,×,÷ | Yes | ≤14 | T3–T4 | 18–30 min |
| Extreme | 0 | 5 | 38/38/20/4 + no-op | +,−,×,÷, no-op | Yes | ≤18 | T4–T5 | 30–50 min |

### 7×7 (digits 1–7; 49 cells)

| Tier | Single-cell cages | Max cage size | Size mix (2/3/4/5+) | Operations | −,÷ 2-cell only | Max combos/cage | Technique ceiling | Target time |
|---|---|---|---|---|---|---|---|---|
| Easy | 5–7 (≈12%) | 3 | 72/25/3/0 | +,−,÷ | Yes | ≤8 | T1–T2 | 6–10 min |
| Medium | 3–4 (≈7%) | 3 | 55/38/7/0 | +,−,×,÷ | Yes | ≤10 | T2 | 10–18 min |
| Hard | 1–2 (≈3%) | 4 | 45/40/14/1 | +,−,×,÷ | Yes | ≤14 | T3 | 18–30 min |
| Expert | 0–1 | 4 | 40/40/18/2 | +,−,×,÷ | Yes | ≤18 | T4 | 30–45 min |
| Extreme | 0 | 5 | 36/38/22/4 + no-op | +,−,×,÷, no-op | Yes | ≤24 | T4–T5 | 45–70 min |

### 9×9 (digits 1–9; 81 cells)

| Tier | Single-cell cages | Max cage size | Size mix (2/3/4/5+) | Operations | −,÷ 2-cell only | Max combos/cage | Technique ceiling | Target time |
|---|---|---|---|---|---|---|---|---|
| Easy | 6–9 (≈9%) | 3 | 65/30/5/0 | +,−,÷ | Yes | ≤10 | T1–T2 | 12–20 min |
| Medium | 3–5 (≈5%) | 4 | 50/38/11/1 | +,−,×,÷ | Yes | ≤14 | T2–T3 | 20–35 min |
| Hard | 1–2 (≈2%) | 4 | 42/40/16/2 | +,−,×,÷ | Yes | ≤20 | T3 | 35–55 min |
| Expert | 0–1 | 5 | 38/38/20/4 | +,−,×,÷ | Yes | ≤28 | T4 | 55–80 min |
| Extreme | 0 | 5 | 34/36/24/6 + no-op | +,−,×,÷, no-op | Yes | ≤36 | T4–T5 | 80+ min |

**Notes on the tables:**

- **Keep −/÷ strictly 2-cell** at every size and tier. This is the near-universal convention (keen.c `assert(n==2)`; KSudoku header; calcudoku.org; confirmed by the FUN 2016 paper) because order-dependence makes ≥3-cell −/÷ ill-defined.
- **Operation mix is a target, not a hard constraint** — the generator should aim for roughly even use of the enabled operators (keen.c explicitly tries "to keep the numbers of each type even") and re-roll clue types to hit it.
- **Introduce × at Medium and above**; keep Easy to +,−,÷ (× forces factor reasoning that is a difficulty step).
- **Introduce no-op only at the top tier** (Extreme) as a distinct hard variant, and consider surfacing it as its own labeled mode rather than silently mixing it in.
- **"Max combos/cage" scales with grid size** because a size-N grid has more digits, so a size-3 cage naturally admits more combinations; the numbers above bound the *worst* cage, not the average.

## Staged Recommendations (mapped to a K0–K5 slice plan)

- **K0 — Correctness foundation (do first).** Implement the multiset cage rule (duplicates legal in a cage unless same row/col), a Latin-square solution generator, and cage-target computation for +,−,×,÷. Restrict −/÷ to 2-cell cages from day one. Benchmark: generate a valid, fully-clued grid whose stated clues match the solution.
- **K1 — Uniqueness gate.** Add a solver that confirms exactly one solution (DLX or backtracking + constraint propagation). Reject/re-roll non-unique puzzles. Benchmark: 100% of shipped puzzles have a unique solution; generation success rate > 90% within N attempts.
- **K2 — Cage-geometry generator with termination.** Port the keen.c strategy: probabilistic 2-cell placement (p≈0.75), fold singletons into sub-max neighbors, discard-and-restart on stranded cells, cap max cage size per tier. Benchmark: no infinite loops; median generation < 100 ms for ≤6×6.
- **K3 — Graded logical solver (the difficulty engine).** Implement techniques in billabob order: singles (T1) → cage-line reduction (T2) → subsets/fish (T3) → rule-of-N/innies-outies/parity (T4) → chains/multi-cage/bifurcation (T5). Grade each puzzle by hardest technique required, confirming it fails one tier down. Benchmark: reproduce keen.c's Easy/Normal/Hard classification on imported keen puzzle IDs.
- **K4 — Tier calibration & re-roll loop.** Wire the parameter tables above into per-(size,tier) generation; re-roll clue operators/targets first, then geometry, until the grade lands in-band. Ship 4×4 and 6×6 first (they match newspaper/keen presets and calibrate fastest), then 5×5, 7×7, 9×9. Benchmark: ≥95% of generated puzzles fall in their target band; spot-check human solve times against the table.
- **K5 — Advanced variants & telemetry.** Add no-op ("Mystery") cages as the Extreme-tier / dedicated mode, add larger grids (8×8, 10×10+) if desired, and log real solve times / abandonment to empirically recalibrate bands (the calcudoku.org solve-rate method). Benchmark: observed solve-rate curves monotonic across tiers within each size.

**Thresholds that would change the plan:** if generation-with-grading exceeds ~1–2 s per 9×9 puzzle, tighten max-combos/max-cage-size before optimizing the solver; if observed human solve-rate for a tier overlaps the adjacent tier by >20%, widen the technique-ceiling gap between them; if a tier's puzzles routinely need bifurcation (T5) you've overshot — pull max cage size or combos down.

## Caveats

- **Sourced vs. inferred.** The keen.c constants (MAXBLK=6, the 5 tiers, the 3/4 domino probability, the SUB/DIV 2-cell assertion, the clue-quality heuristics, the tier-confirmation-by-re-solve method) are **read directly from source**. The billabob technique-cost numbers, the calcudoku 9.6% solve-rate figure, the kenkenpuzzle "10 degrees" tiering, the NP-completeness statement (FUN 2016 / arXiv:1606.01045), and human solve-time ranges are **sourced from those sites/papers**. **The five parameter tables are my reasoned engineering recommendation**, not published constants — no primary source publishes per-(size,tier) tables for givens count, size mix, or max-combos, so treat those numbers as a well-grounded starting point to calibrate empirically, not as ground truth.
- **KSudoku "dead code" claim is unverified.** I confirmed from `cagegenerator.h` that `maxValue`, `maxCombos`, and `mMaxSingles` exist as parameters/members and that `makeCages` takes `maxSize`/`maxValue`/`maxCombos`. I could **not** read `mathdokugenerator.cpp` or `cagegenerator.cpp` bodies in this session (both a direct fetch and a dedicated sub-search failed to retrieve the `.cpp` source), so I cannot independently confirm that only `maxCageSize` actually scales with difficulty while the others are dead code. The user's finding is plausible and consistent with the header but should be re-verified against the `.cpp` source — likely raw URLs to try in your own environment are `raw.githubusercontent.com/KDE/ksudoku/master/src/generator/mathdokugenerator.cpp` and `.../cagegenerator.cpp`.
- **NP-completeness is cited via the FUN 2016 physical-ZKP paper**, which states the result and cites three prior references, plus the Latin-square-completion result of Colbourn (1984); I did not locate a single standalone "KenKen is NP-complete" theorem paper, though the result is widely stated. The practical implications (verify uniqueness with a solver; bound cage size for tractability) hold regardless.
- **Technique-ladder ordering is not universally standardized** — billabob explicitly notes its rankings/weights are "a work in progress" and will change. Use it as a strong template, but expect to tune the exact ordering (especially where parity vs. fish vs. chains fall) against your own solve-time telemetry.
- **Target solve times are order-of-magnitude estimates** drawn from one hobbyist source (PlayBrain) plus calcudoku solve-rate context; they will vary widely by solver skill and should be replaced by your own telemetry in K5.
