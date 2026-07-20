# Killer Sudoku Beyond 9×9: A Grid-Size Variant Guide for Engine Builders

## TL;DR
- **6×6 (digits 1–6, rectangular 2×3 or 3×2 boxes) is the only widely published non-9×9 Killer size**, positioned as a beginner/tutorial format; 8×8, 12×12, and 16×16 exist as genuine published puzzles but are niche/novelty, and in every case the core rules scale mechanically — house-sum target, no-repeat-in-cage, and maximum cage size all track the digit count N.
- **Nothing conceptual changes when you resize — only the constants do.** The "Rule of 45" generalizes to N(N+1)/2: Rule of 21 (6×6), 36 (8×8), 78 (12×12), 136 (16×16); the maximum cage size caps at N cells; and the combination tables shrink dramatically at 6×6 and explode at 12×12/16×16.
- **For an engine, the correct design is a solver/generator fully parameterized on grid order N**, exactly as KDE's open-source KSudoku does (its `makeCages()` exposes maxSize, maxValue, and maxCombos as tunable parameters). Bitmask backtracking remains efficient at 16×16 provided you widen the per-house masks from 16-bit (which fits 1–9) to 32-bit.

## Key Findings

1. **6×6 is the dominant alternate size and the only one with real "product" demand.** It uses digits 1–6 in rectangular 2×3 or 3×2 boxes. Because 6 has no integer square root, non-square boxes are *mandatory*, not a stylistic choice. It is genuinely published and playable: Andrew Stuart's sudokuwiki.org runs a dedicated 6×6 Killer solver (released as version 2.31.1 on 13 March 2025, with the packed-string prefix "L6C"), and Amuse Labs' PuzzleMe, sudokus.io, and sudoku-tools.com all support 6×6 Killer/cage math. It is explicitly marketed as an onboarding format for people learning the cage mechanic before graduating to 9×9.

2. **8×8, 12×12, and 16×16 are real but niche.** 8×8 uses 2×4 boxes and digits 1–8 (house sum 36); 12×12 uses 3×4 or 4×3 boxes and digits 1–12 (house sum 78); 16×16 uses 4×4 boxes and digits 1–16 (house sum 136). Puzzlephil's Killer Sudoku page states verbatim: *"Meaningful sizes vary between 6x6 and 16x16."* Sudoku Leader is blunter: *"Almost all published Killer Sudoku puzzles use the standard 9×9 board with 3×3 boxes, because cage math becomes either too restrictive on smaller grids (4×4 or 6×6) or computationally explosive on larger grids (16×16 and 25×25)."* That is the correct one-line summary of the market: 9×9 is the product; everything else is a specialty.

3. **The rules scale mechanically and predictably.** The three core Killer rules are identical at every size — (a) each row, column, and box contains each symbol once; (b) each cage's digits sum to its clue; (c) no digit repeats within a cage. Only the constants change: digit range becomes 1..N, the per-house sum becomes N(N+1)/2, and the maximum cage size caps at N cells (a cage of N+1 cells would force a duplicate). Wikipedia's Killer article states the 9×9 form of rule (c) explicitly — no repeat within a cage "implies that no cage can include more than 9 cells" — which generalizes directly to "no more than N cells."

4. **The combinatorial space collapses at 6×6 and inflates at large N.** With only digits 1–6, 2-cell and 3-cell cages have far fewer combinations, and unique-combination ("magic") cages are concentrated at the extremes. This changes difficulty tuning materially (details below).

5. **Larger grids need extended symbol systems and wider bitmasks.** For N > 9 there is no single convention: KSudoku's handbook says its symbols "are usually the numbers 1 to 9, but may be the letters A to P or A to Y in larger puzzles" (A–P for 16×16, A–Y for 25×25); SudokuBliss's 16×16 uses the characters 1–9 then A–G (nine digits plus seven letters = 16 symbols); other publishers print two-digit numbers 10–16. Any of these is fine as long as the engine treats symbols as indices 1..N internally.

6. **KDE KSudoku is the reference open-source multi-size Killer engine.** Its cage generator is fully parameterized, and its README states the underlying algorithm "is extendible to any general graph coloring problem," with boards for classic Sudoku "currently supported [at] 9x9, 16x16, 25x25."

## Details

### 1. Common grid sizes and box dimensions

| Grid | Digits/symbols | Box shape | House sum N(N+1)/2 | Max cage size | Real-world status |
|------|----------------|-----------|--------------------|---------------|-------------------|
| 4×4 | 1–4 | 2×2 | 10 | 4 | "Tiny Killer" — tutorial only (KSudoku ships this) |
| 6×6 | 1–6 | 2×3 or 3×2 | 21 | 6 | **Common beginner/onboarding format** |
| 8×8 | 1–8 | 2×4 | 36 | 8 | Niche; sold in puzzle books, some apps |
| 9×9 | 1–9 | 3×3 | 45 | 9 | **Standard — ~all published Killer** |
| 12×12 | 1–12 | 3×4 or 4×3 | 78 | 12 | Niche/novelty; books + a few apps |
| 16×16 | 1–16 (or 1–9,A–G / A–P) | 4×4 | 136 | 16 | Rare/novelty; specialty "mega" books |
| 25×25 | 1–25 (or A–Y) | 5×5 | 325 | 25 | Extremely rare; mostly classic, not Killer |

Non-square boxes appear whenever N is not a perfect square (6→2×3, 8→2×4, 12→3×4). A 5×5 Killer is effectively impossible: as the Puzzle Wiki notes, a proper 5×5 Sudoku cannot exist with meaningful regions because 5 is prime, so its only "boxes" would be the rows/columns themselves. This is why the practical size ladder is 4, 6, 8, 9, 12, 16, (25) — the composite numbers.

### 2. Rule changes by grid size

- **Digit range** widens to 1..N. Everything downstream (candidate sets, pencil marks, bitmask width) follows from this.
- **House-sum invariant** becomes N(N+1)/2. The 9×9 "Rule of 45" (subtract known cage totals from 45 to solve an "innie"/"outie") works identically at every size with the new constant: 21 for 6×6, 36 for 8×8, 78 for 12×12, 136 for 16×16. The Wikipedia "innies/outies" and "clock arithmetic" (mod-10) shortcuts still apply, though for N>9 the modular check would use mod (N+1)-style reasoning rather than mod 10.
- **No-repeat-in-cage** is unchanged, but its consequence — the maximum cage size — scales to N. At 6×6 the largest possible cage is 6 cells (summing to 21); at 16×16 it is 16 cells (summing to 136).
- **Complement symmetry** used for large cages generalizes: at 9×9 a 6-, 7-, or 8-cell cage is the complement of a 3-, 2-, or 1-cell cage against 45. At size N, a k-cell cage complements an (N−k)-cell cage against N(N+1)/2. This is a useful identity to build into a combination-table generator so you compute only half the table.

### 3. Cage combination tables for 6×6 (digits 1–6)

The full 6×6 tables are small enough to enumerate by hand. The unique-combination ("magic") cages — where the number of possible digits equals the cage size — sit at the extreme sums:

- **2-cell cages** (range 3–11): sum 3 = {1,2} (unique); sum 4 = {1,3} (unique); sum 10 = {4,6} (unique); sum 11 = {5,6} (unique). Interior sums 5–9 have 2–3 combinations each (e.g., sum 7 = {1,6},{2,5},{3,4}).
- **3-cell cages** (range 6–15): sum 6 = {1,2,3} (unique); sum 7 = {1,2,4} (unique); sum 14 = {3,5,6} (unique); sum 15 = {4,5,6} (unique). Combinations are mirrored around the midpoint (10.5), so you only need to compute up to sum 10.
- **4-cell cages** (range 10–18): the extremes 10 = {1,2,3,4} and 18 = {3,4,5,6} are unique; these are the complements of the 2-cell extremes against 21.
- **5-cell cages** (range 15–20) and the single **6-cell cage** (sum 21 = {1,2,3,4,5,6}) are all effectively forced or near-forced.

Contrast with 9×9, where 2-cell cages span 3–17, 3-cell cages span 6–24, and mid-range 4-/5-cell cages have too many combinations to memorize. The practical consequence: **the 6×6 combinatorial space is small enough that a naive generator will very often produce cages with only one or two viable combinations**, which is exactly why 6×6 tends toward "easy." Andrew Stuart split the 6×6 Killer solver out from his 6×6 KenDoku solver precisely because the small digit range makes the two behave differently.

### 4. Difficulty implications of smaller grids

- **6×6 is genuinely easier**, and this is inherent, not incidental: fewer digits ⇒ fewer combinations per cage ⇒ more cages resolve to a single combination ⇒ more forced placements early. sudokus.io markets 6×6 as "an ideal choice for those new to the game" that can be finished in 5–10 minutes; minisudoku.com frames 6×6 as "a smaller version of the classic 9x9… a better choice for newcomers."
- **But 6×6 is not trivially easy.** Competitive setters produce hard 6×6 Killers — the MIT Sudoku Competition 2023 "Experienced" division included a 6×6 Killer worth 18 points (its highest-value item in that round), and Logic Masters Deutschland hosts hand-crafted 6×6 Killer variants. So an engine should still expose a difficulty range for 6×6, just a compressed one.
- **Difficulty-tuning parameters must be recalibrated, not reused.** The 9×9 levers still exist — number of single-cell cages (givens), maximum cage size, and maximum combinations per cage — but their ranges shrink. A "max 3 combinations per cage" rule that produces a medium 9×9 puzzle will produce an almost-trivial 6×6 puzzle, because at 6×6 far more cages are already ≤3 combinations. The right approach is to re-derive thresholds per N against the actual (smaller) combination distribution rather than scaling the 9×9 numbers linearly. KSudoku's developers noted this non-linearity explicitly on their mailing list: difficulty "raises with the grid size and I don't think it's linear," and their 9×9 Killer generator initially produced puzzles that were "far too hard… too many possibilities and not enough leads."

### 5. Larger grid variants (12×12, 16×16, and up)

- **They exist in print and online.** Examples: the Amazon title *KILLER LEVEL MEGA SUDOKU 16X16 Grids* by V.P. Nightshade / Journals ForYou (ASIN B08XGSTQ2X, ISBN 9798714256318); multiple 12×12 Killer books from Clarity Media (*Large 12x12 Killer Sudoku*, ISBN 9781540768346, which specifies "each number from 1–12… in each row, column and 3x4 bold-lined box") and John Collins's *Killer Sudoku 120 Easy To Master Puzzles 12x12* series; and Escape Sudoku's online *Easy Killer Sudoku 16X16* (escape-sudoku.com/game/killer-16x16-easy), described as "a huge 16x16 Killer Sudoku grid… a light Killer Sudoku [that] can take a lot of time." These confirm 12×12 and 16×16 Killer are produced, but by specialty publishers, not mainstream newspapers.
- **Symbol systems vary and you must choose one.** KSudoku uses letters A–P for 16×16 and A–Y for 25×25; SudokuBliss's 16×16 uses 1–9 then A–G; puzzle books frequently print two-digit numbers 10–16. Internally, always store symbols as integer indices 1..N and map to display glyphs at the presentation layer.
- **New cage-generation complexity.** Cage tables must extend up to N-cell cages (16-cell cages summing to as much as 136 at 16×16). The number of combinations for mid-range large cages grows combinatorially, so unique-combination cages become proportionally rarer in the interior and are concentrated at the extremes — meaning large-grid Killers lean on the Rule-of-N(N+1)/2 and extreme-cage logic even more than 9×9 does.
- **Solver/generator performance.** Sudoku is NP-complete in the general n×n case (a well-established result), so worst-case cost grows fast, but practical solvers scale acceptably. Bitmask backtracking (tracking used digits per row/column/box as bits of an integer, with fast OR/AND/AND-NOT updates) is the standard efficient approach and is size-agnostic *except for mask width*: a 9×9 house fits in a 16-bit mask, but 12×12 and 16×16 need ≥16 and ≥32 bits respectively, so move to 32-bit (or 64-bit) integers. Open-source multi-size backtracking solvers (e.g., felibatista/sudoku-solver on GitHub, "capable of solving Sudokus up to 16x16") confirm the approach carries over. For Killer specifically, the cage-sum constraint is best layered on as an additional pruning check or modeled as an exact-cover problem — KSudoku uses a **DLX (Dancing Links) solver** to verify uniqueness of generated Killer/Mathdoku puzzles, which is the recommended pattern for larger grids where plain backtracking would explore too much.

### 6. Non-square / irregular (jigsaw) variants

- **Irregular Killer exists.** Logic Masters Deutschland hosts, for example, an "All pairs killer sudoku (8x8 irregular)" that combines jigsaw regions ("boxes defined by the thick black lines"), standard Killer cages, and an extra all-pairs constraint. This confirms Killer cages compose cleanly with jigsaw regions — the cage layer is independent of the region-shape layer.
- **Puzzlephil** explicitly offers Killer Sudokus "with irregular and/or additional coloured regions," i.e., jigsaw + Killer and hyper/window + Killer hybrids. There is also a documented Killer-X variant (long diagonals as extra houses).
- **Mini Killer for onboarding.** KSudoku ships a 4×4 "Tiny Killer" whose purpose is teaching the mechanic; 4×4 and 6×6 are the standard tutorial rungs.

### 7. Practical sources and libraries

- **KDE KSudoku (GPL, C++)** is the most useful reference. Its cage generator header (`src/generator/cagegenerator.h`) exposes the key signature verbatim: `int makeCages (SKGraph * graph, QList<int> * solutionMoves, int maxSize, int maxValue, bool hideOperators, int maxCombos);`, documented as maxSize = "the maximum number of cells a cage can have," maxValue = "the maximum total value a cage's cells can have," and maxCombos = "the maximum number of possible solutions any cage can have." Difficulty is requested via `generateMathdokuTypes(..., Difficulty difficultyRequired)` in `mathdokugenerator.cpp`, which selects the numeric maxSize/maxValue/maxCombos per level — **this is exactly the parameterization model to copy**: expose cage-size cap, cage-sum cap, and per-cage combination cap as the three difficulty knobs, and set them per grid order. KSudoku's geometry object (`SKGraph`) carries `mOrder` (grid height/width) and `mBoardArea`, so size is a first-class parameter throughout. Note: KSudoku's *Killer Sudoku* variant ships as 4×4 Tiny Killer and 9×9; its *Mathdoku* (KenKen-style) engine supports any size 3×3–9×9 — so the codebase demonstrates size-parameterization even though it doesn't itself ship a 6×6 Killer.
- **anydoku-sudoku-solver (MarcoVad, GitHub)** is a "versatile solver for any sudoku type, single/multi board, any size, jigsaw, multifield, oddeven, diagonal, calcudoku, killer." Its design abstracts a "field" as "a group of cells that contain all numbers once," handled identically for square boxes, diagonals, and jigsaw fields — a good architectural template for size- and variant-agnostic engines.
- **dCode's 8×8 solver** and various online cage calculators (sudoku-tools.com supports both 9×9 and 6×6 cage sums) show the ecosystem already treats size as configurable.

## Recommendations

1. **Ship 6×6 first.** It is the only alternate size with real audience demand (tutorial/kids/quick-play), and its small combination space is the easiest to validate. Use rectangular boxes (offer both 2×3 and 3×2 as a layout option). Benchmark to change course: if user analytics show <5% engagement with 6×6 after launch, don't build 8×8/12×12/16×16.
2. **Parameterize the whole pipeline on grid order N from day one**, even before adding sizes. Replace every hardcoded 9, 3, and 45 with N, box-width/height, and N(N+1)/2. Generate combination tables programmatically per N (exploiting complement symmetry against N(N+1)/2) rather than storing a 9×9 table. This is a refactor you want to do while the codebase is small.
3. **Recalibrate difficulty per size, don't scale linearly.** Re-derive your single-cage/max-cage-size/max-combos thresholds against each grid's actual combination distribution. Expect 6×6 to need a *compressed* difficulty range (its "hard" ≈ 9×9 "easy–medium"); expect 12×12/16×16 to need *tighter* combination caps to stay solvable by logic. Treat KSudoku's three knobs (maxSize, maxValue, maxCombos) as your model.
4. **Adopt a two-tier solving architecture for large grids:** fast bitmask backtracking with 32-bit masks for the search, plus a DLX/exact-cover uniqueness check for generation (the KSudoku pattern). Threshold: switch on the wider mask and the DLX uniqueness verifier for any N ≥ 12; plain 16-bit backtracking is fine through 9×9.
5. **Abstract symbols as indices 1..N** with a pluggable glyph map (digits, 1–9+A–G, A–P, or 10–16), so N>9 is a display concern only.
6. **If you add irregular/jigsaw Killer,** keep the region layer and the cage layer independent (as anydoku does) so they compose without special-casing.

## Caveats

- **The exact per-difficulty numeric values** KSudoku passes to `makeCages()` (the specific maxSize/maxValue/maxCombos for VeryEasy…Diabolical) could not be retrieved — the implementation file `mathdokugenerator.cpp` is not accessible to automated fetch on either GitHub raw or KDE GitLab. The *parameter framework* (the three tunable knobs and their meanings) is confirmed verbatim from the header; the concrete constants are not. If you need them, clone the repo (`github.com/KDE/ksudoku` or `invent.kde.org/games/ksudoku`) and read `src/generator/mathdokugenerator.cpp` directly.
- **The "niche/novelty" classification of 8×8, 12×12, and 16×16 Killer** is a judgment based on market evidence (they appear in specialty self-published books and a handful of apps, not in mainstream newspaper syndication), corroborated by Puzzlephil's and Sudoku Leader's statements. It is not a hard, quantified figure.
- **Symbol conventions for N>9 are not standardized** across publishers; the examples given (A–P, 1–9+A–G, 10–16) are all in real use, so any consuming/importing code must be tolerant of multiple encodings.
- **6×6 combination specifics** above were derived by direct enumeration of digits 1–6 (arithmetic is straightforward and self-checking); published 6×6-specific combination tables are less common online than 9×9 tables, though sudoku-tools.com provides a live 6×6 cage calculator you can cross-check against.
- Several cited playing sites are commercial puzzle portals; their marketing copy ("meditative," "true mental upgrade") is promotional and was disregarded except where stating factual grid parameters.