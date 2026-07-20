# KenKen / Calcudoku / Mathdoku: Deep Technical Reference for a Generator-Solver Engine

## TL;DR

- **Difficulty in KenKen is driven primarily by cage-decomposition ambiguity, not raw grid size** — and the single most counterintuitive, implementation-relevant fact is that **addition-only and multiplication-heavy large cages are the hardest to pin down, while subtraction/division cages (restricted to two cells) are the *easiest* because they have very few candidate sets.** A defensible operator-difficulty ordering per cage is: ÷ (easiest) < − < × < + (hardest, for large cages), which inverts the naive "arithmetic complexity" intuition.
- **Operator restriction is a first-class difficulty lever**: published variants run from addition-only (Conceptis "SingleOp"), through two-operator "DualOp" (+/− or ×/÷), to four-operator "QuadOp" and finally "no-op/Mystery" mode where the operator itself is hidden. No-op is the true hard mode because uniqueness must hold across *every* operator interpretation of every cage, which materially changes both solving and generation/verification.
- A concrete **five-tier system** (Easiest→Expert) can be tuned along five orthogonal axes: grid size N, operator set, cage-size distribution, whether operators are shown/hidden, and a technique ceiling — with uniqueness verified by an exact-cover (DLX) solver that rejects any puzzle without a unique solution.

## Key Findings

1. **Core rule set is stable and well-documented.** Fill an N×N grid with 1..N (Latin square: each digit once per row and column, *no box constraint*), partitioned into bordered "cages" each showing a target and (usually) an operator. Digits **may repeat within a cage** provided they don't repeat in a row/column — the key divergence from Killer Sudoku. Single-cell cages are free givens. Subtraction and division are conventionally restricted to **two-cell cages** (Will Shortz / NYT convention) because they are non-associative; some authors (e.g. Patrick Min / calcudoku.org) allow larger −/÷ cages under the convention "largest number first."

2. **Operator type controls candidate-set size, which is the real difficulty currency.** For a two-cell cage on a small grid: a `3÷` cage → only {1,3}; a `12×` cage → only {3,4}; a `3−` cage on a 4×4 → only {1,4}. Multiplication cages are "often easier than they look" because large products factor into very few sets. **Addition cages are the ambiguous ones** — a sum has many decompositions — which is why "addition-only" is harder than beginners expect.

3. **Operator-restricted variants are formally published**, most cleanly by Conceptis Puzzles as **SingleOp** (uses only one operation, with the operation label omitted from cages), **DualOp** (addition+subtraction, or multiplication+division), and **QuadOp** (all four operations). *KenKen: Lim-Ops, No-Ops and Twist! — 180 6×6 Puzzles* (ISBN 9789813235847, by KenKen inventor Tetsuya Miyamoto and Nextoy's Robert Fuhrer) publishes, per its publisher blurb, "Limited-operations puzzles, where puzzles may contain only addition, only subtraction, or a mix of addition and subtraction" and "No-operations puzzles, where puzzles will use all four operations including multiplication and division, but YOU have to figure out which operations to use." Nikoli's **Inshi no heya** ("factoring rooms," which first appeared in *Puzzle Communication Nikoli* #92) is "a specific form of the KenKen puzzle genre where every operation is implied to be multiplication." Four-operator + hidden-operator is the canonical "expert" form.

4. **Prime factorization is the signature multiplication technique**; row/column product and sum invariants ("Rule of 21," "Rule of 720" on 6×6) are the signature large-cage/whole-line techniques. Sudoku-style naked/hidden singles, naked pairs, and X-wing-type logic carry over but operate only on rows and columns (no box).

5. **Open-source generators confirm the architecture**: KDE KSudoku's `CageGenerator`/`MathdokuGenerator` lays cages on a solved grid, assigns operators + targets via `setCageTarget()`, and verifies uniqueness with a **DLX (Dancing Links) exact-cover solver**, rejecting any non-unique puzzle. Subtraction/division are hard-coded to size-2 cages only.

6. **Difficulty grading systems exist but are mostly proprietary/heuristic.** calcudoku.org (Patrick Min, MSc Leiden / PhD Princeton in Computer Science) uses a **2–6 star** scale; NYT publishes an easy→hard progression through the week; kenkenpuzzle.com lets users pick grid size and operator set. There is no widely published KenKen equivalent of Andrew Stuart's weighted technique scoring, though the general "sum weighted technique costs over the solve path" approach from Sudoku is directly transferable.

## Details

### 1. Core rules and mechanics

**The constraints.** A KenKen solution is a Latin square of order N (digits 1..N, each exactly once per row and per column) with **no sub-box constraint** — this is the structural difference from Sudoku and is what allows KenKen to exist at any size from 3×3 up to 9×9 (and calcudoku.org publishes daily puzzles from 4×4 up to 15×15). Overlaid on the Latin square is a partition into cages; each multi-cell cage carries a target number and an operation (+, −, ×, ÷) shown in its top-left cell, and the cage's digits must produce the target under that operation in *some* order.

**Repeats within a cage.** Unlike Killer Sudoku (where a cage never repeats a digit), KenKen **permits repeats inside a cage** as long as they are not in the same row or column. Example: a three-cell L-shaped cage spanning two rows can legally hold two 3s (one per row). A worked Wikipedia example: a `6×` four-cell cage resolving to {1,1,2,3}, with the two 1s forced into separate columns. This single rule substantially expands the candidate space versus Killer Sudoku and is the most common source of solver bugs.

**Single-cell cages** show only a value and act as givens ("free spaces"). Their count is a direct difficulty lever (more givens = easier).

**Subtraction/division and the two-cell restriction.** Because − and ÷ are non-associative, a three-cell subtraction cage is ambiguous: 6−(4−1)=3 but (6−4)−1=1. Two solutions to this exist in the wild:

- **Will Shortz / NYT / most US publishers:** restrict − and ÷ clues to **two-cell cages** only, where order doesn't matter to the reader (2 and 3 for a `1−` clue can be placed either way). This is also the rule hard-coded in KSudoku.
- **calcudoku.org (Patrick Min) and some others:** *allow* larger −/÷ cages, under the explicit convention that "there exists an ordering that produces the target," which in practice (no negatives, no fractions) means **largest number first** — "the largest number minus the others" / "the largest divided by the others." Min notes parentheses are never used: per his *Calcudoku Advanced* text, "it is not the case that the set {4, 2, 1} is a solution for a cage with 3– because 3 = 4 −(2 −1)."

**No-op / "stealth" / "Mystery" KenKen.** The operator symbols are omitted, leaving the operator itself as an unknown. The standard disambiguating hint published by kenkenpuzzle.com and others: **any cage of 3+ cells must be addition or multiplication** (because −/÷ are 2-cell only), which bounds the search. This changes solving (you now reason about which operator makes the target achievable given the candidate digits) and, critically, changes **generation/verification** (see §6).

### 2. Operator-restricted variants (key focus)

**The published taxonomy (Conceptis Puzzles) is the cleanest reference:**

- **SingleOp:** one operation — either addition-only or multiplication-only; the operator is stated once above the grid, not per-cage (Conceptis omits the per-cage operation label entirely in SingleOp).
- **DualOp:** two operations — addition+subtraction, *or* multiplication+division.
- **QuadOp:** all four (the classic form).

*KenKen: Lim-Ops, No-Ops and Twist!* (Miyamoto & Fuhrer) independently confirms the market for "limited-operations" (addition-only, subtraction-only, or addition+subtraction) and "no-operations" variants aimed at seasoned solvers. Patrick Min's advanced books include dedicated "Single operator puzzles" chapters, plus a "Puzzles with the modulo operator" chapter and chapters on exponentiation, zero-based ranges, and negative-number ranges — evidence that operator set is treated as a primary design dimension.

**Addition-only: why it's harder than it looks.** Removing ×, −, ÷ removes the *most constraining* clue types. Addition targets have **many decompositions** (a sum like 8 across three cells has multiple {a,b,c} sets), so each cage individually prunes less. The solving load shifts almost entirely onto **cage-combination combinatorics** (identical in spirit to Killer Sudoku's cage-sum analysis) plus row/column sum invariants (the "Rule of 21" family). Multiple publishers explicitly market addition-only sets as focusing on "combination logic" and "logical deduction over complex arithmetic" — i.e., the arithmetic is trivial but the *logic* is not necessarily easy. This is precisely why addition-only is a legitimate mid-difficulty variant rather than automatically the easiest.

**Multiplication-only (Inshi no heya).** A product target factors into few candidate sets — a large product like 60 or a highly composite value narrows dramatically via prime factorization. Multiplication-only puzzles therefore reward factorization fluency and tend to resolve faster per cage than addition-only, despite "feeling" harder arithmetically. Nikoli's Inshi no heya is the canonical published multiplication-only form (all rooms are products; rooms are single-row or single-column strips).

**Subtraction-only / division-only** as *pure* published variants are rare, precisely because the 2-cell restriction makes them extremely constrained and short on candidate sets — a puzzle built solely from them would be sparse and easy. They appear far more often as components of DualOp (+/− or ×/÷) sets.

**Two-operator (DualOp).** +/− and ×/÷ are the standard pairings (pairing an associative operator with its non-associative inverse). Adding the second operator increases per-cage ambiguity (you must also decide the operator's effect) but the pairing keeps arithmetic coherent. DualOp sits between SingleOp and QuadOp in difficulty.

**Three-operator** puzzles exist but are not a standard named tier; they occur naturally when a generator's operator palette is set to three of four.

**Four-operator (QuadOp)** is the standard/classic form and, when combined with hidden operators (no-op), is broadly treated as "true hard mode."

**Is there a clear operator-difficulty ranking?** The community/technique consensus, well-supported by candidate-set counting:

- **Per cage, ÷ and − (2-cell) are the *easiest*** — very few valid pairs, so they're high-value starting points ("focus on single-cell and small cages first; division and subtraction cages have the most constraint since order matters").
- **× is intermediate** — factorization limits sets, "get excited when you see multiplication."
- **+ (especially large cages) is the *hardest to pin down*** — most decompositions, least immediate pruning.

So the naive intuition ("division is hard because it's advanced arithmetic") is **inverted** at the puzzle-logic level: division cages are *gifts*. This is the single most important operator insight for tuning a generator: to make a puzzle harder, bias toward large addition/multiplication cages and *away* from 2-cell −/÷ cages; to make it easier, do the reverse.

### 3. Solving strategies and techniques in depth

**Cage-combination enumeration per operator** (the core primitive your engine needs). For a cage of size k and target T, allowing repeats except within the same row/column:

- **Addition (`T+`):** enumerate all multisets of k digits from 1..N summing to T; then discard any assignment that would force a repeat within a shared row/column. Min/max bounds prune hard: minimum sum = smallest k digits, maximum = largest k digits.
- **Multiplication (`T×`):** **prime-factorize T**, then partition the prime factors into k factors each ≤ N. Example techniques from the literature: a `25×` three-cell cage = 1×5×5 (only viable if the two 5s can be placed non-collinearly; impossible if the cage lies in one row/column); a three-cell product 6 = 1×2×3; a four-cell `32×` on a 5×5 = {1,2,4,4} or {2,2,2,4}, with geometry eliminating one. Large products like 2520 collapse to very few sets.
- **Subtraction (`T−`, 2-cell):** pairs (a,b) with |a−b| = T, both ≤ N — e.g. `3−` on 4×4 = {1,4} only; `1−` yields {1,2},{2,3},{3,4},…
- **Division (`T÷`, 2-cell):** pairs with larger/smaller = T — e.g. `2÷` = {1,2},{2,4},{3,6}; `3÷` on 4×4 = {1,3} only.

**Prime factorization** deserves emphasis as a first-class technique for × cages: an integer-programming treatment of KenKen (ResearchGate, "An Integer Programming Model for the KenKen Problem") models product constraints specifically via prime factorizations, noting product restrictions are "the hardest ones for expressing by linear constraints" and that many two-cell products (targets 4, 9, 10, 14, 15, 16, 20, 21 in ≤9×9 grids) have a **single factorization** — an instant lock.

**Row/column invariants (whole-line arithmetic).**

- **Sum invariant ("Rule of 21" on 6×6):** every row/column sums to N(N+1)/2 (=21 for N=6, =10 for N=4, etc.). If all but one cell of a line are known (or several cages are fully contained), the remainder is forced. Worked example: two 4×4 line cages summing 2+8=10 force the third cell to 15−10=5 (on a 5×5). The Penny Dell tip sheet gives a 6×6 worked case using the Rule of 21 to resolve a `3−` cage to {4,1}.
- **Product invariant ("Rule of 720" on 6×6):** every line multiplies to N! (=720 for N=6, =120 for N=5, =24 for N=4). Conceptis's "grid remainder" technique divides the known product into N! to force the outlier cell.

**Parity techniques.**

- Addition: an odd target requires an odd count of odd digits.
- Multiplication: an even product needs at least one even digit.
- Subtraction (2-cell): odd target ⇒ one odd + one even; even target ⇒ same parity.

These are most useful on 7×7+ grids where raw candidate lists are long.

**Forced cells in small cages.** The highest-value early moves: single-cell givens, then 2-cell −/÷ cages (few pairs), then × cages (factorization), saving flexible + cages for last after eliminations narrow them.

**Sudoku-carryover techniques without the box.** Naked/hidden singles, naked pairs/triples/quads, and X-wing-style logic all apply — but *only across rows and columns*, never boxes. Removing the box constraint means these techniques have **fewer intersecting units** to exploit (2 units per cell instead of 3), so pure-Latin-square deduction is generally weaker than in Sudoku; the cage arithmetic must supply the missing constraint. The "parallel-pairs uniqueness" heuristic (if two parallel pairs could legally swap, one must differ, else the puzzle would have two solutions) is a KenKen-flavored uniqueness argument used by experienced solvers.

**Large mixed cages (4+ cells).** Enumerate feasible multisets, then filter by (a) geometry (which cells share rows/columns — repeats only allowed off-line), (b) intersecting known digits, (c) min/max bounds, and (d) "intra-block" reasoning (e.g., a 4-cell cage with 3 cells in one column: those 3 must be distinct and their partial sum/product bounds the 4th cell).

**Advanced/expert techniques.** Conceptis's "advanced techniques" are explicitly **recursive/look-ahead**: assume a placement, propagate 1–2 steps, and derive a contradiction (e.g., "if 5 sits here, the shaded block's minimum sum exceeds its target ⇒ contradiction"). This is chain/forcing-net reasoning. The hardest published puzzles require long forcing chains rather than any single trick: per calcudoku.org's "10 Hardest Logic/Number Puzzles," the hardest Calcudoku was a **9×9 published 2 April 2013, which only 9.6% of regular calcudoku.org solvers managed to solve**, and a companion modulo-variant puzzle reportedly took one math professor 5 hours.

### 4. What makes KenKen difficult — the central question

**The dominant factor is combinatorial ambiguity of cage decompositions, mediated by operator and cage size — not grid size alone.** Grid size N sets the *scale* (more cells competing per line, longer deduction chains, bigger candidate pools) but two 6×6 puzzles can differ enormously in difficulty at identical N.

**Ranking of difficulty drivers (most to least leverage, per the evidence):**

1. **Operator mix + cage size interaction.** Large + and × cages create the most ambiguity; 2-cell −/÷ cages create the least. A generator can tune difficulty almost entirely here.
2. **Hidden vs shown operators.** No-op mode adds an entire operator-inference layer.
3. **Number of single-cell givens.** Fewer givens = harder (removes free anchors).
4. **Grid size N.** Sets baseline scale.
5. **Cage shape.** Straight-line cages are *more* constraining (all cells share a row or column ⇒ no repeats allowed, tighter candidate sets) than L-shaped/blocky cages that span multiple rows and columns (repeats allowed ⇒ looser). So blocky cages tend to be harder than straight ones of the same size/target.

**Small restrictive cage vs large ambiguous cage.** A 2-cell `3÷` cage is nearly free information; a 4-cell `+` cage with many decompositions is a sustained logic problem. Difficulty concentrates in the ambiguous large cages; the restrictive small cages are the levers you use to *crack* them.

**Does operator choice correlate with difficulty independent of size?** Yes — but the correlation runs opposite to arithmetic "complexity." Because −/÷ are structurally confined to 2 cells with few candidate pairs, they are inherently *easier* to resolve; large + and × cages are inherently *more ambiguous*. So a puzzle dominated by ÷/− is easy regardless of arithmetic; a puzzle dominated by large + cages is hard.

**Published/described grading systems.**

- **calcudoku.org (Patrick Min):** a **2–6 star** rating (2=easy, 3=medium, 4=difficult, 5=very difficult, 6=nearly impossible), applied to every puzzle from the 3rd edition of Volume I onward; the site spans 4×4–15×15 across many difficulty levels daily. Min (MSc Leiden, PhD Princeton, Computer Science) does not fully publish his scoring algorithm, but the star bands are stated and his book *Tricky Calcudoku Puzzles* calibrates that a "Difficult" 5×5 or 6×6 is one "even experienced puzzlers need at least 10-15 minutes to solve."
- **NYT:** publishes 4×4 and 6×6 daily puzzles that "increase in difficulty, like they do in the New York Times," using all four operations; the structural driver of their easy→hard progression is not formally documented beyond grid size and operation mix.
- **kenkenpuzzle.com:** lets users select grid size and which operations to include; markets no-op as an advanced mode.
- **BrainBashers:** publishes daily CalcuDoku at multiple sizes (5×5 up to 9×9) and difficulties (e.g., "Easy," "Medium").

**KenKen equivalent of Andrew Stuart's weighted technique scoring?** No widely published, KenKen-specific technique-to-score table was found. The transferable approach (documented for Sudoku by Sudoku of the Day and others): run a logic-only solver, assign each technique a cost, weight the *first* use of a hard technique highest, sum costs over the solve path, and band the total into tiers. Backtracking-based "branch-difficulty" scores (summing (Bᵢ−1)² over search-tree branch factors) are an alternative, cruder proxy. Either can be adapted to KenKen by scoring cage-combination and chain techniques.

### 5. Five-level difficulty grading — concrete parameters

The following is a **defensible, tunable 5-tier system** synthesized from the operator taxonomy, candidate-set analysis, and published size/operator conventions above. Grokipedia describes a five-level "Easiest, Easy, Medium, Hard, Expert" progression "primarily modulated by grid size and the diversity of operations"; the parameters below make that operational.

| Tier | Grid size N | Operator set | Cage-size distribution | Operators shown? | Technique ceiling |
|---|---|---|---|---|---|
| **1 – Easiest** | 3×3–4×4 | Addition only (SingleOp) | Many 1-cell givens; mostly 2-cell; no cage >3 | Shown | Single-cell givens, unique 2-cell combos, min/max bounds |
| **2 – Easy** | 4×4–5×5 | Addition + subtraction (DualOp) | Fewer givens; 2–3-cell cages | Shown | + line-sum invariant (Rule of 21 family), naked singles/pairs |
| **3 – Medium** | 5×5–6×6 | All four (QuadOp) | Mix of 2-cell −/÷ and 3-cell +/×; occasional 4-cell | Shown | Prime factorization, hidden singles, grid-remainder (sum & product) |
| **4 – Hard** | 6×6–7×7 | All four; larger +/× cages emphasized | Larger blocky cages; few givens | Shown, or hidden on hardest | Intra-block bounding, cross-cage constraints, parity |
| **5 – Expert** | 7×7–9×9 (up to 15×15 for extreme) | All four **+ hidden operators (no-op)**; optionally exotic (modulo, exponent) | Predominantly large/ambiguous cages; minimal givens | **Hidden (no-op)** | Recursive look-ahead / forcing chains, uniqueness arguments |

Design notes for the engine:

- **Operator set is the primary tier knob**; grid size is secondary. Moving Easy→Medium is best expressed as adding operators (SingleOp→DualOp→QuadOp), then Hard→Expert as hiding them.
- **Bias cage generation** toward 2-cell −/÷ for easy tiers and toward large + / × for hard tiers, since that directly controls candidate-set ambiguity.
- **Givens count** should taper from many (Tier 1) to near-zero (Tier 5).
- **Shape:** allow more L-shaped/blocky (repeat-permitting) cages at higher tiers.
- **NYT-style weekly ramp** maps naturally onto Tiers 1–4 at fixed small sizes (4×4/6×6) by shifting operator mix and given count rather than grid size.

### 6. Implementation / generation architecture

**KSudoku (KDE) — the best-documented open-source reference.** The `CageGenerator` class (author Ian Wadham, 2015, GPL v2) starts from a *solved* Latin square and "lays down a pattern of irregular shaped cages, of different sizes." Its documented pipeline:

- `makeCages(graph, solutionMoves, maxSize, maxValue, hideOperators, maxCombos)` — the difficulty parameters are **maxSize** (max cells per cage), **maxValue** (max cage target), **hideOperators**, and **maxCombos** (max number of candidate combinations any cage may have). `maxCombos` is a direct, elegant difficulty control: capping the combinations per cage bounds ambiguity.
- `makeOneCage(seedCell, requiredSize)` grows a cage; `setCageTarget(cage, cageOperator, cageValue)` — "**Choose an operator for the cage and calculate the cage's value**"; `cageIsOK(...)` enforces the parameter limits.
- **Operator constraints are hard-coded:** "Division and subtraction operators… can only appear in cages of size 2." Killer Sudoku forces `mHiddenOperators = false` and operator always `+`.
- **Return codes** encode the generate-and-test loop: makeCages returns the cage count, `0` = too many failed cage attempts, or **`-1` = no unique solution** (caller retries). `checkPuzzle(...)` returns `0` = no solution, `1` = unique, `>1` = multiple.
- **Uniqueness is verified with a DLX (Dancing Links / Algorithm X exact-cover) solver.** The generator builds a `mPossibilities` list — "a list of possible combinations and values all the cages might have… used when setting up the DLX matrix for the solver and again when decoding the solver's result." Helper methods: `setPossibilities` ("all possible values for **one operator** in a cage"), `setAllPossibilities` ("all possible values for the **cells** of a cage"), and `setPossibleAddsOrMultiplies` ("for a cage that has a multiply or add operator").

*Limitation / transparency:* I was unable to retrieve the **body** of `setCageTarget()` from `cagegenerator.cpp` (GitHub/GitLab blocked automated fetches of the `.cpp`; only the `.h` header and its comments were accessible). Therefore I **cannot confirm the exact randomization/weighting logic** used to choose Add vs Multiply for large cages or among the four operators for 2-cell cages, nor whether an explicit "weights" array exists. The header's split between a single-operator enumerator (`setPossibilities`) and an all-cells enumerator (`setAllPossibilities`), plus the dedicated `setPossibleAddsOrMultiplies`, strongly *implies* that in hidden-operator mode the solver enumerates candidate value-sets across **multiple** operators, but the precise `.cpp` control flow is unverified. The correct file to inspect directly is `src/generator/cagegenerator.cpp` in the KDE/ksudoku repo (`raw.githubusercontent.com/KDE/ksudoku/master/...` or `invent.kde.org/games/ksudoku`).

**Other open-source generators/solvers with documented operator/difficulty logic:**

- **wpm/CanCan (Scala):** a KenKen solver+generator whose generator exposes tunable parameters — a **cage-size distribution array**, a **single-cell-cage proportion**, and an **"associative probability"** (bias toward associative operators + and ×) — and prints a per-puzzle **Difficulty** integer plus a "Cage Size Macro Average." Its published sample output shows `# Cage size, Single cell cage proportion, Associative probability / [0:0.000, 1:0.050, 2:0.350, 3:0.350, 4:0.200, 5:0.050], 0.200, 0.333`. This is the clearest published example of operator-and-shape weighting driving difficulty. Its solver is based on Peter Norvig's Sudoku constraint-propagation approach.
- **norvig/pytudes KenKen.ipynb:** Peter Norvig's constraint-propagation KenKen treatment (cages as target+operator+cells; values as {square: possible-digits} maps).
- **chanioxaris/kenken-solver, JohnPapad/KenKen-Solver, panosgiogr/KenKen-Problem (Python):** CSP formulations offering Backtracking, Backtracking+MRV, Forward-Checking, and MAC; they represent the "no-op" case with a fifth operator value (`=` / `None`).
- **camsteffen/kenny (Rust):** generator+solver formalizing the cage constraint as "there exists a permutation of the cage's cell values whose expression equals the target."
- **mlsite.net NekNek solver:** explicitly supports no-op puzzles ("produce a result of" = unknown operator) and a companion Python no-op solver blog post treating "?" as an unknown operator.

**No-op uniqueness verification — the significant algorithmic difference.** With operators **shown**, each cage has exactly one operator, so uniqueness checking enumerates one candidate set per cage. With operators **hidden**, a cage's clue (target + cell set) is consistent with *any* operator that can hit the target — so a correct uniqueness test must ensure the puzzle has a single solution **across all valid operator interpretations of every cage simultaneously**. In exact-cover terms, you add candidate rows for *every* operator that fits each cage (bounded by the "3+ cells ⇒ +/× only" rule), enlarging the DLX matrix and the search. This is why no-op generation is strictly harder to verify and why no-op is the natural top difficulty tier: the generator must reject any puzzle that becomes ambiguous under *some* alternate operator reading, not just under alternate digit fills. The KSudoku header's `mHiddenOperators` flag and dual enumeration helpers are the hooks for exactly this branch.

## Recommendations

**Staged build plan:**

1. **Stage 1 — Core engine (shown operators, QuadOp).** Implement (a) a Latin-square generator, (b) cage-growth with a size cap, (c) per-operator candidate enumerators (prime-factorization for ×; sum-with-bounds for +; pair tables for −/÷ restricted to 2 cells), and (d) an **exact-cover/DLX uniqueness checker** with generate-and-reject on non-unique puzzles. This mirrors KSudoku and is the proven architecture.

2. **Stage 2 — Difficulty via parameters, not post-hoc labels.** Expose KSudoku's four knobs — **maxCageSize, maxTarget, hideOperators, maxCombosPerCage** — plus **operator palette** and **givens count**. Tune tiers primarily by operator palette (SingleOp→DualOp→QuadOp→no-op) and `maxCombosPerCage` (low cap = easy). Adopt CanCan's **associative-probability** and **cage-size-distribution** parameters to bias toward hard (large +/×) or easy (2-cell −/÷) cages.

3. **Stage 3 — A logic solver for grading.** Implement a human-style solver (single-cell → small −/÷ → × factorization → line invariants → naked/hidden singles/pairs → intra-block bounding → recursive look-ahead) and **score puzzles by weighted technique cost** over the solve path (Stuart/Sudoku-of-the-Day style), banding into the 5 tiers. This gives reproducible grading independent of grid size.

4. **Stage 4 — No-op mode.** Extend the DLX matrix to include **all operator interpretations per cage** and verify uniqueness across them; reserve for the Expert tier. Test that generated no-op puzzles remain unique under every alternate operator reading.

**Benchmarks / thresholds that would change the tiering:**

- If a tier's puzzles solve with *only* single-cell + unique-small-cage moves (no line invariants or chains), promote difficulty by cutting givens or raising `maxCombosPerCage`.
- If logic-solver grading shows a tier requires recursive look-ahead, that puzzle belongs in Tier 4–5, regardless of its grid size.
- Calibrate against external anchors: a "difficult" calcudoku.org 5×5/6×6 should take an experienced solver ~10–15 minutes (≈ Tier 3–4); Min's 6-star band = your Tier 5/extreme.
- If addition-only puzzles at a given size grade *harder* than expected, that confirms the combinatorics finding — treat addition-only as Tier 2–3, not Tier 1, unless givens are generous.

## Caveats

- **Proprietary algorithms:** neither NYT's nor kenkenpuzzle.com's exact difficulty algorithms are published; calcudoku.org states its 2–6 star scale but not the full scoring formula. Tier parameters above are a defensible synthesis, not a vendor spec.
- **Unverified source detail:** the exact operator-selection/weighting code inside KSudoku's `setCageTarget()` (`cagegenerator.cpp`) could not be retrieved; claims about *how* it randomizes among operators are inferred from the header comments and should be confirmed by reading the `.cpp` directly.
- **Operator-difficulty ordering** (÷ < − < × < + for large cages) reflects candidate-set counting and strong community/technique consensus, not a single peer-reviewed ranking; it is a reasoned inference well-supported by multiple independent solving guides.
- **Convention split** on subtraction/division cage size (2-cell-only vs "largest-first" any size) means your engine must pick a convention explicitly; mixing them silently will produce puzzles some solvers consider malformed.
- **Attribution note:** *Lim-Ops, No-Ops and Twist!* is credited to Tetsuya Miyamoto and Robert Fuhrer (World Scientific), not Will Shortz; Shortz is the editor associated with the separate NYT KenKen book line.
- Several cited play sites (thepuzzlelabs, glorifiedcalculator, cognitivetrain, etc.) are secondary/marketing sources corroborating rules and heuristics; the load-bearing technical claims rest on Wikipedia, calcudoku.org (Min), Conceptis Puzzles, the KSudoku source/headers, the ResearchGate integer-programming paper, and the UNC-Charlotte "Exotic Arithmetic" course notes.
