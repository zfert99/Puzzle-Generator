# Skyscrapers Puzzle-Generator: Open Research Gaps — Findings Log

> **Received 2026-10-01**, the same day the plan opened. Answers gaps **G1, G2, G9 and G10** and
> narrows **G5** from the Skyscrapers running log ([skyscrapers-log.md](../skyscrapers-log.md));
> G3, G4, G7 and G12 are measurements for slice E3, G6 waits on telemetry, G8 on a screen-reader
> pass, and G11 is the owner's design call. The answers are folded into the
> [implementation plan](../skyscrapers-implementation-plan.md) (D1 gains a wired fallback title; D9
> adopts Tatham's prefix rule; V3's print numbers; E1/E3 test additions) per AGENTS.md Roadblock &
> Research Rules; this file is the durable record of *why*. Builds on
> [skyscrapers.md](skyscrapers.md), and corrects two of its claims (§G10). Three web-research
> streams plus one exact in-session measurement (G5). Not legal advice (G1).

## TL;DR

- **G1 — one live mark matters.** The U.S. is clear (the 1997 "SKYSCRAPER" game filing is confirmed
  dead; no live SKYSCRAPERS / TOWERS mark covers puzzles, games or games software), Japan is clear
  (Konami's SKYSCRAPER and oneA's TOWERS both expired; no ビルディングパズル mark), but the **EU/UK has a
  live bare-word "SKYSCRAPER"** — Inspired Gaming (UK) Ltd, EUTM 017322223 / UK00917322223, classes
  9/28/41/42, class 9 wording "skill games … games software; downloadable gaming applications",
  expiring 2027-10-12 with a "not to be renewed" flag. A slot-machine supplier, a singular mark, a
  different trade channel — but broad wording. **Decision:** ship "Skyscrapers" with **"Towers"
  wired as a one-constant fallback title** (the Kakuro / "Cross Sums" pattern); get a professional
  read before any EU logo or paid use.
- **G2 — ASP-completeness is open for clue-only Skyscrapers and settled for the givens variant.**
  Both NP-completeness proofs (Iwamoto–Matsui 2016; Haraguchi–Tanaka 2017) rely on **givens**;
  Haraguchi–Tanaka's reduction is in fact solution-bijective but from NAE-SAT, whose
  another-solution problem is trivial, so it yields no ASP result. With givens allowed the puzzle
  contains Latin-square completion, which *is* ASP-complete (Colbourn–Colbourn–Stinson 1984), so
  that variant is ASP-complete by the identity reduction. Nothing changes in practice: count to 2.
- **G5 — the minimum clue count is conjectured N−1** (Nakamura 2016, Nagoya workshop slides: a
  unique N-puzzle with N−1 clues exists for every N; none with N−2 up to N = 8). **Measured exactly
  here at 4×4: 3 clues suffice** — 208 of the 576 squares are determined by some 3-clue subset,
  142 need 4, 22 need 5, and 204 are not determined even by all 16. No 2-clue subset determines
  any square. The conjecture holds at N = 4.
- **G9 — print numbers exist now.** Krazydad: clue digits exactly **½ the solved-digit size**
  (0.33 vs 0.66 of a cell), **one tone lighter** (#444 vs black), bold, no arrows, ~0.2 cell clear
  of a **5 pt frame over 1 pt grey inner rules**, one puzzle per A4 page, answers 3 × 4 on one page
  without clues. Championship booklets: same font as the grid digits, ~0.5 cell standoff, frame
  2–7× the inner rule, no arrows.
- **G10 — nobody auto-tints a satisfied clue; everybody lets you grey one by hand.** Tatham,
  Brainbashers and puzzle-skyscrapers.com all have click-to-grey "done"; Conceptis's clue click is a
  visibility visualiser instead. Violations: puzzle-skyscrapers flags a clue only when its line is
  full (default on); **Tatham flags a provable violation immediately from the filled prefix** —
  earlier, O(N), zero false positives. **Decision:** adopt the prefix rule; satisfied tint off by
  default; keep the manual toggle, undo-able and persisted, drawn error > done > normal.

---

## G1 — Trademark clearance for "Skyscrapers" / "Towers"

**Confidence: STRONG (US, JP, WIPO), STRONG on the EU/UK record, MODERATE on what it means.**

**Registers actually queried.** USPTO TSDR by direct status URL (full record); TMview's search
endpoint (federates US / EM / GB / JP / WO; current to September 2026 filings — coverage
sanity-checked by retrieving Nikoli's 数独 marks); EUIPO's `copla` JSON per EUTM; Trademarkia (US
goods text). **Not reachable:** the USPTO search UI, the UK IPO search (captcha), J-PlatPat and
EUIPO eSearch UIs (JS-only), Justia (Cloudflare). EU/UK/JP findings therefore rest on TMview's
feeds, not the offices' own UIs.

**United States.** Serial 75285692 "SKYSCRAPER" — Saffire Corporation (American Fork, UT), class
28 "three-dimensional puzzle computer game", intent-to-use, filed 1997-05-02, **abandoned
1998-03-19** for failure to respond to an Office action (the 1998-05-27 date in the research doc is
the status date) (<https://tsdr.uspto.gov/statusview/sn75285692>). No live SKYSCRAPERS / SKYSCRAPER
or TOWERS / TOWER mark covers puzzles, games or software in classes 9 / 16 / 28 / 41: the live
SKYSCRAPER marks are TV equipment (Triveni Digital, cl. 9), whiteboards (Magnatag, cl. 16) and a
pending amusement-ride mark (Skyplex, cl. 41); "THE SKYSCRAPERS" (MLW LLC, cl. 9/25/41) is
pro-wrestling programming, pending/suspended. Dead class-28 SKYSCRAPER filings (Romano board games
2010, PlayCore, Kite Factory, Ball Bounce & Sport) and Ubisoft's TOWERS (cl. 9/28/35, abandoned
2014) complete the picture. [strong]

**EU and UK.** Searching "skyscraper" (contains) in classes 9/16/28/41 at the EUIPO returns two
records; one matters:

| Mark | Number | Owner | Classes | Status | Goods (class 9) |
|---|---|---|---|---|---|
| SKYSCRAPER (word) | EUTM 017322223 / UK00917322223 | Inspired Gaming (UK) Limited | 9, 28, 41, 42 | **Registered** 2018-05-10, expiry 2027-10-12, renewal flag "Not to be renewed" | "Skill games, gaming, gambling and/or games software; downloadable gaming and gambling applications" |
| TOWERS (word) | EUTM 011513181 / UK00911513181 | Ubisoft Entertainment | 9, 28, 41 | **Expired** 2023-01-23, not renewed | computer game software; games and playthings |

(<https://euipo.europa.eu/eSearch/#details/trademarks/017322223>,
<https://euipo.europa.eu/eSearch/#details/trademarks/011513181>.) An opposition against the
Inspired Gaming mark (no. 003043539) was filed and withdrawn. No EUTM or UK mark exists for the
plural "SKYSCRAPERS" in any relevant class. The games classes are dense with live "X TOWERS"
composites (Novomatic's TOWERS OF RA, adp Merkur's Dark/Night/Viking Towers, Asmodee's RAINBOW
TOWERS, WeirdBeard's Tricky Towers), so TOWERS is a weak, shared term there. [strong on the records]

**Japan.** Konami スカイスクレーパー / SKYSCRAPER (reg. 4335468, cl. 28 and 9, filed 1999) **expired**;
oneA タワーズ / TOWERS (reg. 4773806, cl. 28, 2003) **expired**; NJS "SkyScraper" (reg. 5585156, IT
services) live but unrelated. No ビルディングパズル / ビルディング puzzle-name mark exists. Sekai Bunka-sha's
PUZZLER marks (パズラー reg. 4520826 and siblings) are all expired; only its house mark 世界文化社
(reg. 6065713) is live. [strong] **WIPO:** no live bare-word Skyscraper / Towers international
registration in scope. [strong]

**Generic use.** Tatham's manual says the puzzle appears "under various names, particularly
'Skyscrapers'"; Conceptis, Puzzle Baron, Brainbashers, Krazydad and puzzle-skyscrapers.com all use
the name with no ® / ™; GM Puzzles traces first broad exposure to the 1992 WPC via Sekai Bunka-sha's
*Puzzler*. No publisher claims a mark on the puzzle name. [moderate]

**What it means for D1 (not legal advice).** "Skyscrapers" is clear in the US and Japan and is
plainly generic for the puzzle. The EU/UK record is a *singular* mark owned by a gambling-machine
supplier, with a renewal flag suggesting it lapses in 2027 — but its class 9 wording covers "games
software" on its face. The same posture that Kakuro's live Japanese mark produced applies: display
**Skyscrapers**, keep **Towers** as a one-constant fallback title the product can switch to, imply
no affiliation, and get a professional read before the word appears in an EU logo or paid
marketing. **D1 amended accordingly.**

## G2 — Complexity: is finding another solution ASP-complete?

**Confidence: STRONG on what the papers prove; MODERATE on the parsimony derivation.**

**Read in full:** Haraguchi & Tanaka 2017 (open PDF at J-STAGE); Kolijn 2022 (Radboud thesis);
Maarse 2019 (Utrecht thesis); Hoexum 2020 (Groningen thesis on Sudoku ASP); Seta 2002; Dehghan et
al. 2014; Nakamura 2016 (Nagoya slides, Japanese). **Abstract only:** Iwamoto & Matsui 2016 — the
J-STAGE PDF is subscription-gated and IEICE's pages sit behind a CAPTCHA that was not bypassed.

- **Iwamoto & Matsui 2016** (IEICE E99-A(6):1145–1148,
  <https://www.jstage.jst.go.jp/article/transfun/E99.A/6/E99.A_1145/_article>): deciding whether a
  Building puzzle has a solution is NP-complete. Haraguchi–Tanaka restate the problem as "an n×n
  Building puzzle instance and an n×n partial Latin square S — is there a solution extending S?",
  i.e. **with givens**. Reduction source and parsimony: unknown without the full text; no citing
  work claims ASP-completeness. [strong on the claim; thin on the construction]
- **Haraguchi & Tanaka 2017** (J. Inf. Process. 25:730–734,
  <https://www.jstage.jst.go.jp/article/ipsjjip/25/0/25_730/_article>): the *single-lined* problem
  — given a partial Latin square with rows 2..n fixed and **one** clue at the left of row 1, can row
  1 be completed all-different with exactly that many towers visible — is NP-complete, by reduction
  from Cubic Monotone Not-All-Equal (2,3)-SAT (Dehghan–Sadeghi–Ahadi,
  <https://arxiv.org/abs/1403.1182>). Their Claim 2 gives a **bijection** between truth assignments
  and all-different fillings, and the clue is met exactly when the assignment is NAE — so the
  reduction is parsimonious, though the paper never says so. It still does **not** give
  ASP-completeness: NAE-SAT's another-solution problem is trivial (complement the assignment,
  <https://arxiv.org/abs/1101.2170>), so every produced instance has an even number of solutions.
  Uses givens heavily. [strong on the theorem; moderate on the derivation]
- **Maarse 2019** (Utrecht, <https://studenttheses.uu.nl/items/6f4b4a1e-b93c-4a39-8795-bf167c07f6b8>):
  observes that with clues optional a clue-less instance *is* Latin-square completion, NP-complete
  since Colbourn 1984 — an independent, trivial hardness proof; raises uniqueness as open. [strong]
- **Latin-square completion is ASP-complete** — Colbourn, Colbourn & Stinson 1984
  (<https://doi.org/10.1007/BFb0073124>): unique completion is NP-complete via count-preserving
  reductions from UNIQUE 1-in-4 SAT; Yato & Seta reuse it for Sudoku
  (<https://www.cs.umd.edu/~gasarch/COURSES/858/S21/papers/tak.pdf>). Hence **Skyscrapers with
  givens is ASP-complete by the identity reduction** — all the hardness lives in the givens.
  [moderate — via Hoexum 2020's account]
- **Clue-only Skyscrapers** (no givens, the D3 product): ASP status **open**; counting (#P) open; no
  2023–2026 literature. [strong that nothing exists]

**Practical reading.** As the research doc already concluded: do not expect a polynomial
uniqueness test; use the complete solver with a 2-solution cap, as Sudoku and Kakuro do. G2 is
closed as "open in theory, irrelevant at N ≤ 9 in practice".

## G5 — Minimum clue count for a unique clue-only puzzle

**Confidence: MODERATE (Nakamura, slides only); STRONG for the 4×4 measurement.**

- **Nakamura 2016**, "ビルディングパズル 最小ヒント数について" (Nagoya University, workshop slides
  2016-03-07, <https://www.alg.cei.uec.ac.jp/itohiro/Games/160307/160307-10.pdf>): for a size-n
  clue-only puzzle the minimum number of clues for uniqueness is **≤ n−1** (a uniquely solvable
  puzzle with n−1 clues exists for every n; example 4×4 with 3 clues) and **not ≤ n−2, verified to
  n = 8** by exhaustive reduction over partial Latin rectangles (size 5: 142,500 candidate
  patterns). **Conjecture: exactly n−1.** Not peer-reviewed; the pruning step is stated without a
  rigorous proof.
- **Measured here, exactly, at N = 4** (every one of the 65,535 non-empty subsets of the 16 clues
  against all 576 Latin squares; Node, 9.7 s; the throwaway script is not in the repo — E1 turns
  the result into tests): the smallest subset that determines *any* square has **3 clues** (416 of
  the 560 three-clue subsets determine at least one square); **no 2-clue subset determines any
  square**. Fewest clues per square: **3 for 208 squares, 4 for 142, 5 for 22**; the remaining
  **204 squares are not determined even by all 16 clues** — the same 204 the all-clue ambiguity
  measurement found. The conjecture holds at N = 4, and the "1 clue can suffice" snippet the
  research doc flagged is now refuted at N = 4 as well as by argument.

**What it means.** Extreme's structural floor at a given size is about N−1 kept clues, not fewer;
E3 (b) records the minimum *surviving* clue count per size under uniqueness-preserving removal and
checks it against N−1; E1 pins the 4×4 facts (3 suffice, 2 never) as tests and the 5×5 "none with
3" check as a slow test if it fits a budget.

## G9 — Print layout specifics

**Confidence: STRONG (measured from the PDFs with pypdf and rendered pages).**

**Krazydad** (`KD_SKY_6x_V1_B10.pdf`, `KD_SKY_4x_V1_B10.pdf`, the `_a4_sheets` variant; index at
<https://krazydad.com/skyscraper/>; ReportLab, Helvetica Neue):

| Element | Booklet, 6×6 | Booklet, 4×4 | Rule |
|---|---|---|---|
| Page | A4 portrait 595 × 842 pt, 1 puzzle/page, 12 puzzles + 1 answers page | same | one per page |
| Cell | 67.6 pt (grid 405.8 pt, centred, 94.6 pt margins) | 93.7 pt | — |
| Inner rules | 1 pt, grey 0.8 (#ccc) | same | light |
| Frame | 5 pt black | same | **5× the inner rule** plus a colour step |
| Clue digit | 22.3 pt bold, grey 0.267 (#444) | 30.9 pt | **0.33 × cell = exactly ½ the solved digit, one tone lighter, no arrows** |
| Solved digit | 44.6 pt black | 61.8 pt | 0.66 × cell |
| Clue standoff | ≈ 14 pt (0.21 cell) clear of the frame, centred on its row/column | same | no clue-cell ring |
| Label | `#N` 18 pt bold, left-aligned with the frame, above the top clues; no difficulty label (difficulty = volume) | same | — |
| Answers page | 12 grids in 3 × 4; cell 27.8 pt; inner 0.5 pt grey, frame 3 pt; digits 18.4 pt; **edge clues not reprinted** | same | — |
| Sheets variant | A4 landscape, two booklet pages side by side scaled 0.707 | same | — |

**Championship form** (WPC 2019 IB p. 13, <https://ectoplsm.github.io/wpc-unofficial.org/pdfs/WPC%202019.pdf>;
WPC 2022 Kraków IB §8.13; WPF GP 2023 round 2 p. 6,
<https://gp.worldpuzzle.org/sites/default/files/Puzzles/2023/2023_PuzzleRound2.pdf>): clues in the
**same regular sans as the grid digits** at 0.6–0.7 of a cell, centred **~0.5 cell outside** the
frame (the 2022 booklet literally reserves a one-cell ring and centres the clue in it), inner rules
0.3–0.8 pt against a frame 2–3 pt (**3.75–6.7×**), **no arrows**, example and solution side by side.
Conceptis offers no downloadable PDF (print is a player feature). [strong]

**Consensus for V3:** plain digits outside the frame, in the grid's font, **about half the solved
digit's size and one tone lighter** (Krazydad) or the same size in competition form — pick the
Krazydad look for booklets; **no arrows**; 0.2–0.5 cell standoff; light inner rules with a frame
≥ 3× heavier; answers on one page without clues. The research doc's "60–70%" guess is replaced.

## G10 — Clue-state UX in the leading players

**Confidence: STRONG (read the JavaScript/CSS of three players and Tatham's current source).**

- **Simon Tatham's Towers** — manual (<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/towers.html>):
  "Left-clicking a clue will mark it as done (grey it out), or unmark it if it is already marked.
  Holding Control or Shift and pressing an arrow key likewise marks any clue in the given
  direction." Current source (puzzles-20260923): colour enum `COL_BACKGROUND, COL_GRID, COL_USER,
  COL_HIGHLIGHT, COL_ERROR, COL_PENCIL, COL_DONE` with `COL_DONE` = background ÷ 1.5 (mid grey); a
  clue click is an undo-able move `D%d,%d` toggling `clues_done[i]`; draw priority
  `DF_ERROR → COL_ERROR, else DF_CLUE_DONE → COL_DONE, else COL_GRID`. `check_errors()` evaluates a
  clue **immediately on the filled prefix** from the clue's side, stopping at the first empty cell:
  red if the visible count already exceeds the clue, if the tallest tower has been seen with the
  count still short, or if the count reaches the clue before the tallest — **provable violations
  only, no false positives, O(N)**. **Correction to the research doc:** it quoted a stale GitHub
  mirror (`ghewgill/puzzles`) whose enum lacked `COL_DONE`, and inferred "violated by a completed
  line"; the current source has the done colour and the prefix rule. [strong]
- **Brainbashers** (`skyscrapers0112.js`): clues are images; clicking swaps to a lighter variant —
  purely manual ("Clicking a clue will change its colour, helping you to remember that you've dealt
  with it"). `Check` compares cells to the stored *solution* and never touches clues. Keys: Ctrl +
  arrows, Shift + number highlight, `a`/`0` auto-pencil. [strong]
- **puzzle-skyscrapers.com**: a clue click toggles a saved, undo-able `done` state → grey (#999,
  normal weight). The default-on "highlight condition errors" recomputes after every move but flags
  a clue **only when its row/column is full**; mismatch → red (blue with the colour-blind option).
  No automatic satisfied tint. [strong]
- **Conceptis**: "Show conflicts" (duplicates in a row/column) and "Auto check completed lines"
  (errors when a line completes), both opt-in; clicking a clue **highlights the skyscrapers it
  sees** — a visualiser, not a done-mark. No clue recolouring documented. [moderate]
- **gridpuzzle / logic-puzzles-online**: Check / Hint / Undo / Reset buttons; nothing documented
  about clue state. [thin]

**Decision (D9 amended).** Violations: evaluate on every move and flag **prefix-provable**
violations immediately (Tatham), which is earlier than "complete line" with the same zero
false-positive guarantee; satisfied auto-tint **off by default** (none of five players does it,
and a wrong line can still satisfy a clue) with an optional subtle setting; keep the manual
**done** toggle (three of five players have it), undo-able and persisted with the board, drawn
**error > done > normal**. A clue-focus visibility highlight (Conceptis) stays a later teaching
aid.

## What changed in the plan and log

| Where | Change |
|---|---|
| D1 | "Towers" is now a **wired one-constant fallback title**, not just an alias; the EU/UK Inspired Gaming mark is the switch trigger; a professional read is required before EU logo / paid use |
| D9 | Violated-clue rule = Tatham's **prefix rule** (immediate, provable); satisfied tint off by default; done toggle undo-able + persisted; draw priority error > done > normal |
| V2 | Clue-state spec rewritten to D9′; the per-line selector computes the prefix check, not just completion |
| V3 | Print numbers: clue digits ½ the solved digit, one tone lighter, no arrows, 0.2–0.5 cell standoff, frame ≥ 3× inner rule; answers 3 × 4 per page without clues |
| E1 | Tests pin: 3 clues suffice at 4×4, no 2-clue subset does, 204 squares undetermined by all 16; 5×5 "none with 3 clues" as a slow test if cheap |
| E3 | Measurement (e): minimum surviving clue count per size vs the N−1 conjecture |
| G1, G2, G9, G10 | Resolved; G5 narrowed (conjecture N−1, exact at 4×4; survival measured in E3) |
| research/skyscrapers.md | Banner notes the corrections; §6's Tatham sentence fixed |

**Still open after these findings:** G3 / G4 / G7 / G12 (E3 measures), G6 (telemetry), G8
(screen-reader pass), G11 (owner: the first non-9×9 daily standard).
