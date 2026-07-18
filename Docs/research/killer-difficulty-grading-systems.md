# Building a Killer Sudoku Difficulty Grading & Generation System: Concrete Sources for the Remaining Open Questions

## TL;DR

- **The most actionable per-technique weight tables come from two named sources: Andrew Stuart's own published solve-log point values (X-Wing = 25 pts/instance, Y-Wing = 25, Aligned Pair Exclusion = 50, Hidden Unique Rectangle = 35, Intersection Removal = 5, in his 587.2→379.0 worked example) and the community-standard Sudoku Explainer (SE) 1.0–11.9 rating ladder.** Use SE as your defensible weight backbone and Stuart's model as your architecture for combining technique scores with an opportunity/round-density multiplier.
- **For a generator that actually tunes difficulty, the proven production pattern is "generate-and-grade with technique-gated acceptance": generate a candidate, run a human-style logical solver, and accept/reject based on the hardest technique required and the summed score.** HoDoKu implements this exactly (configurable per-technique scores + level thresholds + "create until it contains technique X"), and Krazydad, dailykillersudoku.com, and Stuart all use over-production-and-filter. Expect to over-produce heavily: Stuart reports ~1 in 5,000 random puzzles is "unsolvable" (extreme) and that he must vastly over-produce to hit high grades.
- **"Necessity testing" (verifying a technique is *required*, not merely *usable*) is the documented weak point.** The rigorous method is to disable technique X in the solver and confirm the puzzle becomes unsolvable by the remaining techniques; the cheaper community proxy is Stuart's "Magic Cells" / backdoor metric. Empirical calibration against human solve times is best done with Stuart's daily-competition data (2,000–3,000 solvers/day) or an ELO/Glicko-2 puzzle-vs-player rating like chess.com and Lichess use.

## Key Findings

### 1. Andrew Stuart's actual scoring values are published — but they are per-solve-log, not a headline weight table

Stuart's paper *Sudoku Creation and Grading* (Feb 2007, updated Jan 2012 and 2023) contains a full worked solve log for a Diabolical puzzle. Critically, the current PDF's numbers differ slightly from the older version the requester referenced: the current paper's example scores **587.2 raw → 379.0 final** (the older cached copy shows a 595/646 variant). The final-score formula shown is:

> **Final Score: 587.2 × (646.0 / 1000.0) = 379.0**

This reveals the architecture: a **raw technique-points sum (587.2)** multiplied by an **opportunity/round-density factor (646.0/1000.0 = 0.646)**. The density factor rewards puzzles with fewer simultaneous solving opportunities (more "bottlenecks" = harder), computed from the "game round" data where each solved cell is tagged with a round number and the average solving rate (2.524 cells per round in this example).

The per-technique points from Stuart's own solve log (two columns: candidate-removal points and cell-solve points) include concrete values:

| Technique | Instances | Points (candidates) | Points (solved) |
|---|---|---|---|
| Human Strategy (eyeballing) | 126 | 12.6 | 45.0 |
| Naked Singles | 266 | 26.6 | 2.0 |
| Hidden Singles | 8 | 16.0 | 10.0 |
| Naked Pairs | 1 | 2.0 | 0.0 |
| Hidden Pairs | 2 | 4.0 | 0.0 |
| Intersection Removal | 7 | 35.0 | 0.0 |
| X-Wing | 7 | 175.0 | 0.0 |
| Y-Wings | 3 | 75.0 | 25.0 |
| X-Cycle | 24 | 24.0 | 0.0 |
| Hidden Unique Rectangles | 1 | 35.0 | 0.0 |
| Aligned Pair Exclusion | 2 | 100.0 | 0.0 |

From these ratios the **per-instance base weights** can be reverse-engineered: X-Wing ≈ 25 points per instance (175.0/7), Intersection Removal = 5 (35.0/7), Y-Wing ≈ 25 (75.0/3), Aligned Pair Exclusion = 50 (100.0/2), Hidden Unique Rectangle = 35, Hidden Pair = 2, Naked Pair = 2, Hidden Single = 2 (candidate col, 16.0/8). Naked Singles score 0.1 per instance on the candidate side (26.6/266). The "Human Strategy" (eyeballing) line is scored at 0.1 per candidate-removal and yields a large cell-solve contribution.

**Grade boundaries:** Stuart does *not* publish numeric score thresholds for his six grades (Kids, Gentle, Moderate, Tough, Diabolical, Extreme). Instead he divides the accumulated score-spectrum into six bands ("sextiles") over a large batch (tens of thousands of puzzles), and applies **qualitative gates on top**:

- **Kids:** solvable by eyeballing only, no note-taking, high "opportunity" density.
- **Gentle:** solvable by "slice and dice" (single position in a row/column/box) only.
- **Moderate:** may require Naked/Hidden Pairs and Triples.
- **Tough/Diabolical/Extreme:** progressively more sophisticated strategies.
- **Rejection rule:** a puzzle that is trivial throughout except for one hard bottleneck is discarded, even if its raw score is high ("it would not be a satisfying puzzle").

So the honest answer to the requester's grade-boundary question is: **Stuart's thresholds are relative sextile cuts on a per-batch score distribution plus technique-presence gates, not fixed published numbers.**

### 2. Sudoku Explainer (SE) is the community's defensible per-technique weight table

The fullest documented SE table is on the SukakuExplainer GitHub wiki (v1.17.8), reproduced widely. Core values (the "ER" explainer rating, on a 1.0–11.9+ scale):

| Rating | Technique |
|---|---|
| 1.0 | Last value in block/row/column (full house) |
| 1.2 | Hidden Single in block |
| 1.5 | Hidden Single in row/column |
| 1.7 | Direct Pointing |
| 1.9 | Direct Claiming |
| 2.0 | Direct Hidden Pair |
| 2.3 | Naked Single |
| 2.5 | Direct Hidden Triplet |
| 2.6 | Pointing |
| 2.8 | Claiming |
| 3.0 / 3.2 / 3.4 | Naked Pair / X-Wing / Hidden Pair |
| 3.6 / 3.8 / 4.0 | Naked Triplet / Swordfish / Hidden Triplet |
| 4.0–4.3 | Skyscraper, 2-String Kite, Turbot Crane |
| 4.2 / 4.4 | XY-Wing / XYZ-Wing |
| 4.5–5.3 | Unique rectangles and loops |
| 5.0 / 5.2 / 5.4 | Naked Quad / Jellyfish / Hidden Quad |
| 5.6–6.0 | Bivalue Universal Graves |
| 6.2 | Aligned Pair Exclusion |
| 6.5–7.0 | X-cycles / Y-cycles |
| 7.0–8.0 | Bidirectional cycles, forcing chains (common 7.1–7.3) |
| 7.6–8.1 | Nishio |
| 8.2–8.7 | Cell/Region Forcing Chains |
| 8.8–9.6 | Dynamic Forcing Chains |
| 9.9–11.0+ | Dynamic Forcing Chains (nested) |

The critical difference from Stuart: **SE rates a puzzle by the single hardest technique required (the max), not by a sum.** SE also exposes three sub-ratings — ER (explainer/hardest-step), EP (pearl), and ED (diamond) — but only ER is widely used. A common SE generator banding (from an SE FAQ) is: Easy 1.0–1.2, Medium 1.5, Hard 1.7–2.5, Fiendish 2.6–6.0, Diabolical 6.2+.

### 3. HoDoKu is open-source and implements a fully configurable sum-of-scores system — the best code-level reference for a tunable grader

HoDoKu (by the late Bernhard Hobiger) rates a puzzle as the **sum of per-step scores**, and separately assigns each puzzle a **level** (Easy/Medium/Hard/Unfair/Extreme) equal to the greater of (a) the hardest single step's level and (b) the level implied by the total score. Confirmed default per-technique scores are sparse in public docs: **Skyscraper = 130, X-Wing = 140, Swordfish = 150 points.** Level bands (approximate shipped defaults): Medium puzzles "normally score between 600 and 1200"; Hard max ≈ 1600; Unfair max ≈ 1800; Extreme = infinity. The full default integer table lives in the source (`SolutionType.java` / `Options.java` in the PseudoFish/Hodoku fork, or `1to9only/HoDoKu` mirroring hobiwan's 2.2.0, or the SourceForge SVN trunk) and was not extractable in this research pass — a follow-up should read those files directly or decompile Hodoku.jar.

HoDoKu's most valuable feature for a generator builder is its **technique-gated generation**: its manual documents how to create a puzzle guaranteed to contain a specific technique, either via Learning/Practising mode (the created puzzle "will contain at least one instance of the specified technique") or by the batch command `/s /sc` (search for steps) and `/s /sl` (search for a difficulty level). It also documents a clever score-manipulation trick: reassign a target technique (e.g. AIC) to level "Medium" with an artificially huge score (5000) and set level maxima so that the *only* way a puzzle can reach that score band while staying "Medium" is by actually containing that technique.

The community consensus (enjoysudoku forum) is that **HoDoKu's rating is order-dependent and non-canonical** ("worth 0" for absolute comparison, because reordering techniques changes scores dramatically), while **SE is the accepted standard**. Practical takeaway: use HoDoKu's *architecture* (configurable scores + level gates + generate-until-technique-present) but calibrate weights against SE.

### 4. Killer-specific technique scoring: Stuart's Killer solver has the strategy ordering but no published numbers

Stuart's paper explicitly addresses Killer generation and grading. His method:

- Create a filled board, overlay random cage grids (never repeating a cage pattern), and **discard cage grids with too many 2-cages (pairs) or too many single-cell cages** ("useful for gentle and moderate Killers but not suitable for higher grades") — this is a concrete difficulty lever the requester can copy.
- Enforce the no-duplicate-in-cage convention (including dog-legged cages), discarding violating cages.
- Score from all standard Sudoku strategies **plus Killer-specific opportunities**: cage combinations (distinguishing single-combination cages like a 4-cage summing to 10 = {1,2,3,4} from multi-combination cages), Innies/Outies, and Cage Splitting — "these have been weighted and factored into the grading process" (but the weights are not published).

The SudokuWiki Killer solver's strategy list gives the **implicit difficulty ordering** (the requester's technique tiers):

- **Basic:** Killer Combinations, KenKen Combinations, Intersection Removal.
- **Tough:** X-Wing, Chute Remote Pairs, Simple Colouring, Y-Wing, **Rule of Parity, Cage Splitting, Innies/Outies, Cage/Unit Overlap, Cage Comparison**, Swordfish, XYZ-Wing, Rectangle Elimination.
- **Diabolical/Extreme:** X-Cycles, 3D Medusa, Jellyfish, WXYZ-Wing, XY-Chains, Aligned Pair Exclusion, Grouped X-Cycles, Finned fish, Inference Chains.

Notably, Stuart himself splits **single-cell Innies/Outies (easier) from multi-cell ones (harder, placed lower in the solver order)**, and a reader/Stuart exchange notes that **"Cage Comparison" is essentially the same as "Killer Combinations (hard)"** — useful for collapsing redundant technique tiers. dailykillersudoku.com uses a 1–10 difficulty scale (rating 10 = "monster"); its help page states difficulty "is estimated when it's generated" by a "difficulty calculator" and is a solver-based estimate, but the algorithm is not published. Krazydad (Jim Bumgardner) uses named tiers (Intermediate, Tough, Insane, plus "Psycho Killer") ordered by ascending difficulty across booklets, but has not published his grading algorithm or parameters.

### 5. Generators that actually parameterize difficulty

Concrete open-source and documented systems beyond KSudoku:

- **HoDoKu** (above) — the strongest reference: configurable scores, level thresholds, and generate-until-technique-present.
- **Kevin Hooke's grader/generator** (kevinhooke.com, GitHub `kevinhooke/sudoku-human-grader`): a human-style grader that classifies by the *set of techniques required* — Easy = naked/hidden singles only; Medium = requires pairs; Hard = requires triples; Very Hard/Expert = X-Wing/Swordfish. His generator runs on top of an Algorithm X (Dancing Links) solver and generates a couple of puzzles a day. He confirms the key insight: the grader (the human-technique-emulating solver) took him ~a year of part-time work while the Algorithm X solver took ~2 weeks — **the grader is the hard part, not the solver.**
- **Daniel Beer's method** (dlbeer.co.nz): a branch-difficulty score summing (Bᵢ − 1)² over search-tree branch factors (a solution requiring no backtracking scores 0), with concrete bands stated verbatim: "Scores of less than 100 indicate easy puzzles with no backtracking required. Scores in the 300+ range are usually fairly challenging and require at least the elimination of hidden/naked tuples, and sometimes more advanced techniques such as forcing chains." Efficient for generation but only loosely correlates with human difficulty.
- **KSudoku's own cage generator header** confirms the requester's finding — `maxSize` (max cells per cage) and `maxValue` (max cage total) are the only difficulty knobs exposed, and maxValue is unused.
- **The over-produce-and-filter pattern** is universal: Stuart notes that to produce 100 puzzles of all grades he must "over produce many puzzles since the incidence of higher grade puzzles is low," that ~1 in 5,000 random puzzles is logically unsolvable (his weekly "unsolvable"/extreme), and that in one run of 141,672 solvable puzzles only 4 could not be solved by his strategy list. Denis Berthier's CSP-Rules is cited on the enjoysudoku forum as a rigorous (if slow) filter used to *validate* puzzles from a fast generator rather than generate them.

### 6. Empirical solve-time calibration

- **Stuart's daily-competition data is the best-documented human calibration set for Sudoku:** 2,000–3,000 correct submissions per day, each with a self-reported solve-time band (≤5, ≤10, ≤15, ≤20, ≤30, ≤40, ≤50, ≤60, ≤120, >120 minutes) plus a "Don't know" option. He plotted average solve time per puzzle across 330 puzzles by grade, finding Gentles cluster at short times, Diabolicals spread over longer times, Toughs have the widest spread, and ~10% of solvers struggle with Gentles while ~10% find some Diabolicals easy. This is the calibration loop the requester should emulate: publish, collect timing distributions, and adjust score→grade cuts to match.
- **Publisher solve-time statements for Killer specifically** are informal: the general community figure is that easy Killers can be faster than classic Sudoku while the hardest "can take hours to solve" (Wikipedia); sudoku-royale-style guides quote 25–60 min for hard classic and 30–60+ for evil/expert.
- **ELO/Glicko puzzle rating is the state-of-the-art human calibration method** and directly transferable. **Lichess** rates every puzzle with **Glicko-2**; per its database documentation, "To determine the rating, each attempt to solve is considered as a Glicko-2 rated game between the player and the puzzle," and its blog frames it as "Every puzzle attempt is a 'game' between you and the puzzle. If you get it right you win, and take your ratings points as the prize. If you get it wrong, the puzzle walks away victorious." Each Lichess puzzle carries schema fields Rating, RatingDeviation, Popularity (100 to −100), and NbPlays (alongside PuzzleId, GameId, FEN, Moves, Themes, OpeningTags). **Chess.com** re-rated every puzzle and player with Glicko-style logic by "replaying our full history of puzzle attempts (about 17 billion!)," explicitly so that "two players rated 1200 in Puzzles are about equally skilled at tactics, and that two 1200-rated puzzles are equally difficult" (a mate-in-one once rated 1800 "now has a more accurate 963 rating"). This is the cleanest way to make machine scores track human difficulty: seed puzzles with a machine-estimated rating, then let live solve/fail data move both puzzle and player ratings until they converge.

### 7. Technique-gated generation: how real systems verify a technique is REQUIRED

- **The rigorous "necessity test":** disable technique X in the logical solver and confirm the puzzle can no longer be solved by the remaining (lower) techniques. HoDoKu's whole configurable-solver design supports this — it solves by trying techniques in a fixed order and never uses a harder step when an easier one exists, so if you remove X from the enabled set and the solve stalls, X was necessary. The computational cost is one full logical-solve per candidate per technique-toggle; this is why the grader dominates generation cost.
- **Stuart's cheaper proxy — "Magic Cells" / backdoors:** Fariande's idea, adopted by Stuart, defines a puzzle as "trivial" if solvable by Singles/Pairs/Triples/Quads/Intersection Removal alone, then asks: *are there cells whose solution, if known, would render the rest trivial?* A puzzle with many such "Magic Cells" (backdoors) is easier because guessing shortcuts the bottleneck; a puzzle with zero is genuinely hard. He gives concrete examples: an Extreme scoring 1369 with 38 Magic Cells vs. one scoring 1347 with zero single-cell Magic Cells (only ~10% of cell-pairs trivialise it). On a 7,494-puzzle subset of the 46,000 17-clue collection, only 16 were "zero" puzzles. HoDoKu computes the same concept (backdoors: single cells, pairs, or — for Easter Monster — triples that reduce the puzzle to singles).
- **The caveat every system hits (HoDoKu's order-dependence):** because a fixed-order solver applies whatever technique it finds first, a puzzle may be *rated* as "requiring" three W-Wings before an XY-Wing that was available all along — inflating both the score and the apparent hardest technique. Necessity testing must therefore be done by capability toggling (disable X, re-solve), not by reading off a single solver trace.

## Details

**On combining the two scoring philosophies.** The requester should treat SE (max-technique) and Stuart/HoDoKu (sum-of-techniques) as complementary, not competing. SE answers "what is the single hardest thing you must know?"; the sum answers "how much total work is it?" The enjoysudoku forum explicitly notes both failure modes: SE can under-rate a puzzle that needs many hard-ish steps, while a pure sum can over-rate a puzzle that is long but easy. Stuart's density multiplier (× round-factor) is a principled fix — it down-weights puzzles with many parallel opportunities and up-weights bottlenecked ones. A robust Killer grader would compute: (max required technique tier) as a primary band, then (Σ weighted technique instances × opportunity-density factor) as the intra-band score, then apply presence/absence gates (e.g., reject if a hard technique appears only once as an isolated bottleneck; reject cage grids with too many singles/pairs for high tiers).

**On Killer cage-structure difficulty levers (concrete, code-ready).** From Stuart plus the SudokuWiki Killer docs, the tunable cage parameters that actually move difficulty are: (a) **number of single-cell cages** (givens-equivalents; many = easy, zero = hard); (b) **number of 2-cell cages** (too many = too constrained/easy); (c) **average cage size** (KSudoku's maxCageSize lever is directionally right — bigger cages = fewer combination constraints = harder — but is only one of several levers); (d) **prevalence of single-combination cages** (a 3-in-2 = {1,2}, or a 10-in-4 = {1,2,3,4} — these are strong footholds; fewer = harder); (e) **cage/unit alignment** (cages that line up with rows/columns/boxes create easy Innies/Outies; deliberately misaligned cages force multi-cell Innies/Outies and Cage Splitting). These map cleanly onto per-tier acceptance gates.

**On acceptance/throughput numbers.** Hard data is thin but directional: Stuart's ~1-in-5,000 for logically-unsolvable extremes, and 4-in-141,672 for strategy-list failures, bound the rarest tiers. His pie-chart of grade distribution shows most random puzzles are easy with a "long tail" of hard ones (for 6×6 puzzles, 69% are trivial). For a production Killer pipeline the practical implication is that Expert/Insane tiers require generating and discarding on the order of thousands of candidates per accepted puzzle, dominated by grader cost — hence the value of a fast pre-filter (branch-difficulty or backdoor count) before the expensive full human-technique grade.

## Recommendations

**Stage 1 — Adopt SE as your weight backbone and build a human-style Killer solver.** Implement the SE 1.0–11.9 ladder for the standard-Sudoku techniques (table above), and extend it with Killer-specific tiers using SudokuWiki's ordering: Killer Combinations (easy) ≈ 2.5–3.0; Innies/Outies single-cell ≈ 3.5, multi-cell ≈ 4.5; Cage Splitting ≈ 4.5; Rule of Parity / Cage Comparison ≈ Killer-Combinations-hard ≈ 5.0. Rate each puzzle by BOTH the max-technique (primary band) and a Stuart-style weighted sum × opportunity-density multiplier (intra-band ordering). **Benchmark that changes this: if your grades disagree with SE on shared standard-Sudoku puzzles by more than one band, re-tune weights before proceeding.**

**Stage 2 — Build generate-and-grade with technique-gated acceptance, copying HoDoKu's architecture.** For each target tier, define (a) a required-technique gate, (b) a score range, and (c) cage-structure gates (max single-cell cages, max 2-cell cages, min misaligned cages). Generate candidate cage grids, grade, accept only if all gates pass. Verify necessity by capability-toggling (disable the target technique; require the solve to stall). **Threshold that changes staging: if acceptance rate for your top tier falls below ~1 in several thousand, add a cheap pre-filter (backdoor count or branch-difficulty score) to reject obviously-easy candidates before the expensive full grade.**

**Stage 3 — Calibrate against humans.** Ship puzzles with a machine-estimated rating, then run a Glicko-2 puzzle-vs-player loop (Lichess/chess.com model) so live solve/fail data converges puzzle ratings to true difficulty. If you lack a live audience, replicate Stuart's timing-band survey (collect self-reported solve-time buckets from a few hundred solves per puzzle) and fit your score→grade cuts to the observed median solve times. **Benchmark: your grade bands are calibrated when median human solve time increases monotonically across tiers and each tier's distribution overlaps its neighbours by no more than ~10% (Stuart's observed spread).**

**Stage 4 — Reject on quality, not just score.** Implement Stuart's bottleneck-rejection rule (discard puzzles that are trivial except one hard step) and the Magic-Cells/backdoor metric to distinguish genuinely-hard puzzles (few/zero backdoors) from puzzles that merely look hard.

## Caveats

- **Stuart publishes his architecture and one worked solve-log, but not his master weight table or numeric grade thresholds.** The per-instance weights above are reverse-engineered from his example's ratios and should be treated as indicative, not authoritative. His grades are relative sextile cuts on a per-batch distribution plus qualitative gates.
- **The full HoDoKu default per-technique integer table was not extractable in this research** (GitHub blob pages render via JavaScript; raw files were not fetchable). Confirmed defaults are only Skyscraper 130, X-Wing 140, Swordfish 150, and the approximate level maxima (Medium ~1000/600–1200, Hard ~1600, Unfair ~1800, Extreme ∞). Read `SolutionType.java` / `Options.java` in the PseudoFish/Hodoku fork (or the 1to9only mirror / SourceForge SVN trunk), or decompile Hodoku.jar, to obtain the complete integers.
- **HoDoKu's sum-based rating is order-dependent and not a canonical difficulty measure** — the community treats SE as the standard. Use HoDoKu for its configurable generate-and-filter machinery, not as your ground-truth grader.
- **SE and HoDoKu predate several modern techniques** (Junior Exocet, MSLS, etc.) and neither includes ALS as a first-class technique in older versions; extremely hard puzzles may be mis-rated at the top of the scale.
- **Killer-specific weights are essentially unpublished.** No source found gives numeric scores for Innies/Outies, Cage Splitting, Rule of Parity, or Cage Comparison; the tier *ordering* is documented (SudokuWiki) but you will have to calibrate the numbers yourself against solve-time or ELO data.
- **dailykillersudoku.com and Krazydad do not publish their algorithms or parameters** beyond tier names and a note that difficulty is a solver-generated estimate; treat their scales as folklore-grade references.
- **Solve-time figures for Killer are informal publisher/blog claims,** not rigorously measured, except for Stuart's classic-Sudoku daily-competition dataset (which he did not break out for Kids or Extreme grades, or publish raw).
