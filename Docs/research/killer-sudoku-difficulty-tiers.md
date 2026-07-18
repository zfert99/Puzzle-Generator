# What Determines Killer Sudoku Difficulty Tiers: A Builder's Reference

## TL;DR

- Killer Sudoku difficulty is driven by four tunable cage levers — **number of single-cell cages (givens), maximum cage size, maximum cage sum, and maximum digit-combinations per cage (ambiguity)** — plus a **required-technique ceiling** and the **density/dependency of solving opportunities**; these are the parameters real generators (KDE KSudoku) and graders (Andrew Stuart/SudokuWiki) actually expose.
- The single most reliable published mapping is the **technique-tier ladder**: Easy uses singles + single-combination cages + 1-cell Rule-of-45; Medium adds pairs/triples + pointing/box-line + easy combinations; Hard adds multi-cell innies/outies, cage splitting, hard combinations, X-Wing/Y-Wing/Swordfish; Expert (Diabolical) adds X-Cycles, XY-Chains, 3D Medusa, Jellyfish, Aligned Pair Exclusion; Extreme adds Grouped X-Cycles, finned fish, AIC, Almost Locked Sets, Death Blossom and forcing nets.
- Exact per-tier single-cage *counts* are **convention, not hard-published fact**: constructors agree single cages are used freely in Easy/Medium and largely eliminated in Hard+, but no authoritative table of "Easy = 4–6 singles, Expert = 0" exists publicly; scoring is done by weighted technique frequency × opportunity density, not by cage counts alone.

## Key Findings

### The controlling parameters (what to tune)

The KDE **KSudoku** generator (the most-cited open-source Killer/Mathdoku generator, authored by Ian Wadham, 2015) exposes exactly the levers a builder needs. Its `CageGenerator::makeCages()` takes `maxSize` (max cells per cage), `maxValue` (max cage sum), and `maxCombos` (max number of digit combinations any cage may have). Internally it also tracks `mMinSingles` and `mMaxSingles` — the minimum and maximum number of 1-cell cages. The header comment states plainly: *"Cages of size 1 have only one possible solution, so they act as givens or clues."* The driver function `generateMathdokuTypes(..., Difficulty difficultyRequired)` selects these parameter values according to the requested difficulty. This confirms, from production code, that difficulty is set by (a) how many single-cell givens are allowed, (b) how large cages may get, (c) how large sums may get, and (d) how ambiguous (many-combination) cages may be.

Andrew Stuart's grader (SudokuWiki) is the most authoritative published grading description. His paper *Sudoku Creation and Grading* states the Killer-specific grading inputs directly: single-combination cages, innies/outies, and cage splitting are *"weighted and factored into the grading process,"* and cage grids are **rejected if there are too many 2-cell cages or too many single cages** — with single cages *"useful for gentle and moderate Killers but not suitable for higher grades."*

### 1. Single-cell cages (givens) across tiers

- **Confirmed direction:** Single-cell cages behave exactly like classic Sudoku givens (they resolve to one value immediately). Easy/Medium Killers use them liberally; Hard/Expert/Extreme minimize or eliminate them. Stuart explicitly discards cage grids with too many single cages for higher grades. KSudoku encodes this as a `mMinSingles`/`mMaxSingles` range that narrows as difficulty rises.
- **Not publicly quantified:** There is no authoritative published table giving exact single-cage counts per named tier (e.g., "Easy = 4–6, Expert = 0–1"). This is constructor convention. Note also that many modern Hard+ Killers use **zero given cells** — several sources describe expert Killers as starting from a completely empty grid.

### 2. Cage size distribution across tiers

- Standard cages are 2–5 cells, "occasionally more in harder puzzles." Easier puzzles lean on small (2–3 cell) cages whose combinations are quickly pinned; harder puzzles introduce larger 4–8 cell cages.
- Larger cages matter because of combination count, not size per se: a 4-cell 24-cage has multiple combinations while a 3-cell 24-cage is uniquely 7/8/9. KSudoku's `maxSize` rises with difficulty; Stuart rejects grids with too many 2-cell cages (which are too helpful).
- No public per-tier percentage breakdown of 2- vs 3- vs 4+-cell cages exists as an authoritative standard; it emerges from the maxSize/maxCombos constraints rather than being specified directly.

### 3. Cage combination count (ambiguity) — the central ambiguity lever

- This is the most directly tunable difficulty knob and is explicitly a code parameter: KSudoku's `maxCombos` caps how many digit combinations any cage may have. Low `maxCombos` → many "unique-combination" cages → easy. High `maxCombos` → ambiguous cages that only resolve after cross-referencing → hard.
- Stuart distinguishes cages with **only one combination** (his example: a 4-cell cage summing to 10 can only be 1/2/3/4; a 2-cell cage of 3 must be 1+2) from cages with more possibilities than cells, noting human solvers *"always identify those cages that have a restricted set that matches the number of cells."*
- **Concrete combination facts for tuning:**
  - 2-cell cages: sums range 3 (=1+2) to 17 (=8+9). Unique-combination ("magic") 2-cell sums: 3, 4, 16, 17.
  - "Magic cages" (single combination) always sit at the extreme low and high ends of each cage size's sum range.
  - Ambiguous example: a 5-cell cage summing to 25 has many combinations; a 4-cell 24-cage has eight combinations (1/6/8/9 … 4/5/7/8) while a 3-cell 24-cage has exactly one (7/8/9).
  - SudokuWiki's solver splits "Killer Combinations (easy)" — 2-cell and single-combination cages — from "Killer Combinations (hard)" — cages with several combinations — placing them at opposite ends of its difficulty-ordered strategy list.

### 4. Required solving techniques per tier (the best-documented mapping)

SudokuWiki's Killer solver (v2.60) orders 37 strategies into explicit grade groups. This is the closest thing to a published technique-to-difficulty map for Killer:

- **Easy (steps 1–8, "basic"):** Hidden Singles; Naked + Hidden Pairs; Innies & Outies (single cell) via Rule of 45; Killer Combinations (easy) — 2-cell and single-combination cages; Pointing Pairs; Box/Line Reduction; Naked + Hidden Triples; Captured Candidates (Cage/Unit Overlap).
- **Medium:** Same family but leaning on pairs/triples, pointing pairs, box/line reduction, and cross-boundary cage-combination elimination — Stuart's "Moderate" grade is defined as requiring "simple strategies as Naked and Hidden Pairs and Triples."
- **Hard / Tough (steps 9–23):** X-Wing; Chute Remote Pairs; Y-Wing; W-Wing; Rectangle Elimination; **Cage Splitting**; **Innies/Outies (2+ cells / pseudo-cages)**; Cage/Unit Overlap; Killer Combinations (hard, multi-combination cages); Rule of Parity; Cage Comparison; Simple Colouring; Naked + Hidden Quads; Swordfish; XYZ-Wing.
- **Expert / Diabolical (steps 24–29):** X-Cycles; XY-Chain; 3D Medusa; Jellyfish; WXYZ-Wing; Aligned Pair Exclusion.
- **Extreme (steps 30–37):** Grouped X-Cycles; Finned X-Wing; Finned Swordfish; Alternating Inference Chains; Almost Locked Sets; Death Blossom; Forcing Nets; and, as last resort, Bowman's Bingo.

The KSudoku handbook corroborates the coarse mapping: "Hard and Diabolical levels may take an hour or so and are intended to be equivalent to difficult grades appearing in newspapers."

### 5. Generator source-code parameters

- **KSudoku (KDE, C++):** difficulty is set by `maxSize`, `maxValue`, `maxCombos`, `mMinSingles`, `mMaxSingles`. The `Difficulty` enum spans roughly VeryEasy → Easy → Medium → Hard → Diabolical → Unlimited, and `generateMathdokuTypes()` maps each to a parameter set, then generates cages and verifies a unique solution via a DLX (Dancing Links) exact-cover solver, retrying if the cage grid yields no unique solution.
- **Exact numeric values could not be retrieved.** The specific integer constants assigned per difficulty live in `mathdokugenerator.cpp` and `cagegenerator.cpp`, which were not accessible via available fetch tooling (GitHub blob/raw and Debian source mirrors were gated). The parameter *names, meaning, and difficulty-dependence* are confirmed from the header files; the *numbers* are not publicly quoted here and should be read directly from the source (KDE/ksudoku on GitHub, invent.kde.org, or a Debian `ksudoku` source package) before relying on them.

### 6. Structural / layout factors beyond cages

- **Opportunity density / bottlenecks:** Stuart's primary structural metric is how many independent solving opportunities exist at each stage. Many simultaneous opportunities → easy; few or single "bottlenecks" → hard. He rejects puzzles that are trivial except for one hard bottleneck (high score but unsatisfying).
- **Dog-leg (multi-box) cages:** Cages spanning box/row/column boundaries are harder because they delay when the Rule of 45 becomes usable and they carry the no-repeat constraint across boxes. Stuart discards dog-leg cages that could legally repeat a digit at their two ends.
- **Symmetry:** Aesthetic, not logical, but the KSudoku handbook notes puzzles with no symmetry "tend to be slightly harder." Stuart's older puzzles were symmetrical; his post-2012 Killers are "seldom symmetrical" and more challenging.
- **Delaying single-house solvability:** Hard puzzles are constructed so that no single box/row/column is immediately resolvable by 45, forcing multi-house innie/outie deductions (spanning 2–3 houses) and pseudo-cages.

### 7. Quantitative / empirical difficulty metrics

- **Stuart's weighted scoring (the model to copy for Killer):** the final grade is *not* the single hardest technique. It combines (a) **opportunity frequency** — number of "rounds" and average cells solved per round — with (b) the **sum of weighted scores of every strategy instance used**, plus heuristic modifiers. His worked diabolical example scores each technique by candidates removed and cells solved (e.g., X-Wing weighted heavily, Aligned Pair Exclusion heavily), giving a raw 587.2 opportunities score, then a final composite score of 379.0. Technique *frequency* matters: a puzzle needing many medium steps can outscore one with a single hard step.
- **Contrast — peak-difficulty scoring (Sudoku Explainer):** SE difficulty "is rated by the hardest solving technique that is required to solve it" on a 1.0–11.9 scale (SE FAQ / SukakuExplainer wiki): e.g. 1.0 "Last value in block, row or column," 4.2 XY-Wing, 6.2 Aligned Pair Exclusion; Arto Inkala's AI Escargot was rated 11.0, "the highest rating the tool could assign at the time."
- **Contrast — cumulative-work scoring (HoDoKu/SudokuWiki):** HoDoKu's rating is "a sum of ALL of the scores for every step in a solution path" (enjoysudoku.com forum), measuring total work rather than peak difficulty — e.g. a puzzle scoring 2182 in HoDoKu maps to ~7.1 in Sudoku Explainer. Both peak and cumulative aspects are relevant to human-perceived difficulty.
- **Academic metrics:** Ercsey-Ravasz & Toroczkai proposed a transient-chaos "Richter-scale" hardness η = −log₁₀κ; in "The Chaos Within Sudoku," *Scientific Reports* 2:725 (2012)/arXiv:1208.0370, they set "easy puzzles falling in the range 0<η≤1, medium ones within 1<η≤2, hard in 2<η≤3 and ultra-hard with η>3… there are no known puzzles with η>4," and the "Platinum Blonde" puzzle scores η=3.5789. Radek Pelánek's overview (arXiv 1403.7373) identifies two difficulty sources: complexity of individual logical steps and the dependency structure among steps — directly paralleling Stuart's technique-weight + opportunity-density model. For Killer specifically, academic treatment frames it as a Constraint Satisfaction Problem and grades by hardest technique required; large labelled Killer datasets exist — e.g. Krazydad publishes five named Killer tiers, Intermediate, Challenging, Tough, Super-Tough and Insane, "ordered by ascending difficulty" (krazydad.com/killersudoku), the grading system also used in Jim Bumgardner's *Krazydad Psycho Killer Sudoku Volume 1: 360 Tough to Insane Puzzles.*

## Details

### A practical five-band parameter model for a builder

Synthesizing the KSudoku levers and the SudokuWiki technique ladder, a defensible tuning scheme is:

| Lever | Easy | Medium | Hard | Expert | Extreme |
|---|---|---|---|---|---|
| Single-cell cages (givens) | Several (freely used) | Few | ~0–1 | 0 | 0 |
| Max cage size | small (2–3) | 3–4 | 4–5 | 5–6 | 6–8 |
| Max combinations per cage (`maxCombos`) | very low (favor unique-combo) | low | moderate | high | very high |
| Highest required technique | singles, easy combos, 1-cell 45 | pairs/triples, pointing, box-line, cross-cage combo elimination | 2+ cell innies/outies, cage splitting, hard combos, X-Wing/Y-Wing/Swordfish | X-Cycles, XY-Chains, 3D Medusa, Jellyfish, APE | grouped/finned fish, AIC, ALS, Death Blossom, forcing nets |
| Multi-box (dog-leg) cages | few | some | many | many | many |
| Opportunity density | high (many parallel) | medium | low | bottlenecked | severely bottlenecked |

The single-cage counts in row 1 are marked as convention/direction, not published constants. The technique rows are directly grounded in the SudokuWiki grade groupings.

### Why combination count is the master ambiguity knob

A cage is only informative to the extent it restricts candidates. A cage whose combination set size equals its cell count (a "unique-combination" or "magic" cage) is maximally informative and is what makes Easy puzzles tractable. As `maxCombos` rises, cages become ambiguous and can only be resolved by combining them with row/column/box constraints, innies/outies, and chains — exactly the higher-tier techniques. This is why `maxCombos` is the parameter KSudoku uses to separate grades, and why SudokuWiki splits "easy" from "hard" Killer combinations at opposite ends of its strategy order.

## Recommendations

1. **Adopt the two-factor scoring model (do this first).** Grade by (weighted sum of every technique instance used) × (opportunity-density factor), following Stuart — not by the single hardest technique. Instrument your solver to log, per solve, the count of each technique fired and the number of independent solving opportunities per round. Assign each technique a weight in roughly the SudokuWiki order (singles lowest; chains/fish/ALS highest).
2. **Set band cutoffs by highest *required* technique, then refine by score.** Use the SudokuWiki grade groups as your technique ceiling per band (Easy ≤ step 8; Hard ≤ ~23; Expert ≤ ~29; Extreme uses 30+). Then split within-ceiling puzzles by total weighted score to separate, e.g., an easy Hard from a brutal Hard.
3. **Expose the four cage levers and tune them per band:** `maxSingles` (down as difficulty rises), `maxSize` (up), `maxValue` (up), `maxCombos` (up). Start Easy with `maxCombos` near 1–2 (force near-unique cages, allow several singles) and Extreme with high `maxCombos` and zero singles.
4. **Reject undesirable grids** the way Stuart does: too many 2-cell cages, too many singles for high grades, dog-leg cages that could repeat a digit, and any puzzle that is trivial except for one hard bottleneck.
5. **Read the exact KSudoku constants directly** from `mathdokugenerator.cpp`/`cagegenerator.cpp` in the KDE repo (or a Debian source mirror) before hard-coding numbers — the values are difficulty-dependent but were not retrievable here.
6. **Benchmarks that should change your bands:** if human solve-time distributions per band overlap heavily (Stuart calibrated against 2,000–3,000 daily submissions), your cutoffs are wrong — widen the score gaps. If a band's puzzles are consistently solved without their nominal ceiling technique, lower the ceiling. For Killer, target the empty-grid start for Hard+ (no single-cell givens).

## Caveats

- **Single-cage counts per tier are convention, not documented fact.** No authoritative public source gives exact per-band single-cell-cage counts; treat any specific numbers as heuristics to calibrate, not standards.
- **Exact KSudoku numeric parameters were not retrieved.** The parameter *names and difficulty-dependence* are confirmed from KSudoku's header files and Stuart's paper; the *integer values per difficulty* must be read from the implementation source.
- **No universal difficulty standard exists.** As the CSP literature notes, the same puzzle may be "Intermediate" on an enthusiast site and "Hard" in a newspaper. Named bands (Easy/Medium/Hard/Expert/Extreme) are not standardized across publishers; Stuart's own bands are Kids/Gentle/Moderate/Tough/Diabolical/Extreme, and Krazydad's are Intermediate/Challenging/Tough/Super-Tough/Insane.
- **Human vs. machine difficulty diverge.** Pattern-matching and lucky guessing can shortcut logical difficulty, and graders can miss "backdoor" trivializations, so empirical solve-time calibration is advisable alongside technique scoring.
- Some sourcing (technique-to-grade groupings) reflects one authoritative implementation (SudokuWiki); other publishers weight and order techniques differently.
