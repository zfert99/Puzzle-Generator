# Implementing Kakuro / "Cross Sums" in Puzzle Lab: A Deep Technical Research Report

## TL;DR

- **You can almost certainly use the name "Kakuro" — the trademark premise is weaker than the KenKen situation.** Nikoli's two U.S. "KAKURO" word-mark registrations (serials 78761060 and 78761064, both filed 2005-11-26) were **abandoned on 2007-07-31 for failure to respond**, so there is no live U.S. registration for the puzzle-type name. "Cross Sums" (coined 1966 by Dell's Jacob E. Funk) remains the fully generic, zero-risk fallback. Recommendation: ship as **"Kakuro (Cross Sums)"** — get the SEO of "Kakuro" while keeping the generic term visible — after a counsel check for common-law/foreign marks. [strong]
- **Difficulty is driven by run-length/combination-space structure, not clue count, and it does NOT scale like Sudoku** — small dense grids can be fiendish and large grids can be "singles-only" yet take hours. Calibrate tiers *within* a grid size (your Keisan principle is exactly right), using a human-technique ladder plus solver instrumentation (candidate branching, technique depth, guess count). [strong/moderate]
- **Generation is dramatically harder than solving** (finding-another-solution is ASP-complete, Yato–Seta 2003). Use a solution-first constructive pipeline: symmetric black-cell layout → valid digit fill → derive clues → erase/verify with a counting solver that early-terminates at 2 solutions. Naive random generation is empirically hopeless even at 10×10. [strong]

## Key Findings

1. **Naming/trademark.** Kakuro = "Cross Sums," invented 1966 by Canadian Jacob E. Funk at Dell Magazines; first appeared in the **April/May 1950 issue of Dell's *Official Crossword Puzzles*** (Funk was "a building constructor who contributed to Dell's puzzle magazines"). Maki Kaji imported it to Japan in 1980 as "kasan kurosu," renamed "Kakuro" in 1986; Nikoli had sold ~1 million Kakuro books by 2005. **The U.S. "KAKURO" word marks are abandoned (2007);** "Cross Sums" is the safe generic name. [strong]

2. **Rules are simple; the engineering interest is the combination structure.** Digits 1–9, no repeat within a run, runs bounded by black cells/edges, each run clue = sum. Standard conventions: no 1-cell runs, symmetric black layout, every white cell in both an across and a down run, connected white region. [strong]

3. **The full sum-combination table is tiny — precompute it at build time.** Exactly 2⁹−1 = 511 non-empty subsets of {1..9}; grouped by length the counts are 9, 36, 84, 126, 126, 84, 36, 9, 1 (lengths 1–9). The entire (length, sum)→bitmask table fits trivially in memory. [strong]

4. **Kakuro is NP-complete** (Seta 2002; new-variant proof Ruepp & Holzer, FUN 2010), and **finding another solution is ASP-complete** (Yato & Seta, IEICE 2003) — the formal reason uniqueness checking is the expensive step in generation. [strong]

5. **Difficulty ladder** is technique-based (unique combos → intersection → naked/hidden singles/pairs → residual-sum forcing → disconnection/"surface" sums → chains/whips → bounded T&E), verified per-tier with solver instrumentation. Berthier's PBCS work shows Kakuro's hardest instances genuinely require g-whips/chains, not just Sudoku transplants. [strong/moderate]

## Details

### 1. Rules and formal definition

**Canonical rules.** A Kakuro grid is a rectilinear grid of black (filled/clue) and white (entry) cells. White cells are partitioned by black cells and edges into maximal horizontal and vertical **runs** (a.k.a. "entries," "words," "sectors"). Each run has a **clue** = required sum, in the black cell immediately left (across) or above (down). Fill each white cell with a digit 1–9 so that (a) each run sums to its clue and (b) no digit repeats within a run. There is **no** global row/column or box constraint (unlike Sudoku) — the only constraints are per-run **sum** + per-run **alldifferent**. A well-posed puzzle has a unique solution reachable by logic alone. [strong]

**Notation.** "(sum)-in-(length spelled out)": "16-in-two," "24-in-three." A 9-cell run is just "45" (forced to {1..9}). [strong]

**Conventions and variants.**

- **Minimum run length:** By near-universal convention runs are length ≥2; single-cell runs are "mathematically trivial" and essentially never clued (gmpuzzles' Grandmaster Kakuro rules: "single digit entries are rarely present and never clued"). [strong]
- **Maximum run length:** 9 (digit alphabet). A 9-run is forced to {1..9}.
- **Digits:** Always 1–9; no 0, no digits >9 in standard Kakuro. Variants: "Krypto Kakuro"/cross-figure hybrids and the WPC-wiki "Skel Maths" allow multi-digit concatenation (e.g., 24-in-three as 5+19); "gen-Kakuro" (academic benchmark) assigns per-cell weights making runs weighted linear sums. Out of scope for a standard build. [strong]
- **"No repeated combination in grid":** At least one publisher (Keesing/Denksport) adds that a given digit-combination may only be used once per grid, still marketing it as plain Kakuro. Nonstandard — don't adopt by default. [moderate]
- **Naming history:** "Cross Sums" (Funk, 1966; first Dell print April/May 1950) → "kasan kurosu" (Nikoli, 1980) → "Kakuro" (1986). Kakuro was Nikoli's best-selling puzzle 1986–1992, dropping to #2 behind Sudoku in 1993 (WMC Publishing; Wikipedia dates the crossover to 1992 — minor source discrepancy). [strong]

**Trademark analysis (directly answering your KenKen→Keisan concern).**

- **The U.S. "KAKURO" word marks are ABANDONED.** Nikoli filed two registrations (Justia serials **78761060** for puzzle books and **78761064** for publishing services), both on **2005-11-26**. Both show **"Status: 602 – Abandoned-Failure To Respond Or Late Response," status date 2007-07-31.** So there is *no live U.S. registration* on the puzzle-type name "Kakuro." This materially weakens the trademark exposure compared with KenKen (which is a **live** registration held by KenKen Puzzle LLC / Nextoy). [strong]
- **Nikoli's related marks:** the "NIKOLI.COM" mark (serial 77557013) is cancelled (Section 8, 2019-12-13); the "NIKOLI" word mark remains active; and Nikoli filed a fresh application **2024-12-20 (serial 98915641)** for "Printed books in the field of puzzles and games." So Nikoli is still actively protecting the *NIKOLI* brand, but not the *KAKURO* term in the U.S. [strong]
- **Residual caution:** abandonment of a U.S. registration does not extinguish (a) common-law rights from continued use, or (b) foreign registrations (EU/JP) — which I did not verify. The KenKen→Keisan precedent shows you're appropriately conservative, so: **ship as "Kakuro (Cross Sums)"** to capture the search term while keeping the generic name prominent, and have counsel do a quick common-law/foreign clearance. If counsel is cautious, "Cross Sums" alone is bulletproof (Funk's descriptive coinage; not held as a puzzle-type mark). [moderate]

**Grid conventions.**

- **Published sizes vary widely.** Wikipedia: "usually 16×16" for classic Nikoli style but "dimensions can vary widely." Conceptis ships up to 22×22 plus Samurai (5-grid) Kakuro; Krazydad standard booklets are 13×17; academic sources cite "smallest interesting ~5×5, giant 30×30, typical for humans ~9–15 square." [strong]
- **The "N×N" ambiguity is real — pick a convention.** Some sites count the all-black top row + left column (so a 9×9 *interior* is called 11×11); others drop the dead row/column and print crossword-style with numbered clues. On enjoysudoku a user complained a site's "11×11" puzzles were "actually 9×9 — the all-dark rows and columns aren't supposed to count." **Recommendation: name puzzles by interior playable bounding box** ("9×9" = 9×9 white-region area), and document it. [strong]
- **Black-cell density & layout.** 180° rotational symmetry is most common; the "edges-inward" template method produces diagonal mirror symmetry. gmpuzzles: "a symmetric layout of black cells or an interesting visual theme." Symmetry is a strong aesthetic convention, not a logical requirement. [strong]
- **"No isolated white regions" / "every white cell in both runs":** Near-hard requirements in practice — a white cell with only one run implies a forbidden 1-cell run in the other direction. Layouts that split the grid into near-independent regions are legal but boring (Berthier: "almost closed regions… trivially cut the puzzle into several almost independent pieces"). White-region connectivity is a quality requirement, not a formal rule. [moderate]

### 2. Solving techniques, ordered by difficulty

The technique ladder used by humans and difficulty-rating solvers, easiest→hardest:

1. **Unique (forced/"magic") combinations.** (length, sum) pairs with exactly one digit set — the bootstrap/entry points. Canonical: 3-in-2={1,2}; 4-in-2={1,3}; 16-in-2={7,9}; 17-in-2={8,9}; 6-in-3={1,2,3}; 7-in-3={1,2,4}; 23-in-3={6,8,9}; 24-in-3={7,8,9}; 10-in-4={1,2,3,4}; 30-in-4={6,7,8,9}; and always-forced 45-in-9. [strong]
2. **Intersection / cross-referencing.** Textbook first move: a 3-in-2 ({1,2}) crossing a 4-in-2 ({1,3}) forces the intersection = 1 (only common digit). Generalizes to intersecting each cell's across-candidate-set with its down-candidate-set. [strong]
3. **Naked singles** (one candidate) and **hidden singles** (a digit placeable in only one cell of a run). [strong]
4. **Naked/hidden pairs & triples** within a run. Wikipedia's example: two 4-in-2 clues crossing a longer run pin its 1 and 3. [strong]
5. **Sum-based / min-max elimination (single-sector arithmetic).** For a 3-in-16 with candidates {1,4},{3,5,7},{6,7,9}, "can cell 2 be 7?" — no, because no pair from cells 1&3 sums to 9. Core propagation, *not* trial-and-error. [strong]
6. **Residual-sum bookkeeping.** After filling some cells, subtract from the clue and treat the remainder as a shorter run → re-look-up combinations. [strong]
7. **Limited-solution-set reasoning.** 30-in-7 has only {1,2,3,4,5,6,9} and {1,2,3,4,5,7,8}; a crossing 17-in-2 forcing a cell to {8,9} selects the set and eliminates those values elsewhere (Wikipedia worked example). [strong]
8. **"45 rule" analogue — mostly absent; replaced by region/disconnection sums.** Kakuro has **no** clean Sudoku "45 rule" because runs don't tile complete rows/boxes (ThePuzzleLabs states this explicitly). The genuine aggregate technique is the **"box technique" / "surface sums" / "disconnection zones"**: sum the across-clues over a bounded region, subtract overlapping down-clues; since addition is associative/commutative, the difference reveals a partial entry — often a single cell. enjoysudoku formalizes: a white cell whose removal disconnects a region = "singularity" (gives the cell value); "doubularity" (gives sum or difference of two cells). This is the Kakuro equivalent of Killer Sudoku innies/outies. [strong]
9. **Locked candidates / pointing** across runs. [moderate]
10. **Chains, X-wing-like patterns, forcing chains, whips/g-whips.** Denis Berthier's *Pattern-Based Constraint Satisfaction and Logic Puzzles* (arXiv 1304.1628; 3rd ed. 2016), Ch. 15: elementary rules, bivalue-chains, whips/braids, **g-labels/g-whips** (needed because Kakuro constraints are non-binary arithmetic), and surface sums. Berthier states the hardest Kakuros genuinely need g-whips — NOT mere Sudoku transplants; the non-binary sum constraint makes g-labels essential. His CSP-Rules-V2.1 (GitHub) implements them. [strong]
11. **Nishio-style / bounded trial-and-error.** Community consensus (enjoysudoku) strongly prefers pure-logic puzzles; T&E-requiring puzzles (like the "Diabolical 6×6," rating 6.2) are curiosities, not shippable. [strong]

**Fairness convention:** unique solution reachable by logic alone, no guessing (Free Kakuro, Kakuro Conquest, gmpuzzles all state this). [strong]

### 3. What actually makes a Kakuro puzzle difficult

Kakuro behaves **very differently from Sudoku** here.

**Mathimagics' rating system (the most concrete practitioner framework, enjoysudoku):**

- **MRL** (max run length), **ACRL** (average cell run length = per white cell, H-run + V-run lengths).
- **NCELL** (white-cell count, also as % of interior).
- **fixed** = cells solved by unique-sum-intersection (USI) — the bootstrap count.
- **implied** = cells solved by iterated domain shaving after fixed.
- **Rating** = average possible-values-per-cell after shaving (1.0 = fully solved by simple shaving; >1 = residue remains).

Data: ATK "Easy" = small grids, high fixed counts (9×9, 20 fixed of 52); "Medium" = larger and/or fewer fixed; "Hard" = large, few fixed, rating >1 (1.15–1.7). **Rating 1.0 ≠ easy:** a 24×14 Conceptis "Absolutely Nasty Level 4" rated 1.0 but had only 38 fixed of 251 cells — "large grids + small % of fixed cells" is the human-hard signature, taking hours despite being "singles-only" for a computer. [strong]

**Real drivers (Berthier + Mathimagics converge):**

- **Combination-space branching per run:** runs with mid-range sums (many combinations) are harder; unique-combination runs are free. Berthier: "The more combinations each sector can have, the harder the puzzle may be. The easiest puzzles use only sectors with magic digits." Length ~4–5 sectors have the most possibilities and are hardest. [moderate]
- **Fewer unique-combination entry points** → harder bootstrap. [strong]
- **Long diagonal white bands** and dense intersections → harder; near-independent regions → easier. [moderate]
- **Black-cell density is the dominant statistical driver** of both difficulty and uniqueness (see §4). [moderate]

**Why clue-count analogues don't work.** Sudoku uses "number of givens" (17-clue minimum) as a rough proxy; Kakuro has no comparable "givens" — every run is clued. The Kakuro analogue is the **black-cell layout + which sums are given**: you can *tighten* by removing redundant clues (Simonis produces locally-minimal instances by removing hints while preserving uniqueness), but remaining clue count does not track difficulty monotonically. The real "minimum information" question is the max white cells (NB) a size-N grid can have while unique. Mathimagics' empirical maxima for N=5..10 (square, interior (N−1)²): max NB = 14, 22, 32, 43, 56, 70; min hint cells = 2, 3, 4, 6, 8, 11. Intrinsic template limits: aligned adjacent length-9 runs, and 2×9/3×8/4×7/5×5 sub-blocks, guarantee a swap-cycle → never unique. [strong]

**How difficulty is measured — what the field does:**

- **(a) Hardest technique required** (Berthier: classify by the simplest rule that cracks it: singles → subsets → chains → whips → g-whips). Best matches the *feel*. [strong]
- **(b) Weighted sum of techniques (HoDoKu-style)** — common in Sudoku apps, transferable but not Kakuro-standard.
- **(c) Search depth / guess count** — Mathimagics' avg-NPV-after-shaving rating; SAT/backtracking node counts.
- **(d) Hybrid — the practical consensus. Publishers filter difficulty *post-generation*** (Berthier: "difficulty generally cannot be predicted a priori… puzzles are filtered for difficulty after being generated"). Conceptis and Krazydad both order by empirically-graded difficulty (Krazydad: higher book number = harder; Conceptis newspaper packages ramp Monday-easy → Sunday-hard). [strong]

**Academic difficulty research.**

- **Radek Pelánek** (Masaryk Univ.) — the key name in human puzzle-difficulty modeling. FLAIRS 2011 "Difficulty Rating of Sudoku Puzzles" and "Human Problem Solving: Sudoku Case Study" show **the number of high-level strategies required correlates highly with average human solving time**, with two difficulty sources: complexity of individual steps and dependency structure among steps. **Kakuro is NOT the specific subject** of Pelánek's papers (his corpus is Sudoku, Sokoban, Nurikabe, Rush Hour, general CSP-difficulty overviews), but he explicitly notes the method is "potentially extendible to CSP-based puzzles," which Kakuro is. Transferable methodology, not direct Kakuro evidence. [strong]
- **Helmut Simonis, "Kakuro as a Constraint Problem"** — models Kakuro as finite-domain CSP, compares MILP/SAT, **proposes a grading scheme predicting human difficulty**, and shows tightening by removing redundant hints. The most directly relevant academic difficulty work. [strong]
- IAENG "Kakuro: Solving the CSP" and various theses cover solver difficulty via rule sets and i-consistency. [moderate]

**Computational complexity (precise citations).**

- **Seta 2002:** Takahiro Seta, "The complexity of CROSS SUM," IPSJ SIG Notes, AL-84:51–58, 2002 (Japanese; preceded by his 2001 Univ. Tokyo senior thesis) — first NP-completeness proof for Kakuro. [strong]
- **Ruepp & Holzer, FUN 2010:** "The Computational Complexity of the Kakuro Puzzle, Revisited," LNCS 6099, pp. 319–330, DOI 10.1007/978-3-642-13122-6_31. Verbatim abstract: "We present a new proof of NP-completeness… we show NP-completeness for a new variant of Kakuro that has not been investigated before… Moreover some parts of the proof have been generated automatically, using an interesting technique involving SAT solvers" (Eén & Sörensson's MiniSat). [strong]
- **Yato & Seta 2003 (the one that matters for generation):** "Complexity and Completeness of Finding Another Solution and Its Application to Puzzles," IEICE Trans. Fundamentals E86-A(5):1052–1060. Verbatim: "We prove the ASP-completeness of three popular puzzles: Slither Link, Cross Sum, and Number Place. Since ASP-completeness implies NP-completeness, these results can be regarded as new results of NP-completeness proof of puzzles." **ASP = Another Solution Problem** — given an instance and one solution, find another; completeness is under parsimonious reductions. This is the formal reason **uniqueness verification is NP-hard** — the deep cause of generation ≫ solving. [strong]
- Kakuro can be encoded as integer programming (Wikipedia) and as a card-based physical zero-knowledge proof (Miyahara et al.). [strong]

**Difficulty × grid size — the most counterintuitive finding: no hard ceiling couples size to difficulty.**

- **Small grids can be extremely hard.** Mathimagics' "Diabolical 6×6" (a 7×7 grid, minimum black cells for uniqueness = maximum white density) rated **6.2** and took days of CPU to construct; essentially all-T&E yet uniquely solvable. Small grids do NOT have a low difficulty ceiling — dense intersections + few unique-combination bootstraps make them hard. [strong]
- **Large grids can be human-hard-but-technique-easy** (rating 1.0, hours of work) purely from scale (many domain-shaving steps). [strong]
- **Smallest genuinely-hard grid:** ~6×6–7×7 at max white density; below ~5×5 puzzles collapse to trivial ("smallest interesting" = 5×5 in the academic literature). [moderate]

### 4. Generation algorithms and implementation

**Two paradigms (from primary practitioner sources):**

**(A) Solution-first / constructive (recommended).** Build black-cell layout → fill a complete valid digit grid (per-run alldifferent) → compute all clue sums from the filled grid → optionally erase some clues → verify uniqueness with a counting solver. kakuro-online.com's "Authority" does exactly this ("I fill the grid with a valid solved state, calculate the sums from that, and try solving"), as does ChrisMoutsos/kakuro (C++/Qt, GPL-2.0): generates "a random board guaranteed to have a unique solution" via generate-then-verify. Tends toward higher black-cell density and easier puzzles unless difficulty-filtered. [strong]

**(B) Layout-first / top-down (Berthier's pipeline).** Fix size → fix black cells → fill white digits → fill sums → decide pure vs. partial → erase givens → check uniqueness; if not unique, add data or restart; progressively erase sums until "goodness" criteria met. **Failure mode is step 3 (the digit fill):** fponticelli reported "backtrack too many times… non-terminating process" with naive random fills. [strong]

**Empirical performance / accept rates (the hard truth):**

- **Naive random generation is hopeless at real sizes.** Mathimagics: "just with a small grid of 10×10, I ran the naive-model random generator for several hours without even coming close to uniqueness"; the best random attempt still had **3,676 solutions**. Kakuro's solution space is "several orders of magnitude greater than simple Latin-square cases such as Sudoku." [strong]
- **Uniqueness probability of an all-white grid from its sums** (Mathimagics' P(N,D) experiment, D = digit-alphabet size): peaks at D = N+1 (one free extra symbol); e.g. 3×3 with D=6 ≈ 44%, falling to 4% at D=9; 4×4 with D=5 ≈ 28%. P(N=D)=0 (a pure Latin square is never uniquely reconstructible from sums). [thin→moderate — one hobbyist's data]
- **Black-cell density is the dominant lever.** At minimum density (~19% black, 10×10) P(unique)≈0 (every run sums to 45, no information); at chessboard/high density (~50%+) P(valid)≈100% (each black cell nearly determines a white cell). Nonlinear/statistical. **Forcing structural properties (minimum fraction of unique-combination runs, controlled run-length mix) is necessary to make generation tractable.** [moderate]
- **Uniqueness-flip sensitivity:** to *break* uniqueness deliberately, take a unique solution and ±1 both the H and V clues through one cell; sum-preserving "cycles" (swap two rows/cols whose swapped values don't appear in crossing runs) create ambiguity. Generators must actively avoid such cycles. [moderate]

**Guaranteeing a unique solution.**

- **Backtracking solution-counter with early termination at 2 solutions** — the standard, simplest, fastest-to-implement approach: DFS + constraint propagation, stop at the 2nd complete solution. What most reference generators use. [strong]
- **DLX / Algorithm X (exact cover).** Encodable for Dancing Links (dlxlib demos include Kakuro), but a less natural fit than Sudoku because of the *sum* constraint (you'd enumerate per-run candidate combinations as "options"). Works, but the CSP/propagation formulation is cleaner. [moderate]
- **SAT / ILP.** Ruepp & Holzer and enjoysudoku's creint confirm even the hardest benchmark Kakuros "are quickly solved with SAT." Excellent for *verification*, heavier to embed in a TS/Node pipeline than a custom propagator. [strong]
- **CP with sum+alldifferent.** Simonis models Kakuro with LINEAR(=,s) per run + alldifferent per run; shows shaving (one pass "S" vs. recursive-to-saturation "R") dramatically improves propagation. [strong]

**Efficient solver design (implementation-grade):**

- **Precompute (length, sum) → bitmask table at build time.** For each L∈{2..9} and sum S, store the union bitmask of all digits in any valid combination, plus the list of per-combination bitmasks. Sizes: L=2 → sums 3–17 (36 sets); L=3 → 6–24 (84); L=4 → 10–30 (126); L=5 → 15–35 (126); L=6 → 21–39 (84); L=7 → 28–42 (36); L=8 → 36–44 (9); L=9 → 45 (1). Total 511 — precompute all, negligible cost. A LUT lookup is ~microseconds (the shapeoperator.com Julia benchmark: ~7µs worst-case 4-cell decompose after precompute vs. ~6ms to build). [strong]
- **Candidate sets as 9-bit bitmasks;** propagation = bitwise AND/OR. Wikipedia notes the bitmapped representation for missing/required-value logic. [strong]
- **Per-run propagation:** for each run, filter its still-possible combinations against current cell candidates, then the run's allowed digit mask = OR over surviving combinations; AND that into each cell. When a cell becomes singleton, remove it from the other cells in both its runs; cascade. Many easy/medium puzzles fall to this alone (KakuroOnline, Free Kakuro both describe this exact loop). [strong]
- **min/max residual bounds** per run as a cheap complementary propagator.
- **alldifferent (Régin 1994) GAC?** Régin's algorithm (max-matching in the value graph + SCC-based edge pruning for generalized arc consistency) is the gold standard for large alldifferent, but **overkill for Kakuro**: runs are length ≤9 over a 9-value domain, and the *combined* sum+alldifferent constraint is more naturally propagated by the combination-mask method above, which already enforces GAC on the joint per-run constraint (it enumerates exactly the feasible combinations). Régin adds complexity for no practical gain at L≤9. The joint "sum+alldifferent" constraint has dedicated propagation literature (arXiv 1607.02466, benchmarked on "gen-kakuro"). [strong]
- **Search order:** MRV / first-fail (IAENG report: MRV improved runtime in 5/6 cases). For extreme instances Mathimagics added "look-ahead" (partial BFS): test all values for a cell; if some other cell takes the same value in *every* branch, that value is forced — cheap propagation booster. [moderate]

**Enumerating all L-subsets of {1..9} summing to S:** trivial increasing-order DFS with running-sum/remaining-count pruning; the full 511-subset table generates in well under a millisecond and is cached. (Equivalent to "partitions of S into L distinct parts each ≤9.") [strong]

**Black-cell layout generation (concrete method).** Mathimagics' "edges-inward" template method: generate a valid symmetric outer edge, force neighbors (an edge white cell forces its inward neighbor white to avoid orphan 1-cell runs), fill the interior with a symmetric pattern, use an odd row/col count so the center line is self-symmetric. Enforce: (1) rotational or diagonal symmetry; (2) white-region connectivity; (3) run-length ∈[2,9]; (4) avoid the known degenerate sub-blocks (aligned length-9 pairs, 5×5 all-white, etc.) that guarantee non-uniqueness. [strong]

**Open-source implementations worth reading (you prefer primary code):**

- **denis-berthier/CSP-Rules-V2.1** (GitHub; CLIPS/Lisp) — "KakuRules" implements the full human-technique ladder (bivalue-chains, whips, g-whips, surface sums). **Best for building your difficulty classifier**; Berthier warns it has *nothing* on generation. [strong]
- **ChrisMoutsos/kakuro** (GitHub; C++/Qt; GPL-2.0) — cleanest small codebase with an *explicit* generator guaranteeing uniqueness (generate-then-verify). Read cell.cpp / puzzleboard.cpp for the generate+solve loop. [strong]
- **ctimmons/cs_kakuro_solver** (C#) — Norvig-style backtracking solver; clear Cell.cs/Kakuro.cs; good model for the counting solver. [strong]
- **hakank** constraint models (MiniZinc/Choco/Picat, e.g. choco3/Kakuro.java) — canonical CP formulations. [strong]
- **shapeoperator.com "Optimizing a Kakuro solver in Julia"** — excellent writeup of the precomputed (sum,length)→combinations LUT with timings. [strong]
- DLX demos (dlxlib, React/TS) include Kakuro exact-cover encodings. [moderate]
- **Simon Tatham's Portable Puzzle Collection does NOT include Kakuro** (verified: the 40-puzzle list — Keen, Solo, Towers, Unequal, etc. — has none; the closest is "Keen," a KenKen/Calcudoku-style puzzle). No Tatham reference to lean on. [strong]

**Performance benchmarks.** Solving is fast: even the hardest published Kakuros solve in milliseconds with SAT or a good propagator; Mathimagics' hardest hand-built instances needed hours only before look-ahead. Generation is the bottleneck: seconds-to-minutes for good filtered puzzles; naive random search effectively never terminates at ≥10×10. The IAENG i-consistency+MRV solver solved a 12×10 in ~22s (unoptimized, academic); a bitmask/propagation TS solver will be far faster. [moderate]

### 5. Grid sizes and tiering

**Size convention:** name by **interior playable area** (a "9×9" = 9×9 white-region bounding box, excluding the dead top-black-row/left-black-column, or print crossword-style with numbered clues to remove them). Avoid the "count the dead row/col" convention that confuses users. [strong]

**What each size supports:**

- **≤5×5 interior:** mostly trivial; "smallest interesting" ~5×5. Ship only as tutorial/onboarding. [moderate]
- **6×6–7×7:** *can* be genuinely hard at max white density with few unique-combination bootstraps (the "Diabolical 6×6" proves a high ceiling), but such puzzles verge on T&E and are unfriendly. At normal density, Easy–Medium. Interesting-small = dense intersections + longer (4–5 cell) runs + avoid magic-digit bootstraps. [strong]
- **8×8–10×10:** the sweet spot for a full Easy→Hard range with varied run lengths. Kakuro Conquest treats 8×8/9×11/9×17 as "expert" sizes. [strong]
- **13×17 / 16×16 / 22×22:** classic print sizes; support long runs and can be human-hard even when technically singles-only. Larger = more domain-shaving labor, not necessarily deeper technique. [strong]

**Proposed 5-tier ladder, calibrated WITHIN each grid size** (your Keisan principle — no shared cross-size thresholds):

| Tier | Techniques permitted/required | Structural targets | Solver instrumentation to verify |
|---|---|---|---|
| **T1 Introductory** | Unique-combination + direct intersection only | High black density; many 2-cell runs; ≥40–50% of runs unique-combination; MRL ≤4 | Completes using only USI + intersection; 0 pairs/chains; 0 guesses; `fixed` ≈ NCELL |
| **T2 Easy** | + naked/hidden singles, residual sums | Mix of 2–3 cell runs; ~25–35% unique-combo; MRL ≤5 | Completes with singles+intersection; few hidden singles; 0 chains; 0 guesses |
| **T3 Medium** | + naked/hidden pairs/triples, min/max elimination | Run mix skews 3–4 cells; ~15–25% bootstraps; moderate ACRL | Requires ≥1 pair/triple step; propagation still solves; 0 guesses; rating ~1.0 but low fixed% |
| **T4 Hard** | + locked candidates, surface/disconnection sums | Longer runs (4–5 cell dominant), dense intersections, ≤15% bootstraps, higher ACRL | Requires ≥1 region/surface-sum or locked-candidate step; pure propagation stalls before completion (rating >1); 0 guesses |
| **T5 Expert** | + chains / whips / g-whips (Berthier) | Long diagonal white bands, minimal bootstraps, high-branching sectors (len 4–5, mid-range sums) | Berthier-style classifier: simplest solving rule is a chain/whip; uniquely solvable without T&E; guess-count = 0 under the technique solver |

Reject any generated puzzle that (a) is non-unique, (b) requires actual trial-and-error/Nishio (bounded guessing), or (c) falls below its tier's minimum required technique. **Assign difficulty from the human-technique classifier post-generation, not from parameters** — parameters only bias the generator toward a tier. [strong for method; moderate for the specific % thresholds — tune empirically per size]

**Should you ship 4×4/6×6?** Ship 4×4 only as a tutorial (it collapses to trivial). 6×6 is worth shipping for Easy–Medium; making a small grid *interesting* = dense intersections, run lengths 4–5, and deliberately few unique-combination bootstraps so the solver must cross-reference rather than read off magic digits. Don't attempt genuinely-Expert 6×6 — those verge on T&E and frustrate users. [moderate]

### 6. Prior art and competitive landscape (brief)

- **Conceptis Puzzles** — gold standard for generation quality; licenses to newspapers + own apps (up to 22×22, Samurai Kakuro). Difficulty ramps very-easy→hard; "Absolutely Nasty Kakuro" / "Black Belt" book lines are the recognized hardest mainstream puzzles. Curated + generated. [strong]
- **Krazydad (Jim Bumgardner)** — huge free printable library, 13×17 standard, booklets ordered by difficulty (higher = harder), plus Krypto Kakuro. Clean, well-regarded generation. [strong]
- **kakuro-online.com** ("Authority") — solution-first JS generator up to 20×20; documented its algorithm on enjoysudoku. [moderate]
- **Kakuro Conquest / Free Kakuro / KakuroOnline.com** — browser apps, 4 difficulty tiers, interchangeable size×difficulty; expert sizes 8×8, 9×11, 9×17; strong combination-reference + hint UX to emulate. [moderate]
- **atksolutions.com (ATK)** — Berthier rates ATK the best-quality Kakuros; 3 grades (Easy/Medium/Hard). [moderate]
- **Nikoli** — the standard-setter for hand-crafted aesthetic quality; ships on Nintendo Switch ("Puzzle by Nikoli S Kakuro"). Holds the NIKOLI brand mark (but the U.S. KAKURO term marks are abandoned). [strong]
- **Simon Tatham's collection — no Kakuro** (has "Keen," a KenKen-style puzzle). [strong]

## Recommendations (staged, prioritized)

**Stage 0 — Naming & legal (do first).** The U.S. "KAKURO" word marks are abandoned (2007), so the trademark risk is materially lower than KenKen's. **Ship as "Kakuro (Cross Sums)"** to capture search traffic while keeping the generic term prominent — after a quick counsel check for common-law U.S. use and foreign (EU/JP) registrations. If counsel is cautious, fall back to "Cross Sums" alone (Funk's descriptive coinage; not held as a puzzle-type mark). [strong]

**Stage 1 — Core engine (reuse your CSP infrastructure).**

1. Build the **(length, sum) → {combination bitmasks, union mask}** LUT at build time (511 entries). This is your Killer-Sudoku cage-combination precompute, specialized to distinct digits 1–9. [strong]
2. Implement a **bitmask propagation solver**: per-run surviving-combination filter + singleton cascade + min/max bounds; MRV search with early termination at the 2nd solution for uniqueness. Skip Régin GAC — the combination-mask method already gives per-run GAC at L≤9. [strong]
3. Implement a **separate human-technique classifier solver** (mirror your Keisan rater): technique ladder T1→T5, recording which techniques and how many of each, plus guess-count (must be 0). Consider porting chains/whips logic from Berthier's CSP-Rules for T5. [strong]

**Stage 2 — Generator (solution-first).**

1. **Layout:** symmetric black-cell templates via the "edges-inward" method; enforce connectivity, run-length ∈[2,9], no degenerate sub-blocks. Curate a template library per size (Berthier and Conceptis effectively use template libraries). [strong]
2. **Fill:** randomized DFS producing a valid complete digit grid (per-run alldifferent); derive clues. [strong]
3. **Tighten & verify:** optionally erase redundant clues (Simonis-style) while the counting solver confirms uniqueness. Reject non-unique and any puzzle needing T&E. [strong]
4. **Classify & bin:** run the technique classifier; assign to the tier whose required technique matches; discard puzzles missing their target tier's minimum. Bias generation toward the tier's structural targets, but **label from the classifier, not the parameters.** [strong]

**Stage 3 — Sizes & tiers.** Ship 6×6, 8×8, 9×9/10×10 initially (interior-area convention, documented). Calibrate the 5-tier ladder *within each size*; tune the %-unique-combo and run-length-mix thresholds empirically by generating a few hundred puzzles per size and inspecting the classifier's technique-depth distribution. Add 13×17/16×16 later for "big puzzle" appeal. Ship 4×4 only as a tutorial. [moderate]

**Stage 4 — Instrumentation & validation (what proves the tiers).** For every shipped puzzle store: NCELL, MRL, ACRL, black-cell density, run-length histogram, unique-combination-run count, `fixed`/`implied` counts (Mathimagics metrics), post-shaving avg-NPV rating, the ordered list of techniques the classifier used, max technique level, and guess-count. **Thresholds that flip a tier assignment:** if a T4 puzzle solves by pure propagation (no surface-sum/locked-candidate step ever fired) → demote; if a T2 puzzle fires pairs/triples → promote; if any puzzle's classifier reports guess-count >0 → reject regardless of tier. Optionally A/B against human solve-time telemetry (Pelánek's finding: technique-count correlates with solve time) to validate the ordering empirically. [strong]

## Caveats

- **Trademark correction & residual risk.** The U.S. "KAKURO" registrations are abandoned (2007-07-31) — so the headline risk is lower than KenKen's *live* mark. But abandonment doesn't extinguish common-law rights from continued use or foreign registrations (EU/JP), which I did not verify. Confirm with counsel; "Cross Sums" (Funk's generic coinage) is the bulletproof fallback. [moderate]
- **The P(N,D) uniqueness probabilities, the "3,676 solutions," and the "40% unique-combo" figures are one expert hobbyist's (Mathimagics) forum experiments**, not peer-reviewed. Directionally reliable and consistent with the ASP-completeness result, but treat exact numbers as illustrative. [thin→moderate]
- **The specific %-thresholds in the 5-tier table are extrapolations** from practitioner heuristics (Berthier, Mathimagics, Conceptis grading) — starting points to tune empirically, not established constants. The technique-ladder *ordering* is well-supported. [thin for numbers; strong for ordering]
- **Pelánek's difficulty research does not cover Kakuro specifically** (Sudoku/Sokoban/Nurikabe/etc.) — it's transferable CSP methodology, not direct Kakuro evidence. The most Kakuro-specific academic difficulty work is Simonis, "Kakuro as a Constraint Problem." [strong]
- **Community vs. academic divergence:** the community treats "surface/disconnection sums" as a first-class named technique with no standardized name (surface sums / singularities / disconnection zones); academia folds everything into CSP resolution rules (Berthier) or propagation strength (Simonis). Both agree fair puzzles must be logic-only (no T&E). [moderate]
- **Complexity results are worst-case decision/ASP problems**, not typical instances — real published Kakuros solve in milliseconds. NP/ASP-completeness matters to you specifically because it explains why *uniqueness verification during generation* is the expensive step. [strong]
- **Date discrepancy:** sources split on whether Sudoku overtook Kakuro in Japan in 1992 (Wikipedia) or 1993 (WMC Publishing). Immaterial to implementation. [moderate]
