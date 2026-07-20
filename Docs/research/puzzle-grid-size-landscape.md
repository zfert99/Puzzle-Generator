# Grid-Size Landscape for Sudoku-Family and KenKen-Family Puzzles: A Build Guide

## TL;DR

- **For Killer Sudoku, stick to composite sizes and keep the ladder short: 4×4, 6×6, 9×9 is the proven sweet spot, with 12×12 (3×4 boxes) as an optional "giant" tier; 16×16 and 25×25 are real but niche novelty formats that mostly reward endurance, not skill, and carry the worst generation-cost and mobile-UI penalties.** Box-Sudoku only exists at composite sizes (it needs a rows×cols box tiling), so 5×5, 7×7, 11×11, etc. are impossible.
- **For KenKen/Calcudoku, the constraint model is Latin-square-only (no boxes), so ANY N≥3 works — this is the single most important structural difference, and it unlocks 5×5 and 7×7, which box-Sudoku cannot support. The canonical published range is 3×3–9×9 (NYT does 4×4/6×6 daily; kenkenpuzzle.com does 3×3–9×9), with calcudoku.org extending to a regular 12×12 and one-off grids to 15×15/17×17.**
- **A shared cage engine across Killer Sudoku and KenKen is a proven pattern (KDE's KSudoku uses one `MathdokuGenerator`/`CageGenerator` for both). Recommended ladder: Killer at 4/6/9 (+optional 12), KenKen at 4/5/6/7 (+optional 9). Avoid 16×16+ for either unless you specifically want a "marathon" badge feature — the audience ROI is low and the pitfalls (pencil-mark explosion, mobile rendering, "long but shallow" difficulty) are high.**

## Key Findings

1. **Box-Sudoku is size-constrained; KenKen is not.** A classic/Killer Sudoku needs its N×N grid to tile into rectangular boxes, so N must be composite: 4 (2×2), 6 (2×3), 8 (2×4), 9 (3×3), 10 (2×5), 12 (3×4 or 4×3), 15 (3×5), 16 (4×4), 25 (5×5). KenKen/Mathdoku/Calcudoku imposes only the Latin-square rule (each of 1..N once per row and column) — no box — so it works at *any* N≥3, including primes like 5, 7, 11. This is confirmed directly in KDE KSudoku's own source: "a Mathdoku puzzle can have any size from 3x3 up to 9x9 … [because] Sudoku rules apply only to rows and columns." Wikipedia likewise states KenKen "grids range in size from 3×3 to 9×9," filled 1..N as "a Latin square."

2. **The KenKen duplicate-in-cage rule is real and combinatorially important.** Unlike Killer Sudoku (no digit repeats within a cage), KenKen explicitly permits a digit to repeat within a cage *as long as it is not in the same row or column*. The wording appears verbatim in the MAA/SIGMAA "Advanced KenKen Strategies" handout: "A number can be repeated within a cage as long as it is not in the same row or column." The official KenKen rules (kenkenpuzzle.com) and Wikipedia state it identically: "Digits may be repeated within a cage, as long as they are not in the same row or column. (Unlike Killer Sudoku, digits may repeat within a cage.)" The practical impact: cage-combination enumeration must allow repeats (multisets), which enlarges the candidate table for a cage — especially for L-shaped/blocky cages that span more than one row and column.

3. **Generation cost scales super-linearly and blows up between 16×16 and 25×25.** The uniqueness check (re-solving after each clue removal) is the bottleneck. Empirical reports: a naive backtracking solver takes **10+ minutes on a 16×16** and is effectively hopeless on 25×25, whereas a Dancing Links (DLX/Algorithm X) exact-cover solver does 16×16 in ~115 ms and 25×25 in ~460 ms (AditiR-42 benchmark). A generalized generator benchmark (enjoysudoku.com) shows box-size 3 (9×9) at ~28 µs/grid, box-size 5 (25×25) at ~6.3 ms, box-size 6 (36×36) at ~2 s, box-size 7 (49×49) at ~4 s, and box-size 8 (64×64) "stalls." One generator page warns outright: "It takes about a second to generate a 25×25 puzzle, and exponentially longer for even bigger puzzles."

4. **Large grids are "long but shallow."** Multiple publishers and solvers describe 16×16/25×25 as demanding *endurance* rather than new technique. Puzzle-magazine.com explicitly says its 25×25 puzzles only need two basic rules ("we could have required you to use other rules too … but on puzzles this large that would have just been downright mean"). Solve-time estimates: 12×12 ~20–45 min, 16×16 ~30–90+ min, 25×25 "2 to 3 hours" for an easy grid up to "several days" for a hard one.

5. **A shared Killer/KenKen engine is a documented, proven pattern.** KDE's open-source KSudoku generates both Killer Sudoku and Mathdoku (KenKen) from a single `MathdokuGenerator` that "generates a Killer Sudoku or Mathdoku puzzle from a Latin Square," backed by one DLX solver that "can handle … Killer Sudoku and MathDoku." The open-source Android app Mathdoku (net.cactii.mathdoku) is another shared-lineage example.

## Details

### PART A — Sudoku (classic and Killer) at larger sizes

**12×12 ("Sudozen," "Super Sudoku"):** The most viable step beyond 9×9. Boxes are 3×4 (or 4×3) rectangles; symbol set is 1–9 plus A, B, C (or 1–12). Widely published: PuzzleMadness runs a *daily* 12×12 "Giant Sudoku"; SudokuPro, Sudoku Royal, dCode, and Clarity Media all support it; Clarity Media sells printed 12×12 Killer Sudoku ("Place each number from 1–12 … in each row, column and 3×4 bold-lined box"). Because boxes are asymmetric (4-wide vs 3-tall), box-line interactions differ by direction — a genuinely interesting structural wrinkle, not just "more of the same." Solve time ~20–45 min. This is the recommended "giant" tier if you want one.

**16×16 ("Hexadoku," "Super Sudoku," "Mega Sudoku"):** Very common as a novelty. 4×4 boxes, 256 cells. Symbol sets vary: 1–9+A–G, hexadecimal 0–F, or A–P. Publishers: Krazydad (hundreds of free booklets, both 0-F and 1-16 notations), many Amazon print books, apps on Google Play, and sites like 1sudoku.com and sudoku-royal.com. Pencil-mark load is 16 candidates/cell — the central UX problem. Multiple sites recommend tablet/desktop over phone. Clue counts typically 40–50+ needed for uniqueness (vs the proven **17-clue minimum for 9×9**, established by Gary McGuire, Bastian Tugemann & Gilles Civario, "There is no 16-Clue Sudoku," arXiv:1201.0749, Jan 2012, University College Dublin: "we … did not find any, thus proving that the answer is indeed 17").

**25×25 ("Alphadoku," "Pentadoku," "Titan," "Giant"):** A real but hardcore-enthusiast format. 5×5 boxes, 625 cells; letters A–Y or numbers 1–25, or mixed A–P + 1–9. Publishers: sudoku-puzzles-online.com (Alphadoku, beginner/confirmed/expert), wordfit.com daily "Pentadoku," puzzle-magazine.com (25×25 magazine), MaaTec, sudoku4me. Solve times run hours to days. Entered mainstream puzzle publishing in the late 2000s after 9×9 saturated newspapers.

**Larger than 25×25 (36×36, 49×49, 100×100, 144×144):** These exist essentially only as programmer/enthusiast curiosities on the enjoysudoku.com forum and a handful of generator sites (sudokugeant.cabanova.fr offers 16×16 to 100×100; a mocha2007 generator offers up to 100×100). One forum member generated 1,000 100×100 *filled* grids in ~45 s (three threads); making a hard, minimal, unique *puzzle* at that scale is far harder, and human-technique difficulty raters ("Sudoku Explainer" ports) rate these giant grids as trivially easy (e.g., "ED=3.6/1.2/1.2") because they're shallow. Clarity Media will commercially supply up to 36×36. There is no meaningful consumer audience above 25×25.

**Intermediate sizes:**

- **8×8 (2×4 boxes, digits 1–8):** Published (David Smith's books; sudoku-download.net's "Brickwall/Ladder/Cross" patterns; sudoku-royal.com; playminisudoku.com's 8×8). Positioned as a "different, not harder" stepping stone. Legitimate but minor.
- **10×10 (2×5 boxes, digits 1–10):** Published (sudoku4me, Sudoku Dragon, playminisudoku.com 10×10, LinkedIn-style mini-sudoku sites). Niche.
- **12×12:** the strongest intermediate/large option (see above).
- **15×15 (3×5 boxes):** Published as magazines (puzzle-magazine.com 15×15) but uncommon; awkward symbol range.
- **Composite vs valid:** All composite sizes are theoretically valid; in practice 4, 6, 9 dominate, 12 and 16 are the common "large" choices, and 8/10/15/25 are minor/novelty. **Killer Sudoku** specifically is published at 12×12 (Clarity Media, John Collins, Mindful Puzzle Books) and 16×16 ("Monster Killer Sudoku," "Killer Level Mega Sudoku 16×16"), confirming that the cage mechanic scales to giant sizes commercially — but again as a specialty print product, not a mainstream digital format.

**Generation pitfalls by size (Sudoku):**

- 9×9: trivial — millions of unique puzzles per minute are possible; naive backtracking ~20–31 ms.
- 12×12: still fast with a good solver; the giant that stays practical.
- 16×16: the inflection point. Naive backtracking generation "prevents … a solution in any reasonable time-frame"; you *must* use DLX/constraint propagation. With DLX, ~115 ms solve; generation (many uniqueness checks) is seconds-plus.
- 25×25: DLX solve ~460 ms; full generation with uniqueness verification takes seconds to minutes; naive approaches are hopeless.
- Uniqueness verification is the dominant cost at every large size because it re-runs the solver after each candidate clue removal.

**Difficulty grading at scale:** Human-technique graders (naked/hidden singles, X-Wing, etc.) do port to larger grids, but the KDE devs note "nobody seems to have a good algorithm for predicting the difficulty of a generated Mathdoku or Killer Sudoku puzzle." At 16×16+ grids tend to become "long but shallow" — high time cost, modest technique depth — which undermines meaningful difficulty tiers.

**UI/UX pitfalls (large Sudoku):**

- Pencil marks: 16 candidates/cell (16×16) or 25 (25×25) overwhelm a cell on a phone. Sites explicitly recommend tablet/desktop.
- Input beyond 9: needs a letter keypad or two-key entry. calcudoku.org's convention (press "1" then "0" for 10, or use a/b/c keys) is a good model; 16×16 apps use A–G/A–P.
- Rendering: 625-cell grids need zoom/pan or a very large screen; box borders and given/entered color coding become critical for legibility.

### PART B — KenKen / Mathdoku / Calcudoku sizes

**Canonical range:** 3×3 through 9×9. KenKen was invented in 2004 by Tetsuya Miyamoto. Per Wikipedia, it "made its debut in The Times (London) in March 2008, and the New York Times in February 2009" — i.e., the London Times debut was 2008 and the NYT daily debut was February 2009 (it became the first daily feature added since the crossword). NYT/Boston Globe publish **4×4 and 6×6 daily** (increasing difficulty through the week). kenkenpuzzle.com offers 3×3–9×9 across five difficulty levels plus No-Op ("Mystery") variants where the operator is hidden. Newdoku.com offers 3×3–9×9. Most popular/most published: **4×4 (entry) and 6×6 (standard)**; 3×3 is a children's/intro size; 9×9 with all four operators is the top of the standard range.

**Calcudoku site sizes:** calcudoku.org (Patrick Min) publishes the widest regular range. Confirmed verbatim from its main page: "In the largest puzzles (10x10 Calcudoku puzzle (every Tuesday and Friday) and 12x12 (every Sunday and Thursday)), simply press 1 then 0 … Every puzzle has a single solution." So the site's **10×10 runs every Tuesday and Friday and its 12×12 every Sunday and Thursday**, and it explicitly calls these "the largest puzzles." Sizes 15×15 and above are one-off / "Extra" / on-request rather than scheduled; Min's own book descriptions frame them as demand-driven specialty items ("many people asked for more large Calcudoku puzzles … 101 12×12 puzzles, and even one 15×15 puzzle"; another volume mentions "even one 17×17 puzzle," and notes 14×14-and-larger grids must be printed split across four pages to be usable). Puzzle Baron and Razzle Puzzles cap at 9×9; the book market (PuzzleBooks.net) mixes 7×7/8×8/9×9.

**5×5 and 7×7 confirmed:** These odd/prime sizes are standard in KenKen (ThePuzzleLabs offers 3×3–7×7; kenkenpuzzle.com's 3×3–9×9 includes 5 and 7). They are *impossible* for box-Sudoku, which is a genuine differentiator you can market.

**Difficulty scaling with size:** Difficulty rises with N but is dominated by operator choice and cage structure, not size alone. EDC/Think Math and ThePuzzleLabs describe the progression: 3×3 gentle (mostly addition, single-cell givens); 4×4 adds subtraction and real deduction; 5×5 uses all four operations; 6×6/7×7 require chaining multiple cage constraints. **Addition-only (and multiplication-only, "Inshi no heya") puzzles are generally harder to pin down** because sums have many decompositions — one solver notes a "+ only" puzzle forced "trial-and-error … to pin it down." 9×9 with all operators is considered genuinely hard by the community (dedicated "how to solve hard 9×9 KenKen" material, plus blog write-ups of "the hardest KenKen I've ever come across" even at 6×6).

**Cage arithmetic at larger N:**

- **Multiplication cages with big products become a *solving aid*, not a burden:** a large product often has a unique factorization within 1..N. Example (EDC): a product-32 L-tromino in a 4×4 has exactly one filling; 60× in a three-cell cage of a 5×5 must be {3,4,5}. This is prime-factorization-as-technique, and it's a recognized method (Melkonian, "An Integer Programming Model for the KenKen Problem," details prime-factorization handling — e.g., target 2520 = 2³·3²·5·7).
- **Combination-table growth:** because duplicates are allowed (subject to row/column), the number of valid multisets per cage grows with N and cage size. This enlarges precomputed cage tables but remains tractable at N≤9; it becomes a real memory/time consideration if you push to 12×12+.

**Generation/solving pitfalls (KenKen):**

- DLX/exact-cover and bitmask candidate approaches transfer directly: KDE uses one DLX solver for both Killer and Mathdoku. Bitmask candidate sets (one bit per digit) are standard; at N>9 you simply need a wider integer mask (still fits in a 32-bit int through N=32, 64-bit through N=64) — a minor but real code change from the "9 bits fits in an int" assumption.
- Uniqueness verification is again the cost driver; at 9×9 KenKen it's fast, and larger Calcudoku (10×10, 12×12) is where it starts to matter.
- Subtraction and division cages must be restricted to two cells (order-ambiguity: 6−(4−1)=3 but (6−4)−1=1) — this is a hard rule in KenKen and in KSudoku's generator, and it constrains cage shapes.

**Community consensus on fun/playability:** 9×9 KenKen with all operators is treated as expert-tier. 10×10–15×15 Calcudoku is explicitly a niche for enthusiasts — calcudoku.org's largest *regular* size is 12×12, larger grids are one-offs, and its author frames them as by-request specialties. The competitive/hardcore audience for very large arithmetic grids is small.

### PART C — Cross-cutting for the app builder

**Audience demand vs novelty:**

- **Real, broad demand:** 4×4, 6×6, 9×9 (both families); Killer 9×9 is a mainstream digital staple (sudoku.com runs daily Killer Easy→Expert).
- **Solid secondary demand:** 12×12 Sudoku (daily on PuzzleMadness, multiple apps); KenKen 5×5/7×7 (fills out the ladder).
- **Novelty / low ROI:** 16×16 and 25×25 Sudoku (many print SKUs and a few dedicated apps, but the audience is a small endurance-seeking segment); 10×10+ Calcudoku (enthusiast niche). 8×8/10×10/15×15 are minor.
- App-store signals show 16×16 and Calcudoku apps exist and are rated well but are clearly specialty titles, not mass-market; mainstream Sudoku apps center on 9×9 (+Killer/variants).

**Implementation implications moving from box-Sudoku to Latin-square KenKen:**

1. **Drop the box constraint** — the solver/generator loses one of its three constraint families; the exact-cover matrix drops the box-column group. This *widens* the solution space (fewer constraints), which is partly why KenKen needs the cage arithmetic to pin down a unique solution.
2. **Add cage-arithmetic constraints** with operator semantics (+, −, ×, ÷), the two-cell restriction for − and ÷, and the *duplicates-allowed-within-cage* rule (contrast Killer's no-duplicates rule). These two rules are the crux of a shared engine: your cage model needs a flag for "boxes present?" and "duplicates allowed in cage?".
3. **Bitmask width:** widen candidate masks beyond 9 bits for N>9.
4. **Shared engine is proven:** KSudoku's `MathdokuGenerator` builds both Killer and Mathdoku from a Latin square + `makeCages()`, differing only in operator set, box presence, and the duplicate rule — a clean template to copy.

**Recommended size ladder:**

- **Killer Sudoku:** 4×4, 6×6, 9×9 as the core (you already support these). Add **12×12 (3×4)** only if you want a "giant/marathon" tier — it's the last size that stays generation-friendly and has genuine daily-publisher precedent. **Skip 16×16+ Killer** unless it's a deliberate novelty SKU; pencil-mark and mobile-rendering pain is severe.
- **KenKen:** 4×4, 5×5, 6×6, 7×7 as the core (5 and 7 are your differentiators vs Killer), plus **9×9** as the "expert" cap. Offer operator subsets (addition-only "easy," all-ops "hard") and optionally No-Op ("Mystery") as a difficulty axis rather than pushing to larger grids. Consider **10×10** only as an enthusiast extra.

**Benchmarks that would change these recommendations:**

- If your generator (with DLX) produces a unique, difficulty-graded 16×16 in well under ~1 s *and* telemetry shows users finishing 12×12 giants and asking for more → add 16×16.
- If mobile analytics show a large tablet/desktop share and long average session times → large grids become more viable.
- If KenKen 9×9 completion rates are healthy and users request harder content → add 10×10 Calcudoku before adding any 16×16 Sudoku.

## Recommendations

1. **Ship the core first, both families:** Killer 4/6/9 (done) and KenKen 4/5/6/7/9. This covers essentially all mainstream and secondary demand and showcases KenKen's unique odd/prime sizes.
2. **Reuse one cage engine** modeled on KSudoku: a Latin-square filler + `makeCages()` with three switches — boxes on/off, duplicates-in-cage allowed/forbidden, operator set. Restrict − and ÷ cages to two cells.
3. **Use DLX/exact-cover (or strong constraint propagation), not naive backtracking**, so uniqueness checks stay fast; widen candidate bitmasks for any N>9.
4. **Add 12×12 as your only "giant" tier**, and only after core ships. It's the largest size that's both generation-practical and has real daily-publisher precedent. Use letter/two-key input (A/B/C or "1 then 2") and design pencil marks for a 12-candidate cell.
5. **Treat difficulty as operator/technique depth, not grid size.** For KenKen, use operator subsets and No-Op mode as difficulty axes. Don't rely on 16×16+ to create "hard" content — those grids are long, not deep.
6. **Defer 16×16 and 25×25 Sudoku** to a possible "marathon/novelty" mode gated behind telemetry. If you build them, target tablet/desktop, warn about solve times (30–90 min for 16×16, hours for 25×25), and don't promise fine-grained difficulty tiers.
7. **Avoid impossible/awkward sizes:** never offer box-Sudoku at prime/odd-only sizes (5, 7, 11) — reserve those for KenKen. Deprioritize 8×8/10×10/15×15 Sudoku — valid but low-demand.

## Caveats

- **Generation-time figures come from heterogeneous sources** (open-source repos, student reports, forum posts on varied hardware) and are indicative, not benchmarks for your stack; measure on your own engine. The DLX numbers (16×16 ~115 ms, 25×25 ~460 ms) are *solve* times, not full *generation-with-uniqueness* times, which are substantially higher.
- **Some cited sites are commercial/marketing pages** (app listings, puzzle shops) whose difficulty and enjoyment claims are promotional; structural and performance claims here lean on primary/technical sources (KDE source code, academic solver papers, the enjoysudoku.com developer forum, the McGuire et al. proof, the MAA KenKen handout).
- **The calcudoku.org forum threads on large grids could not be retrieved** (the phpBB forum returns 503 to automated fetchers); the large-grid cadence and the "single solution" guarantee are quoted from the site's main page, while the "niche/for-enthusiasts" characterization is an inference from those framings plus publisher behavior (book descriptions, on-request-only 15×15+), not a verbatim community quote.
- **"Difficulty grading doesn't scale cleanly"** is a widely-shared practitioner view (including KDE's own devs) rather than a formally proven result.
- **Debut-date nuance:** the KenKen NYT daily debut was **February 2009**, not 2008; the 2008 debut was in The Times of London. Sources conflating "first daily since the crossword" with a 2008 date should be read with this correction.
- **Trademark note:** "KenKen"/"KenDoku" are trademarks of Nextoy LLC; "Mathdoku," "Calcudoku," "Newdoku," etc. are the generic names most third parties must use. Plan your branding accordingly.
