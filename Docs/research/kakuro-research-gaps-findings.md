# Kakuro Puzzle-Generator: Nine Open Research Gaps — Findings Log

> **Received 2026-09-11.** Answers gaps **G1–G5 and G7–G10** opened in the Kakuro running log
> ([kakuro-log.md](../kakuro-log.md)); G6 (6×6 hard separability), G11 (daily minis at 4 types) and
> G12 (combination helper) were not in scope. The answers are folded into the
> [implementation plan](../kakuro-implementation-plan.md) (E2–E5, R1, D1/D5/D9/D10) per AGENTS.md
> Roadblock & Research Rules; this file stays as the durable record of *why* the plan changed —
> most importantly, **D5 flipped** from a bounded-T&E top tier to Berthier-style chains. Builds on
> [kakuro.md](kakuro.md). Not legal advice (G1).

## Contents

## TL;DR

- Six of nine gaps are strongly resolved from primary sources (G1 trademark, G3 template method, G4 surface sums, G8 rating mapping, G9 grading scheme, G10 degenerate blocks); G2 (solve times), G5 (T&E requirement), and G7 (accessibility) are moderately resolved with named analogues.
- **"Kakuro" is safe to use as a US product name** — all US KAKURO word marks are dead/abandoned and the EU bare-word application was refused for non-distinctiveness; but 「カックロ/KAKURO」 remains a live registered trademark of Nikoli in Japan, so keep "Cross Sums" as a documented fallback.
- **G4 (highest priority) is solvable**: surface sums = graph articulation-point (cut) detection; Denis Berthier's CSP-Rules/KakuRules implements it, but his empirical finding is that surface sums rarely simplify hard puzzles — meaning a T4 tier built on them is fragile and may collapse toward T3.

---

## G1 — Trademark clearance for "Kakuro" / "Cross Sums"

**Confidence: STRONG (US, EU); MODERATE (Japan).**

**(a) US KAKURO word marks — all dead.** The prior data point (abandoned 2007) is confirmed, and there are multiple such applications, all filed by or around Nikoli Co., Ltd in late 2005 and all now dead:

- **Serial 78761064** (KAKURO, standard-character word mark, Class 41 — online games, publication services), filed 2005-11-26, **status 602 Abandoned–Failure To Respond Or Late Response, dated 2007-07-31**. Attorney Howard N. Aronson. Timeline: non-final office actions 2006-06-07 and 2007-01-02; abandonment notice mailed 2007-07-31. This matches the prior "abandoned 2007" data point exactly.
- **Serial 78761060** (KAKURO, Class 16 — books/magazines/newspapers in puzzles/games), filed 2005-11-26, abandoned (Nikoli Co., Ltd).
- **Serial 78771210** (KAKURO, Class 9 — computer game software and video game software), filed 2005-12-12, **status 602 Abandoned, dated 2007-02-26**. Owner Merscom LLC.
- **Serial 78770924** (KAKURO, Classes 9/28 — pre-recorded DVDs/CD-ROMs of games, board/party/parlor games, toys), filed 2005-12-11, **abandoned 2008-04-16**.
- **Serial 78771202** (BUKU KAKURO, Classes 9/16/28/41), filed 2005-12-12, **status 606 Abandoned – No Statement of Use Filed, dated 2009-09-21**; published for opposition 2008-11-25; note it disclaimed "KAKURO" apart from the mark.

**(b) Current live US coverage.** No live US registration for the word "KAKURO" for games/puzzle software was found. Nikoli's live US marks are for "NIKOLI" (e.g., Reg. 4279251 / Serial 85642182, Class 9 game software, **status 702 Section 8 & 15 Accepted and Acknowledged, 2019**), not "KAKURO." A new NIKOLI application (Serial 98915641) was filed 2024-12-20 for books in puzzles/games — again "NIKOLI," not "KAKURO." The word "Kakuro" is treated as a puzzle-type descriptor in US commerce. No common-law use claim covering "KAKURO" for software surfaced.

**(c) EU status.** EUIPO application **004764321** (word mark "Kakuro," Nikoli Co., Ltd, Classes 16 and 41), filed 2005-11-25, **status: Application refused, dated 2006-11-29**. Mark distinctiveness is recorded as "No" (refused on absolute grounds — lack of distinctiveness). There is no live EU registration for the bare word "Kakuro."

**(d) Japan status.** Nikoli's own site states plainly: 「カックロ(KAKURO)」はニコリの登録商標です ("'Kakuro (KAKURO)' is a registered trademark of Nikoli"), and Nikoli maintains a public registered-trademark list (ニコリ所有商標登録一覧). "Kakuro" is a contraction of 加算クロス (*kasan kurosu*, "addition cross"). The English name "Cross Sums" predates it: per Wikipedia's Kakuro article, "In 1966, Canadian Jacob E. Funk, an employee of Dell Magazines, came up with the original English name Cross Sums," and the puzzle had appeared in Dell's *Official Crossword Puzzles* as early as 1950. Nikoli imported the puzzle to Japan (via founder Maki Kaji) and released its first dedicated Japanese "Kakuro" booklet in the mid-1980s; the Japanese registration is live and actively asserted.

**Risk assessment.** Using "Kakuro" as a public product name is **low-risk in the US** (no live marks; genericized as a puzzle category) and **low-risk in the EU** (bare-word application refused for non-distinctiveness). It is **higher-risk in Japan**, where Nikoli holds a live registered mark and asserts it publicly. Practical recommendation: safe to use "Kakuro" as the display name for a US/EU-facing product, with the descriptive subtitle "Cross Sums"; keep "Cross Sums" as a fully-generic fallback title for any Japan distribution, or if Nikoli asserts rights. Avoid any implication of affiliation with Nikoli. (Not legal advice — verify against live USPTO TSDR and EUIPO eSearch before a launch decision.)

---

## G2 — Human solve-time baselines by grid size × difficulty

**Confidence: THIN for Kakuro-specific; MODERATE via Sudoku analogue.**

No rigorous published Kakuro solve-time telemetry broken out by grid × tier was found. Data points located:

- **Kakuro-online.com forum**: expert solvers discuss the daily puzzle; one notes solving "today's puzzle under 4 minutes is insane," implying ~4 minutes is exceptional-fast for a hard daily and 10+ minutes is normal for hard puzzles among skilled solvers. Another thread references a 44-cell puzzle solved in 36 seconds by a top solver (~0.8 s/cell) as an admired outlier.
- **Mathimagics (enjoysudoku forum)**: reports Conceptis "Absolutely Nasty Level 4" 24×14 puzzles are computationally "singles-only" (rating 1) yet "take hours to complete" by hand — grid size drives human time more than logical rating.
- **Krazydad (Jim Bumgardner)**: publishes *Beat the Clock Kakuro* (214 easy-to-hard puzzles with target time limits), the closest thing to published per-puzzle time targets, though exact per-puzzle target values were not extractable from listings.
- **Sudoku analogue** (widely reported recreational benchmarks): easy 5–15 min, medium 10–30 min, hard 20–45 min, expert 45+ min; Sudoku Garden telemetry reports a mean of ~569 s (~9.5 min) across all levels. For the record ceiling (not a typical baseline): the Guinness fastest "Easy" Sudoku is Thomas Snyder (USA) at 2 min 8.53 sec (BookExpo America, Washington DC, 20 May 2006), and the fastest standard 9×9 competition solve is Wang Shiyao (China) at 54.44 sec (World Sudoku & Puzzle Championship, Prague 2018). Typical human experts run 5–10 minutes, far off record pace.

**Fallback for floor-times / anti-cheat.** Use grid cell count as the dominant term, not logical rating. Suggested conservative floor times (derived from the above analogues, explicitly flagged as estimates): 6×6 easy ~1–2 min; 9×9 medium ~5–10 min; larger 14×14+ hard ~20–60 min. Log this as an estimated calibration and refine with your own app telemetry once live. Because Snyder's certified sub-2:10 pace exists, set bot-detection floors below "unassisted human record density" (e.g., well under ~0.8 s/cell) rather than at typical human speed.

---

## G3 — "Edges-inward" symmetric template generation (Mathimagics method)

**Confidence: STRONG.** Full primary source located: Mathimagics, "Kakuro Template Generation," enjoysudoku.com forum (thread t33581, Feb 2017), written in response to an email from user surendra.jain asking his method.

**Procedure (implementable):**

1. **Start from the outer edge, work inward.** For a diagonally-symmetric grid, generate the top and left edges; reflect across the main diagonal to complete the outer border. Generate all valid edge patterns for the given size and pick one at random (any method works).
2. **Force neighbours of edge whites.** Any white cell on the outer edge forces its inward neighbour to be white too (every white cell needs ≥1 horizontal and ≥1 vertical neighbour — no "orphans"). This fills rows/cols 2 and N-1 deterministically.
3. **Use odd N so the centre row/col is self-symmetric**, reducing the free decision space: you only choose a symmetric pattern for the middle row.
4. **Fill remaining interior cells outside-in**, row by row toward the centre; symmetry means completing rows 3..centre auto-completes their reflections.
5. **For each free cell, check forcing; else random X/dot.** A move is *forced* if leaving it free would violate (a) contiguity (white region must stay connected) or (b) the desired maximum run length.
6. **Termination/restart:** if the process gets stuck (cannot satisfy contiguity or max-run-length), restart from the outer edge or restart the whole process.

**Invariants:** 180°/diagonal symmetry maintained throughout; white region always connected; no run exceeds max length; no orphan cells.

**Other sources:** Conceptis and Krazydad do not publish their layout conventions (Krazydad notes its format "retains visual symmetry… showing each clue twice inside a triangle"). No open-source template catalog at 6×6/9×9/12×12/13×17 was found, but Mathimagics' companion "Uniqueness of Solutions" thread provides a min-hints/max-blanks table (see G10) that constrains valid templates by size, which can be used to bound the generator.

---

## G4 — Surface sums / disconnection sums (HIGHEST PRIORITY)

**Confidence: STRONG on the algorithm; STRONG on the caveat that limits its value.**

**Definition (Denis Berthier, in his book *Pattern-Based Constraint Satisfaction and Logic Puzzles* [PBCS] and on the enjoysudoku forum):** A "surface sum" exploits the difference between the horizontal and vertical sums of white cells making up a *region separated from the rest of the puzzle by one or more white cells*. Bill Smythe's equivalent folk terminology: "singularity" (1 separating cell — a "gimme," value = H − V), "doubularity" (2 cells — you learn either their sum or their difference), "tripularity," etc.

**Detection algorithm (Berthier, verbatim on the forum — "Detecting them is easy"):**

1. Build the connection graph: vertices = white cells; edge between two white cells iff orthogonally adjacent.
2. Run a standard **articulation-point / n-cut detection** algorithm. A 1-cut (single vertex whose removal disconnects the graph = articulation point) is the cheapest and most useful case; generalize to k-cuts as needed.
3. **Using the cut:** For a 1-cut, the separated region gives a new sum constraint. Sum of the region's row-sums = sum of its column-sums (commutativity/associativity of addition); the cut cell's value = (sum of across-clues spanning the region) − (sum of down-clues), i.e., the H−V residue. For a 2-cut there are up to 4 sub-cases and you get either the sum or the difference of the two cut cells (new equality/difference constraints between distant sums).

**Singularity/doubularity cases (from the forum discussion, Smythe/Berthier):**

- **Simple surface sum / singularity:** constrains a single cell's value directly (H − V).
- **Sum doubularity:** two stick-outs both horizontal or both vertical → you know their sum.
- **Difference doubularity:** one horizontal + one vertical stick-out → you know their difference; if the difference is 8, it's a forced 1/9 "gimme."
- Berthier's refinement: the surface may contain interior black cells provided every sector intersecting the surface has a specified sum (so H and V totals are computable).

**Worked example from the thread (bottom-right corner):** horizontal sum of six cells = 22, vertical sum of four of them = 7, so the two stick-out cells must sum to 15 (a doubularity) ⇒ neither can be 5 ⇒ column resolves.

**Implementation source:** Denis Berthier's **CSP-Rules-V2.1 / KakuRules** (open-source, GitHub `denis-berthier/CSP-Rules-V2.1`; large-scale examples in `denis-berthier/CSP-Rules-Examples`). It encodes Kakuro by adding redundant CSP variables (`hrc`, `vrc` combination-variables per sector) so that non-binary sum constraints become binary and amenable to chain rules (whips/g-whips). Surface sums are implemented as *application-specific rules* (PBCS §15.6, "Application-specific rules in Kakuro: surface sums"); Berthier states he only implemented **1-cuts** in his book (2-cuts introduce distant-sum-equality constraints he judged not worth the complexity).

**CRITICAL caveat that affects the T4 tier decision:** Berthier's empirical finding, from testing hundreds of ATK "hard" puzzles: *"surface sums do not generally lead to noticeable simplifications (in terms of the W rating) of the whip-based solutions."* On real published hard puzzles, surface sums rarely change the difficulty — the puzzles are solvable by whips[n] anyway. **Implication for the technique ladder:** a T4 tier defined purely by "requires surface sums" will be sparsely populated and often collapses to the underlying whip-based tier (T3). A more robust T4 should be defined by chain depth (whip/g-whip length), with surface sums as an occasional accelerator, not the defining technique. This directly answers the blocking question: implementing surface sums is cheap (articulation-point detection is linear-time), but it will NOT reliably create a distinct difficulty rung.

---

## G5 — Do commercial "hardest" tiers require bounded T&E?

**Confidence: STRONG (Berthier's classification finding is decisive).**

**Finding: Commercially published hard Kakuro (ATK "hard," Conceptis "Absolutely Nasty," Conceptis "Black Belt") are generally solvable by logical chains WITHOUT trial-and-error.** Evidence:

- **Berthier (CSP-Rules author)** ran "hundreds" of ATK "hard" puzzles — "among the hardest I've found on the web" — through KakuRules and found them solvable by his whip/g-whip chain rules (no T&E). His W-rating classifies them; a sample "complex surface sum" puzzle resolved fully at Whip[2].
- **Mathimagics**: Conceptis "Absolutely Nasty Level 4" 24×14 puzzles are mostly "singles only" (his rating 1) — no T&E needed, just laborious domain-shaving; difficulty comes from size, not from requiring guessing.
- **Amazon reviews of Conceptis "Third-Degree Black Belt"** corroborate: "Most puzzles can be solved with pure logic," a reviewer explicitly contrasting this with other books that "reach a stage where logic can take you no further" and require T&E. Reviews of "Black Belt" and "Second-Degree Black Belt" similarly report the puzzles are "all solvable" without guessing.
- **Contrast — genuinely T&E-requiring puzzles exist but are NOT commercial**: Mathimagics' "diabolical" 7×7 (rating 6.2) required days of CPU time to construct and is "almost entirely T&E." These come from computational-complexity research, not published books. (A visitor, joemcm, did eventually hand-solve it, but described using extensive trial-and-error.)

**Decision for the difficulty transplant.** A bounded-depth guessing ("T&E") engine transplanted from a Sudoku-variant project does NOT honestly represent commercial "Expert/Extreme" Kakuro, because those tiers are, by construction, chain-solvable. To honestly match published Expert/Extreme, implement **chain techniques (whips / g-whips in Berthier's terminology)**, not bounded guessing. Bounded T&E would either over-rate easy-but-large puzzles or mislabel guess-required puzzles that no reputable publisher ships. Reserve any T&E path for a clearly-labeled "beyond published difficulty" experimental tier.

---

## G7 — Accessibility & rendering conventions

**Confidence: MODERATE (rendering STRONG; Kakuro-specific ARIA THIN, analogue STRONG).**

**(a) Diagonal clue-cell rendering.** Standard convention (Penny Dell, Nikoli, Conceptis, Krazydad, and all digital apps surveyed): a black clue cell holds a diagonal line from upper-left to lower-right; the **upper-right triangle = the DOWN sum** (vertical run below), the **lower-left triangle = the ACROSS sum** (horizontal run to the right). Digital rendering is typically a CSS/SVG triangle split (a diagonal linear-gradient or an SVG line) with two text anchors. Krazydad's print format shows each clue "twice inside a triangle, on each side of the word" to preserve visual symmetry. dCode's text encoding convention is `x\y` where x = lower-left (across) and y = upper-right (down) — a compact serialization worth adopting internally.

**(b) Accessible representation.** No screen-reader-tested Kakuro ARIA implementation was found (a genuine gap). Best analogue is the **WAI-ARIA grid pattern** (MDN "ARIA: grid role"; W3C APG): container `role="grid"`, rows `role="row"`, cells `role="gridcell"`. For Kakuro, recommended approach: give each fillable white cell `role="gridcell"` with an `aria-label` identifying its position and the runs it participates in ("row 3 column 4, across clue 17, down clue 23"); give clue cells a distinct accessible name that spells out both sums ("clue cell, across 16, down 24") and mark them `aria-readonly="true"` / non-editable. Announce empty blocker cells as such or remove them from the tab order. Provide `aria-rowcount`/`aria-colcount` and `aria-rowindex`/`aria-colindex` for position (per Accessibility.build's data-grid guidance). Note Adrian Roselli's caution that `role="grid"` semantics are only exposed to screen-reader users, so pair with visible focus indicators for keyboard-only users.

**(c) Keyboard navigation.** Follow the APG grid roving-tabindex pattern (one Tab stop for the whole grid; arrow keys move one cell each direction). Focus should skip non-fillable blocker cells (or land on clue cells as read-only, announcing them but not accepting digit input). Digit keys 1–9 fill; Backspace/Delete/0 clears; optionally Ctrl+arrow to jump to the next run boundary. Manage focus so arrow navigation lands only on cells that make sense; avoid Ctrl+PageUp/Down and Ctrl+Up/Down, which JAWS intercepts (per W3C wai-xtech data-grid testing notes).

**(d) Print-layout conventions.** Krazydad/Conceptis PDF conventions: one puzzle per page; landscape for larger grids; heavier grid outer border than interior lines; clue cells shaded (Mathimagics prints them grey "to save toner"); each clue in its triangle. A PDF export should use light (≈0.5 pt) interior lines with a heavier outer border, adequate margins, and an answer key on a separate page (Krazydad puts answers "in the back"). Krazydad also offers two formats — the symmetric "krazydad format" (clue shown twice) and a conventional single-clue format — worth supporting both.

---

## G8 — Mapping Mathimagics `fixed`/`implied`/`rating` to commercial grades

**Confidence: STRONG (primary source: Mathimagics "Kakuro rating system" thread, t33270).**

**The Mathimagics profile metrics:**

- **`fixed`** = number of cells fixed by a Unique Sum Intersection (USI) — e.g., an S30/L4 run crossing an S9/L3 forces a 6 — plus cells forced when only one free cell remains in a run.
- **`implied`** = additional cells resolved by iterated "domain shaving" (candidate elimination: can the H and V sums still be formed with digit D here? often no).
- **`Rating`** = average NPV (number of possible values) per white cell after all singles/shaving. Rating = 1.0 means every cell resolved to a single value by shaving alone; >1 means shaving is insufficient. Described as "like the Richter scale": a 2 is ~4× as hard as a 1 on the same layout. (Extreme research puzzle: a 7×7 with Rating 6.2059.)
- Supporting: **MRL** (max run length), **ACRL** (avg cell run length), **NCELL** (white-cell count and % of interior).

**Calibration table against ATK grades (Mathimagics' own data):**

| | E1 | E2 | M1 | M2 | H1 | H2 | H3 |
|---|---|---|---|---|---|---|---|
| Size | 9 | 11 | 13 | 10 | 14 | 13 | 13 |
| NCELL | 52 | 82 | 104 | 63 | 139 | 116 | 118 |
| fixed | 20 | 33 | 25 | 5 | 23 | 2 | 8 |
| implied | 32 | 49 | 79 | 58 | 78 | 105 | 76 |
| Rating | 1.0 | 1.0 | 1.0 | 1.0 | 1.7 | 1.15 | 1.45 |

**Mapping conclusions:**

- **ATK Easy** = small grids + high `fixed` count + Rating 1.0.
- **ATK Medium** = larger grids and/or fewer `fixed`; Rating still 1.0 (shaving completes it, but more work).
- **ATK Hard** = large grids, very low `fixed` (2–23), Rating > 1.0 (1.15–1.7); shaving alone does not finish.
- **Conceptis "Absolutely Nasty Level 4"** example CB049 (24×14): Rating 1.0 but only 38 fixed of 251 cells → "Very Hard" for humans despite the low rating, because grid size + low fixed% drive human effort. **Key caveat: Rating alone does not equal human difficulty; grid size and fixed% must be combined with it.**
- Mathimagics did NOT tabulate against Conceptis star ratings; the mapping to Conceptis is qualitative ("Absolutely Nasty" ≈ Very Hard). No formal cross-reference table beyond ATK exists.

Note: Mathimagics (forum handle) has since passed away (per a 2024 forum post by m_b_metcalf), and his rating code was not publicly released, so the metric is reproducible only from his described definitions above.

---

## G9 — Simonis "Kakuro as a Constraint Problem": grading scheme

**Confidence: MODERATE (abstract & method verified; exact Kakuro numeric tables not retrievable due to paywall/rate-limiting).**

**Paper:** Helmut Simonis, "Kakuro as a Constraint Problem," **ModRef 2008 — the 7th International Workshop on Constraint Modelling and Reformulation**, eds. P. Flener & H. Simonis, held at CP 2008; work done at the Cork Constraint Computation Centre (4C), University College Cork. (A companion in the same programme is his 2005 "Sudoku as a Constraint Problem," which uses the identical methodology.)

**The grading scheme (verified):** Simonis grades a Kakuro instance by the **weakest constraint-propagation strength (level of consistency) that still solves the instance "search-free"** — i.e., by propagation alone with no backtracking. Puzzles solvable by weak propagation are easy; those requiring progressively stronger methods are harder. His constraint ladder for Kakuro:

1. Naive model: separate `alldifferent` + `sum` constraints (weak; does NOT solve all instances search-free).
2. **Hyper-arc-consistent `alldifferent-sum` combined constraint** — the key strength that renders ALL tested Nikoli instances search-free.
3. **Shaving** as a further strengthener, in two variants: **Method 'S'** = one shaving pass over variables removing inconsistent values; **Method 'R'** = recursive shaving until saturation.

This is an **ordinal/lattice grading** (which propagation level is needed), NOT a weighted numeric sum of human techniques. The analogous Sudoku paper maps grades Beginner=FC → Easy=FC+channeling → Medium=HAC (hyper-arc-consistency) → Difficult=HAC+extras → +Shaving → Monster=none-known. The abstract states (verbatim): "We also propose a grading scheme predicting the difficulty of a puzzle for a human and show how problems can be tightened by removing hints." The correlation with public grades is real but imperfect — the companion Sudoku paper notes designer grades "often, but not always" match the propagation level.

**Tightening by removing hints:** Start from a full/uniquely-solved grid and remove given sum-clues one at a time as long as the puzzle stays "well posed" (unique solution) and search-free at the target scheme, producing **locally minimal** instances (harder for humans, fewer givens). The procedure is greedy, not guaranteed globally minimal.

**Reusability for your scorer:** The directly reusable idea is to define difficulty tiers by the *weakest solver technique level that finishes without guessing* — which aligns naturally with a technique-ladder (T1..T4) design; use a shaving-based "reduced domain" pass for the low tiers. **Not directly reusable:** there is no published weighted-coefficient formula in this paper to copy as scorer weights; the scheme is categorical/ordinal. Verified concrete numbers: search-node limit 500,000; SAT (Minisat+) solved all instances within 300 s (~28 s average); MIP experiments used ECLiPSe→Cplex 10.0; a lookup table gives, per (sum, run-length) pair, which digit values can be removed. Exact Kakuro correlation coefficients, per-collection instance counts, and grade distributions could NOT be retrieved verbatim (ResearchGate returned HTTP 429). Fallback: fetch the ModRef 2008 proceedings PDF or the Cork 4C technical-report version directly; and note that an independent 2026 TU-Berlin bachelor thesis (Abdeldayem, "A Deductive Search-Based Solver for Kakuro Puzzles") reproduces a related deductive-search difficulty estimate that "strongly correlate[s] with… official ratings provided by puzzle publishers, such as Nikoli," and characterizes Simonis's approach as propagation/shaving-centric with "very few Kakuro-specific strategies" — confirming the scheme is solver-strength based, not a human-technique weighted score.

---

## G10 — Structural non-uniqueness pre-checks (degenerate sub-blocks)

**Confidence: STRONG (primary source: Mathimagics "Uniqueness of Solutions" thread, t32710).**

**Core static rejection rule (verbatim finding):** *"A template with 2 runs of length 9 that are aligned and adjacent can never deliver a unique solution"* — because swapping the row (or column) values yields identical sums (a sum-preserving cycle). Generalizing, Mathimagics identified **critical blocks** = rectangles of contiguous all-white cells guaranteed to contain a sum-preserving swap cycle and therefore forcing non-uniqueness:

- **2×9** (equivalently aligned 9-runs)
- **3×8**
- **4×7**
- **5×5**

His summary: *"What the sizes 2×9, 3×8, 4×7, and 5×5 have in common is that they are guaranteed to contain a cycle of some sort, thus guaranteeing ambiguity in the corresponding solution space of any grid G containing them."* Any all-white rectangular block meeting or exceeding these dimensions is (almost) certainly non-unique.

**Detection procedure for a generator (cheap, pre-solver):**

1. Scan the candidate template for maximal all-white rectangular blocks.
2. Reject/avoid any block of size ≥ 2×9, 3×8, 4×7, or 5×5 (and their supersets like 5×6, 6×6, etc.).
3. Blocks strictly smaller than these thresholds are permitted. Mathimagics tabulated which sizes can appear in a unique-solution grid: 2×2 through 2×8, 3×3 through 3×7, 4×4 through 4×6 (with 3×6, 3×7, 4×5, 4×6 only viable inside a larger grid), and 5×5 only under special conditions.
4. **Nuance:** a 5×5 all-white block CAN yield uniqueness if it is broken by interior clue/hint cells (his 15×15 example built on 5×5 corners worked because the corners carried 2 hint cells). So the check must be on *contiguous* all-white rectangles, not their bounding boxes.

**Additional generator guidance from the same thread** — min-interior-hints / max-blanks table (standard 180° symmetry achievable in all listed cases):

| N | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| max blanks (NB) | 15 | 24 | 34 | 46 | 59 | 74 | 88 | 108 | 128 | 148 | 172 | 196 |
| min interior hints (NH) | 1 | 1 | 2 | 3 | 5 | 7 | 12 | 13 | 16 | 21 | 24 | 29 |

**Also cheap to detect (smallest degenerate pattern):** Mathimagics' 2×2 all-white example (morl's 5×5-corner puzzle) shows the minimal case — an isolated 2×2 all-white area bounded so both its row-pairs and column-pairs are free admits a swap, yielding multiple solutions. General principle: look for sum-preserving digit-swap cycles (rectangular "unavoidable sets," analogous to Sudoku deadly patterns) and reject before running the expensive solution-counting pass to raise yield. A separate practical tip from Mathimagics for *generating* multi-solution test cases: take a unique-solution grid, pick a cell, add/subtract 1 from both its H and V sums.

**Berthier/CSP-Rules note:** Berthier's uniqueness discussion focuses on minimal instances and the "T&E vs braids" theorem rather than a static degenerate-block catalog; the Mathimagics thread is the most directly implementable source for static pre-checks.

---

## Recommendations (staged)

1. **Ship as "Kakuro (Cross Sums)"** in US/EU now; document the Japan trademark risk and keep "Cross Sums" wired as a one-flag fallback title. Re-check USPTO TSDR and EUIPO eSearch before any paid marketing push. *Threshold to switch to "Cross Sums":* any new live KAKURO filing in your target market, or a cease-and-desist from Nikoli.
2. **Implement chain techniques (whips/g-whips) for the difficulty ladder, not bounded T&E** (G5). Port the logic model from CSP-Rules/KakuRules (redundant `hrc`/`vrc` sector-combination variables → binary constraints). This is the honest basis for Expert/Extreme.
3. **Treat surface sums as an accelerator, not the T4-defining technique** (G4). Implement articulation-point (1-cut) detection — linear time — but define T4 by chain depth; expect T4 to be sparse if defined by surface sums alone. *Threshold to keep surface sums as a defining rung:* only if your own corpus shows a meaningful population of puzzles where a surface-sum step reduces the whip-rating; Berthier's evidence says it usually won't.
4. **Use the edges-inward generator (G3) + static degenerate-block rejection (G10)** as the generation pipeline; reject ≥2×9/3×8/4×7/5×5 contiguous all-white rectangles and enforce the min-NH/max-NB table before any solution-counting pass.
5. **Adopt Mathimagics' fixed/implied/Rating profile plus grid-size and fixed% (G8)** as your PROFILE difficulty-table inputs; calibrate tier cutoffs against the ATK table (Easy: Rating 1.0, high fixed%; Hard: Rating >1.1 or large grid with low fixed%). Frame the tier *definitions* using Simonis's "weakest search-free technique level" (G9).
6. **Calibrate solve-time floors by cell count, not logical rating (G2)**; start from the estimated ranges and refine with live telemetry. Set anti-cheat floors well below unassisted-human record density (<~0.8 s/cell).
7. **Build the grid on the WAI-ARIA grid pattern (G7)** with read-only clue cells announcing both sums, roving-tabindex keyboard nav skipping blockers, and a print/PDF stylesheet following Krazydad/Conceptis conventions (heavier outer border, shaded clue cells, one puzzle/page, separate answer key).

## Caveats

- **G2** solve-time floors are estimates from Sudoku analogues plus sparse forum anecdotes; no rigorous per-grid × per-tier Kakuro telemetry exists publicly.
- **G9** exact numeric tables (Kakuro correlation coefficients, per-collection instance counts, grade distributions) could not be retrieved (ResearchGate HTTP 429); the method and abstract claims are verified, the specific numbers pending direct proceedings/technical-report PDF access.
- **G8** Mathimagics' rating code was never released and its author is deceased; the metric is reproducible only from the described definitions.
- **G7** no screen-reader-tested Kakuro implementation exists; the ARIA guidance is extrapolated from the general grid pattern and accessible data-grid guidance (MDN, W3C APG, Roselli, Accessibility.build) — validate with real AT (JAWS/NVDA/VoiceOver) testing.
- **G1** trademark statuses are as recorded in Justia/EUIPO/Nikoli mirrors; verify against live USPTO TSDR and EUIPO eSearch before relying on them. This log is research, not legal advice.
