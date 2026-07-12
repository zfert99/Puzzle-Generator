# Killer Sudoku: A Comprehensive Technical Report on Rules, Strategy, Generation, and Computation

## TL;DR

- Killer Sudoku overlays Kakuro-style "cage" sum constraints onto a standard Sudoku grid and normally starts with **zero given digits**, so the cage sums plus the no-repeat rules are the only clues; this makes combination analysis and the "Rule of 45" the core solving skills that classic Sudoku lacks.
- For anyone building a generator, the proven architecture is: generate a full solved grid, grow connected cages via randomized flood-fill under size/sum/combination-count limits, then verify a **unique solution** with an exact-cover (Dancing Links) or SAT/CP-SAT solver, and grade difficulty by which human techniques a logical solver needs — the KDE KSudoku project is a complete open-source reference implementation of exactly this pipeline.
- Generalized Sudoku (and by extension Killer Sudoku, which adds constraints) is NP-complete via Yato & Seta's 2003 reduction; in practice 9×9 instances solve in milliseconds with SAT/CP/DLX, and the hard engineering problem is not solving but difficulty grading and cage-layout aesthetics.

## Key Findings

1. **Rules:** Standard Sudoku rules (1–9 once per row, column, 3×3 box) plus: each cage's digits sum to a printed target, and (by near-universal convention) no digit repeats within a cage. Cages can be any connected shape; the no-repeat convention caps cage size at 9.
2. **History:** Established in Japan as *samunamupure* ("sum number place") by the mid-1990s; introduced to English readers by *The Times* of London on 31 August 2005, which coined "Killer Sudoku."
3. **Vs. classic Sudoku:** No givens; arithmetic layer; the fixed row/column/box sum of 45 becomes a powerful deduction engine; difficulty curves differ and easy Killers roughly equal medium classics.
4. **Strategy:** Cage combination tables, the 45 rule (innies/outies, single- and multi-unit), single-combination "magic" cages, complement techniques for large cages, plus all classic techniques (naked/hidden singles/pairs, X-Wing, etc.).
5. **Generation:** Solved grid → connected cage partition → uniqueness check via backtracking/DLX/SAT/CP-SAT → technique-based difficulty grading.
6. **Complexity:** NP-complete in the general case; practical instances trivial for modern solvers.
7. **Resources:** KDE KSudoku, numerous GitHub solvers (DLX, SAT, CP-SAT/Gurobi), and publishers like *The Times*, Cracking the Cryptic, Krazydad, Conceptis, and Nikoli.

## Details

### 1. Rules and Structure

**Core rules.** Killer Sudoku is played on the standard 9×9 grid divided into nine 3×3 boxes ("nonets"). The objective is to fill the grid with digits 1–9 such that:

- Each row, column, and nonet contains each digit exactly once (standard Sudoku constraint).
- The grid is additionally partitioned into **cages** — groups of cells outlined by dotted lines (or colors), each labeled with a small number in a corner giving the **target sum** of the digits in the cage.
- The digits in each cage sum exactly to the target.
- **No digit repeats within a cage.** This is the standard convention and implies no cage can exceed 9 cells.
- The solution must be unique.

The no-repeat-in-cage rule is *additional to*, and stricter than, the Sudoku house rules: a cage can be an "L" shape or "dog-leg" spanning two boxes where, absent the convention, a digit could legally repeat (e.g., in two cells that share neither row, column, nor box). SudokuWiki calls this the "Killer Cage Convention," and notes that allowing duplicates would greatly increase the number of possible combinations. The convention has been standard "from the earliest days of Killer Sudoku."

**Terminology.** A *cell* is a single square; a *cage* is a dotted-line group; a *house* (or unit) is any row, column, or nonet (in "Killer X," also a long diagonal). *Innies* and *outies* are cells identified via the Rule of 45 (below).

**Givens.** Unlike classic Sudoku, Killer Sudoku typically starts with **no given digits** — all information comes from cage sums. (Single-cell cages act as de facto givens, since a 1-cell cage's target *is* its digit.)

**Variants.**

- **Killer-X:** adds the constraint that both long diagonals contain 1–9 once.
- **Repeated-digit Killers:** rare puzzles that drop the no-repeat-in-cage convention (the source of the 2005 *Times* confusion).
- **Grid-size variants:** 6×6 (digits 1–6) mini Killers are common for learning; larger grids exist.
- **Combined variants:** Killer combined with Jigsaw/irregular regions, Windoku/Hyper (extra 3×3 regions), and others; the closely related **Mathdoku/KenKen** family generalizes cages to use ×, −, ÷ operators (and allows repeats), which is why the KDE generator treats Killer and Mathdoku with shared code.
- Related sum-based cousins: **Kakuro** (cross-sums, the direct ancestor), **Arrow Sudoku** (digits along an arrow sum to a circled cell), **Sandwich Sudoku** (sum between the 1 and 9).

**History.** Killer Sudoku fuses Sudoku and Kakuro. It was an established Japanese variant by the mid-1990s under the name *samunamupure*, a Japanized rendering of "sum number place." The most consistently credited inventor is Japanese puzzle designer **Miyuki Misawa**, with community and puzzle-industry sources (and a reported correction printed by *The Times*) crediting her; however, attribution genuinely conflicts in the sources — Grokipedia, for instance, states *The Times* "coined [the name] 'Killer Sudoku' by the puzzle editor to describe puzzles created by Japanese puzzle designer Tetsuya Nishio," while other sources describe Nishio (a famous Japanese puzzle master) as Misawa's teacher rather than the inventor. English Wikipedia deliberately names no inventor, describing the puzzle only as "an established variant... in Japan by the mid-1990s." Some community/AI-generated sources claim a first print appearance in the September 1994 issue of a Japanese "Nankuro" puzzle magazine, but this is not corroborated by mainstream or academic sources and should be treated as unverified. *The Times* of London introduced it to most of the English-speaking world on **31 August 2005**, coining the name "Killer Sudoku." *The Times* initially failed to state the no-repeat rule explicitly, then on 16 September 2005 ruled a digit CAN repeat, then reversed on 19 September 2005 to CANNOT — the version that stuck as the world standard. The variant has appeared at the World Sudoku Championship, which Wikipedia confirms has been "organized by the World Puzzle Federation since 2006, except in 2020 and 2021 during the COVID-19 pandemic" (first held in Italy in 2006).

### 2. Similarities and Differences vs. Regular Sudoku

| Dimension | Classic Sudoku | Killer Sudoku |
|---|---|---|
| Given digits | ~17–40 pre-filled cells | Typically none; only cage sums |
| Constraints | Row/col/box uniqueness | Same + cage sum + cage no-repeat |
| Entry point | Scan givens for singles | Extreme-sum cages + Rule of 45 |
| Arithmetic | None required | Single-digit addition throughout |
| Core added skill | — | Cage combination analysis |
| Difficulty anchor | — | Easy Killer ≈ medium classic |

**How the cage-sum constraint changes the solving space.** In classic Sudoku the only information is the givens. In Killer Sudoku the cage sums restrict candidate *sets* before any placement: a cage's size and target determine which digit combinations are even possible, and the no-repeat rule prunes further. This is a fundamentally different (and richer) source of deductions — combinatorial rather than positional. Because there are no givens, the solver must bootstrap entirely from arithmetic; the Rule of 45 is often the *only* available entry point in expert puzzles.

**Difficulty.** Multiple sources note easy Killer Sudoku is roughly equivalent to medium classic Sudoku, because the arithmetic layer adds work even when the logic is simple. Conversely, the extra constraints can make some Killers *easier* than they look, since cages sharply restrict candidates. Wikipedia notes simpler Killers "can be easier to solve than regular sudokus, depending on the solver's skill at mental arithmetic; the hardest ones, however, can take hours."

### 3. Solving Strategies and Techniques

**(a) Cage combination analysis.** The foundation. For each cage of size *n* and target *S*, enumerate the sets of *n* distinct digits 1–9 summing to *S*. Extreme sums have unique combinations ("magic cages"/"rigid cages"/"forced sets"): a 2-cell cage of 3 = {1,2}; of 17 = {8,9}. Minimum sum for an *n*-cell cage is 1+2+...+*n*; maximum is the top *n* digits. Progression: scan for unique-combination cages first, pencil in the digit set, then use them to eliminate candidates elsewhere.

**Complete cage combination tables (no-repeat, digits 1–9):**

*2 cells:* 3:12 · 4:13 · 5:14,23 · 6:15,24 · 7:16,25,34 · 8:17,26,35 · 9:18,27,36,45 · 10:19,28,37,46 · 11:29,38,47,56 · 12:39,48,57 · 13:49,58,67 · 14:59,68 · 15:69,78 · 16:79 · 17:89
*(Unique: 3, 4, 16, 17. Parity: if S odd → one odd + one even; if S even → two same-parity digits.)*

*3 cells (unique at 6,7,23,24; mirror around 15 via d→10−d):* 6:123 · 7:124 · 8:125,134 · 9:126,135,234 · 10:127,136,145,235 · 11:128,137,146,236,245 · 12:129,138,147,156,237,246,345 · 13:139,148,157,238,247,256,346 · 14:149,158,167,239,248,257,347,356 · 15:159,168,249,258,267,348,357,456 · ... · 23:689 · 24:789

*4 cells (min 10, max 30; unique at 10={1234} and 30={6789}):* e.g., 10:1234 · 11:1235 · 13:1237,1246,1345 · 20:1289,1379,1469,1478,1568,2369,2378,2459,2468,2567,3458,3467 · 30:6789

*5 cells (min 15, max 35):* 15:12345 · 16:12346 · ... · 34:46789 · 35:56789

*6 cells (min 21, max 39):* complement of the 3-cell table — a 6-cell cage of sum S contains exactly the digits *absent* from a 3-cell cage of sum 45−S. 21:123456 · ... · 39:456789

*7 cells (min 28, max 42):* complement of the 2-cell table. E.g., a 7-cell cage of 41 = all digits except a 2-cell "cage" of 4 = {1,3}, so it contains neither 1 nor 3 → {2,4,5,6,7,8,9}.

*8 cells (min 36, max 44):* missing exactly one digit = 45 − S. E.g., 8-cell sum 37 → missing 8.

*9 cells:* 45 = {1,2,3,4,5,6,7,8,9} (the whole house).

**(b) The Rule of 45 (innies and outies).** Every house sums to 45 (1+...+9). If all cages lie entirely within a house except one cell, that cell = 45 − (sum of the enclosed cages) for an *innie* (inside the house) or = (total of overlapping cages) − 45 for an *outie* (the cell sticking out). This extends to *N* adjacent houses: the innie/outie total = (sum of cages) − 45N. Multi-cell innies/outies create "pseudo-cages" — virtual cages assembled on the fly from rows/columns/boxes that need not align with the puzzle's printed cages; SudokuWiki treats these as one of the most versatile Killer techniques. A worked example: cages of 8+10+14+7+14 = 53 filling a nonet plus one outie → outie = 53 − 45 = 8.

**(c) Clock (modular-10) arithmetic** speeds innie/outie calculation: only track last digits. Adding a number ending in 7 to one ending in 8 gives last digit 5. Since the largest innie/outie value is 9, the last-digit change uniquely identifies it. Cage totals whose last digits sum to 10 cancel and can be skipped. Use with caution when a house has more than one innie/outie.

**(d) Multiple-square 45 rule / cage splitting.** When a cage straddles a house boundary with several cells inside and outside, the 45 rule yields the *sum* of the inside cells and of the outside cells separately, letting you split a large cage into two smaller virtual cages, each with fewer combinations.

**(e) Consistent-digit deduction.** Even a multi-combination cage may share a digit across all combinations: a 4-cell cage of 13 = {1,2,3,7},{1,2,4,6},{1,3,4,5} — every option contains a 1, so a 1 is guaranteed somewhere in the cage.

**(f) Uniqueness-based elimination.** Because the solution must be unique, patterns that would allow two solutions (e.g., two "doublet" cages occupying the same two rows/columns with identical digit pairs, swappable without affecting other cells) can be ruled out.

**(g) Classic techniques still apply.** Once candidates are pencilled in, all standard Sudoku methods operate: naked and hidden singles/pairs/triples, locked candidates/pointing pairs, box-line reduction, X-Wing, Swordfish, XY-Wing, coloring, and forcing chains. Naked subsets apply *across cage boundaries*. Expert Killers require chaining innie/outie deductions across multiple units and maintaining a full candidate grid from the start.

**Progression (beginner → expert):** (1) memorize 2- and 3-cell extreme sums; (2) apply the 45 rule to single boxes; (3) use combination tables + row/col/box eliminations; (4) single-unit innies/outies; (5) multi-unit 45 rule, cage splitting, pseudo-cages; (6) full classic advanced techniques + forcing chains.

### 4. Puzzle Generation

The standard pipeline (confirmed by the KDE KSudoku generator, hobbyist writeups, and academic work):

**Step 1 — Generate a completed grid.** Produce a valid full Sudoku solution (e.g., by solving a blank grid with an exact solver whose search order is randomized, or by seeding and shuffling). This is the puzzle's unique intended solution.

**Step 2 — Partition into cages.** Lay down connected, non-overlapping cages covering the grid. KDE's `CageGenerator` grows one cage at a time from a seed cell (`makeOneCage(seedCell, requiredSize)`), tracking unused cells and neighbor flags, using a direction enum (N/E/S/W) to attach adjacent cells — i.e., a randomized flood-fill/region-growing walk producing irregular connected polyomino cages. This mirrors the biased-random-walk growth used in other cage/polyomino puzzle generators. Constraints enforced:

- **Connectivity** (cells added only to orthogonal neighbors).
- **Maximum cage size** (`maxSize`) and **maximum cage value** (`maxValue`).
- **No duplicate digits** in a Killer cage (`hasDuplicates` check; for Mathdoku, `isSelfConsistent` allows repeats but not in the same row/column).
- **Maximum number of combinations** per cage (`maxCombos`) — a direct difficulty lever: fewer allowed combinations = more constrained = easier.
- **Number of single-cell cages** (`mSingles`, bounded by `mMinSingles`/`mMaxSingles`) — 1-cell cages act as clues/givens, so limiting them controls difficulty.

**Step 3 — Assign targets.** For each cage, sum the solution digits it covers to get the target (Killer uses only "+"; operators are always hidden). `setCageTarget` computes this; `setAllPossibilities`/`setPossibilities` enumerate every digit combination consistent with the target for use by the solver.

**Step 4 — Verify a unique solution.** Feed the cages (targets only) to a solver that counts solutions. KDE uses a **DLX (Dancing Links / Algorithm X)** exact-cover solver (`checkPuzzle` returns 0 = no solution, 1 = unique, >1 = multiple). If not unique, discard and regenerate. The exact-cover encoding for Sudoku uses 4 constraint families (cell, row, column, box) → 324 columns and up to 729 rows; Killer adds cage constraints. Alternatives widely used: plain **backtracking with constraint propagation / forward checking / MRV heuristics**; **SAT** (encode arithmetic cage constraints to CNF and use PicoSAT/etc.); and **CP-SAT / MIP** (Google OR-Tools `AddAllDifferent` + linear cage-sum constraints, or Gurobi), which express cage sums almost verbatim. Shuai Wang & Aashish Venkatesh's UvA case study "A SAT Attack on Killer Sudokus" reports that, using PycoSAT's Python API, "it took less than one second to obtain a solution for any killer sudoku problem," and that the authors "generated the first opensource killer sudokus database."

**Step 5 — Grade difficulty.** The accepted approach: run a *logical* solver that applies human techniques in increasing order of difficulty and record the hardest technique (and how often it is needed) required to crack the puzzle without guessing. Andrew Stuart (SudokuWiki), who commercially produces graded Killers, weights Killer-specific opportunities — unique-combination cages, innies/outies, cage splitting — on top of standard Sudoku technique scores; he notes grading is the puzzle-maker's greatest concern and that there is no single agreed mathematical standard, so it remains partly subjective and is often calibrated against real solver-time data. A 2020 hobbyist project (Kevin Hooke) similarly found the solver easy (a couple of weeks) but the difficulty *ranker* took most of a year, confirming grading is the hard part. Difficulty bands map to technique tiers: singles → easy; pairs → medium; triples/hidden subsets → hard; X-Wing/Swordfish/chains → expert.

**Practical/aesthetic considerations.**

- **Symmetry:** traditionally the cage layout is symmetric (diagonal, axial, or rotational), purely for aesthetics; Japanese setters often deviate slightly, and fully asymmetric puzzles exist. Symmetry does not affect logical difficulty.
- **Cage size limits:** publishers commonly cap cages at ~4–5 cells (occasionally more in hard puzzles); the no-repeat rule caps any cage at 9.
- **Combination-count tuning:** limiting `maxCombos` (as KDE does) both tunes difficulty and avoids overly loose cages.
- **Avoiding ambiguity:** the generator must reject layouts yielding multiple solutions; cage shapes should also be visually legible (dotted borders not mistaken for grid lines).

### 5. Mathematical and Computational Aspects

**Combinatorics of cage sums.** The number of ways to write a target *S* as a set of *n* distinct digits from 1–9 is the number of partitions of *S* into *n* distinct parts each ≤ 9. These are exactly the combination tables above. Key structural facts:

- Minimum for size *n* = *n*(*n*+1)/2; maximum = sum of top *n* digits.
- **Complementarity:** an *n*-cell combination of sum *S* corresponds one-to-one to a (9−*n*)-cell combination of sum 45−*S* (the complementary digit set), which is why 6/7/8-cell tables mirror 3/2/1-cell tables.
- **Mirror symmetry:** within a fixed size, sum *S* and sum (min+max−*S*) have the same count, via d→10−d.
- Counts peak at the middle sums (e.g., 3-cell sums peak at 15 with 8 combinations; 2-cell counts are largest at 9 with 4).

**Complexity class.** Solving *generalized* (*n*²×*n*²) Sudoku is **NP-complete**, proven by Takayuki Yato and Takahiro Seta (2003) — they also showed it is **ASP-complete** (finding another solution is hard), via reduction related to Latin-square completion (Colbourn's NP-completeness result). Killer Sudoku is at least as hard, since it is standard Sudoku plus additional constraints; the general problem is NP-complete. For **fixed 9×9**, the problem is finite and trivial in the worst-case-asymptotic sense; in practice SAT/CP/DLX solvers dispatch any 9×9 Killer in milliseconds to under a second. The number of completed classic 9×9 Sudoku grids is 6,670,903,752,021,072,936,960 (Felgenhauer & Jarvis, 2005). The number of *essentially different* grids up to symmetry — 5,472,730,538 — was computed by Ed Russell & Frazer Jarvis (7 September 2005) by applying Burnside's Lemma over the Sudoku symmetry group (of size 3,359,232 × 9! = 1,218,998,108,160).

**Academic/notable treatments.**

- Yato & Seta, "Complexity and completeness of finding another solution and its application to puzzles" (2003) — NP- and ASP-completeness.
- Lynce & Ouaknine, "Sudoku as a SAT problem" (2006) — SAT encodings; extended encoding lets unit propagation solve about half of a hard set.
- Simonis, "Sudoku as a constraint problem" — CP models with redundant constraints via bipartite matching/flow.
- Wang & Venkatesh, "A SAT Attack on Killer Sudokus" (UvA) — first SAT approach specifically for Killer, with open-source code and a database of "1000 example sudokus and its answers for a maximum cage size of 2 to 9 each."
- Work on difficulty rating (Mantere et al., genetic algorithms; Xu et al., entropy; Pelánek).

### 6. Practical Resources

**Open-source solvers/generators.**

- **KDE KSudoku** (`src/generator/cagegenerator.h`): production C++ generator for Killer and Mathdoku using region-growing cage generation + DLX uniqueness checking. The best-documented open reference for the full generation pipeline.
- **avishekhbharati/Killer-Sudoku-Solver** (Java): backtracking, Algorithm X, and Dancing Links.
- **2pa4ul2/Killer-Sudoku** (Python): backtracking, backjumping, and simulated annealing.
- **UvA-KR16 "Killer Sudoku"** (PycoSAT): SAT-based, with paper and dataset.
- GitHub `killer-sudoku` topic: OR-Tools CP-SAT and Gurobi MIP solvers, Ruby/C#/C solvers, and solvers spanning Kakuro/Str8ts/Futoshiki.
- Google **OR-Tools CP-SAT** is a natural fit: `NewIntVar(1,9)` per cell, `AddAllDifferent` for rows/columns/boxes and each cage, plus a linear sum equality per cage; `enumerate_all_solutions` verifies uniqueness.
- Combination calculators: godoku.com, sudoku-tools.com, craigmbooth.com, sudokuleader.com.

**Publishers, apps, and providers.**

- ***The Times*** (London) — original English publisher; also runs Super Sudoku and Tredoku.
- **Cracking the Cryptic** — the dominant modern brand; YouTube channel run by Simon Anthony and Mark Goodliffe (both UK World Sudoku Championship representatives) with a dedicated hand-crafted, hand-hinted "Killer Sudoku" app (Studio Goya), plus SudokuPad for community puzzles.
- **Krazydad** — hundreds of free printable graded Killer booklets with cage cheat-sheets.
- **Conceptis, Penguin, Dell Magazines, Nikoli** — print/syndication publishers.
- **sudoku.com, sudokusolver.com/godoku.com/supersudoku.com, miniwebtool** — free online generators/solvers with difficulty tiers and seed reproducibility.

## Recommendations

For a technically sophisticated reader intending to **build a Killer Sudoku generator**, proceed in stages:

1. **Start with a solver, not a generator.** Implement two: (a) a fast exact solver — either DLX/Algorithm X (fastest, ~0.03 s/puzzle) or CP-SAT via OR-Tools (fastest to *write*: `AddAllDifferent` + per-cage linear sum). Use it in solution-counting mode (stop at the 2nd solution) for uniqueness checks. *Benchmark to hit: solve/verify any 9×9 in <100 ms.*
2. **Add a logical (human-technique) solver separately.** This is the component that grades difficulty. Implement techniques in tiers (singles → combinations/45-rule → pairs/innies-outies → subsets/fish → chains). *This will be the bulk of your effort — budget accordingly; the exact solver is the easy 20%.*
3. **Generate:** full grid (randomized DLX/CP fill) → region-grow connected cages with tunable `maxSize`, `maxCombos`, and single-cell-cage bounds (copy KDE's parameterization) → assign "+" targets → reject non-unique layouts → grade with the logical solver → keep only puzzles whose hardest required technique matches the target band.
4. **Tune difficulty via cage structure,** not clue count: fewer allowed combinations per cage and more small/extreme-sum cages = easier; larger cages with many combinations and reliance on multi-unit innies/outies = harder.
5. **Aesthetics:** enforce cage symmetry only if you want the "hand-crafted" look (it costs generation attempts and doesn't affect difficulty); cap cages at 4–5 cells for mainstream appeal.

**Thresholds that would change the approach:** if you need *hardest-possible* puzzles or want provably guess-free logical solvability, lean on the logical solver as the acceptance gate (reject anything needing a guess) and consider SAT-based difficulty analysis (Lynce/Ouaknine style). If you only need bulk easy/medium puzzles, a backtracking counter + a shallow technique grader suffices and is far simpler.

## Caveats

- **Inventor attribution is uncertain.** Miyuki Misawa is the most consistently credited originator (backed by a reported *Times* correction), but sources genuinely conflict (Grokipedia credits Tetsuya Nishio; others call Nishio her teacher), English Wikipedia names no inventor, and the specific "September 1994 / *Nankuro* magazine" first-appearance claim comes only from community/AI-generated wikis and is **unverified** by mainstream or academic sources. Treat precise origin details as provisional.
- **Difficulty grading is not standardized.** There is no universally agreed mathematical difficulty metric; ratings are partly subjective, vary between publishers, and are best calibrated against real solver-time data. The same puzzle may be rated differently by different engines.
- **"NP-complete" applies to the generalized (n²×n²) problem,** not fixed 9×9, which is finite and solved instantly in practice. Don't over-interpret the complexity result as meaning 9×9 Killers are computationally hard to solve — they are not.
- **Some cited difficulty/grading and time-estimate figures** come from puzzle-community sites and hobbyist projects rather than peer-reviewed sources; the combination tables themselves are exhaustively verifiable and reliable, but weightings and time estimates are illustrative.
- The **repeated-digit Killer variant** exists but is rare; assume the no-repeat convention unless a puzzle states otherwise.
