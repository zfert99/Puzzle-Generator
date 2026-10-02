# Skyscrapers — Running Log

> **What this is:** the cross-cutting record for the Skyscrapers feature — **decisions**,
> **research gaps**, **bugs**, **learnings**, and **measurements** — kept alongside the
> [implementation plan](skyscrapers-implementation-plan.md). The plan holds the *spec and
> per-slice step-logs*; this file holds everything that cuts across slices or would otherwise live
> only in a chat transcript. **Newest entries first** in the journal; the tables below are the
> current state and are edited in place (a superseded row is struck through, not deleted).
> **Status:** 🚧 Living (opened 2026-10-01)

## How to use this file

- **Journal** — one dated line per event, newest first. Tag each with `[decision]`, `[gap]`,
  `[bug]`, `[learning]`, or `[measure]` and the `D#` / `G#` / `B#` it touches.
- **Decisions (D#)** — the table is the source of truth for status. Statuses: *proposed* (an
  agent's recommendation, not yet confirmed), *open — owner* (needs the user's call), *locked*
  (research-backed or confirmed), *applied* (in code / docs), *superseded* (struck through, with
  the successor named).
- **Gaps (G#)** — questions the research does not answer well enough to build on. Each names
  *what would resolve it* and *which slice is blocked or degraded* without it. When one is
  answered, fold the answer into the plan first (AGENTS.md → Roadblock & Research Rules), then
  mark it here with a link to where it now lives.
- **Bugs (B#)** — anything found broken while building, with cause and fix PR. A generalizable
  cause also gets a Learning row phrased as a rule.
- **Learnings** — rules the next slice can apply, not stories about this one (the pre-merge-log
  convention). Numbering continues from the Kakuro log's spirit, not its numbers — `L#` here is
  Skyscrapers-local.
- **Measurements** — yields, timings, distributions, with the commit they were taken at.

## Journal

- **2026-10-01 (gaps research)** [research/skyscrapers-research-gaps-findings.md](research/skyscrapers-research-gaps-findings.md)
  received — three web streams (trademark registers, complexity papers, print + clue-UX
  conventions) plus one exact in-session measurement. `[gap]` **G1 resolved**: US and Japan clear,
  but a **live EU/UK "SKYSCRAPER" mark** (Inspired Gaming, cl. 9 "games software", exp. 2027) →
  `[decision]` **D1 amended**: "Towers" becomes a wired one-constant fallback title. **G2
  resolved** (ASP open for clue-only, ASP-complete with givens via Latin-square completion;
  irrelevant at N ≤ 9). **G5 narrowed**: minimum clues conjectured N−1 (Nakamura 2016, verified to
  N = 8); `[measure]` exact at 4×4 — 3 clues suffice, 2 never. **G9 resolved** (Krazydad: clue
  digit = ½ the solved digit, one tone lighter, 5 pt frame over 1 pt rules). **G10 resolved**:
  nobody auto-tints a satisfied clue; Tatham flags **prefix-provable** violations immediately →
  `[decision]` **D9 amended** to the prefix rule. `[learning]` L4 (a stale mirror produced a wrong
  claim in the research doc — corrected). G3/G4/G7/G12 stay with E3, G6 with telemetry, G8 with
  the AT pass, G11 with the owner.
- **2026-10-01 (plan)** Research doc [skyscrapers.md](research/skyscrapers.md) written (four-stream
  deep research; its 4×4 / 5×5 all-clue ambiguity counts replicated in-session — `[measure]`
  below). Plan + this log opened; roadmap **Phase 11**, README row, Docs index. `[decision]` D1,
  D2, D3, D6, D7, D9, D12 proposed from the research; D4 (sizes) **open — owner**, with 5/6/7
  recommended and E3 named as the settling measurement; D5 (first non-9×9 daily standard)
  proposed; D8, D11 inherited from Kakuro (owner rules); D10 applied. `[gap]` G1–G12 opened from
  the research's gaps table. `[learning]` L1–L3 seeded. Owner picked Skyscrapers as the fifth
  type earlier the same day ("i think we decided skyscraper").

## Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Display name **Skyscrapers**, subtitle **Towers**, engine/slug **`skyscrapers`**; the title is **one constant** with **"Towers" wired as the fallback title** (the Kakuro / "Cross Sums" pattern); no publisher affiliation implied anywhere. The *technique* name "Skyscraper" (Sudoku single-digit pattern, HoDoKu) is **reserved**: if the HumanSolver ever gains it, it is named "Skyscraper (fish)" or namespaced, never the bare word | Research §1: invented 1992 by Masanori Natsuhara (Sekai Bunka-sha's *Puzzler*), not Nikoli; every publisher uses the bare generic name; the only U.S. filing found (1997, a 3D game) was abandoned in 1998. "Towers" is Tatham's name and a ready alias. Live registers were not queried (G1). `STRATEGY_NAMES` in `deductions.ts` has no Skyscraper today, so the label is free | **Locked 2026-10-01** (G1 resolved — US/JP clear; EU/UK has a live singular "SKYSCRAPER" games-software mark, Inspired Gaming, exp. 2027-10-12, flagged not-to-be-renewed — the switch trigger). Professional read before any EU logo / paid use; not legal advice |
| D2 | **Interior N×N `grid` + `solution`**, plus **`clues: { top, bottom, left, right }`** — four length-N arrays, **0 = blank**. Display is (N+2)×(N+2) with a four-sided gutter (the Kakuro gutter generalised from top+left). Daily storage: **clues ride the existing `cages` jsonb** as `StoredSkyscraperClue { side, index, count }[]`, with `variant` gating every reader — the Keisan/Kakuro rule (L2 there). Alternative recorded: a nullable `clues` jsonb column (additive migration, read as the cleaner model) | Keeps `grid.length === N` everywhere the codebase keys on it (`DailySize`, `PROFILE`, board `config.size`). The jsonb column is already a `variant`-discriminated grab-bag (Killer cages, Keisan cages, Kakuro runs) and reusing it has worked twice with no migration; the cost is a misnamed column holding edge clues. The column alternative costs one additive migration and buys honesty — the owner's call | **Proposed — owner may veto the column reuse**; applied in V1 (types) / R1 (storage) |
| D3 | **No givens at any published tier.** `grid` keeps the slot (all zeros) so Tatham-style fixtures and any future "givens" lever round-trip; the generator never emits givens in v1 | Research §1: interior givens are permitted by Tatham and "rarely, thematically" by GM Puzzles but are not the commercial daily norm; the research's generator pipeline removes *clues*, not cells | Proposed 2026-10-01 (research) |
| D4 | **Three sizes, chosen for Skyscrapers (D11):** mini **5×5** (alternative 4×4), standard **6×6**, large **7×7** (alternative 9×9). **Settled by E3's measurement**, not by inheritance: tier reachability at guess count 0 and per-tier yield at 4/5/6/7/9; line-filter + uniqueness wall time at 7 vs 9. 4×4 may survive as a tutorial board, 9×9 as a weekly special | Research §5: 6×6 is in every catalogue and the only size Tatham gives the full ladder; 4×4 degenerates above Easy (Tatham ships only 4×4 Easy, Puzzle Baron skips it); 5×5 is the real entry point and has an attested Hard; 7×7 is Conceptis's capstone with 5,040-permutation lines; 9×9 is a weekly special everywhere, 362,880 permutations, Tatham's performance warning. Board footprint: 7×7 + gutter = 9 tracks (a 9×9 Sudoku's), 9×9 + gutter = 11 (new phone-width risk) | **Open — owner** (recommendation on the table; E3 produces the numbers) |
| D5 | **The first non-9×9 daily standard.** With a 6×6 standard, `DailySize` widens (5, and 6 as a standard), the standard roll becomes a **5-rung bijection** at 5 types, `slotLabel` shows the size where it is not 9×9, and the "standard = 9×9" copy in the daily plan / roadmap / UI is amended | D4 + D11: a per-type standard size was the rule's intent; Kakuro happened to keep 9. `isEligible` already keys on `SIZES[variant].standard`, so the mechanism exists; the copy and the labels do not | Proposed 2026-10-01; G11 (design question for the owner) |
| D6 | **Every published tier is logic-only.** Easy = rungs 0–4 (clue N / clue 1, facing sum, position bound, nearly-filled clue, Latin singles) · Medium = + rung 5 (clue-2 patterns, reachability) · Hard = + rungs 6–7 (per-line permutation filtering, Latin pairs/triples) · Expert = + rung 8 (fish on rows × columns, two-line clue interactions) · Extreme = + rung 9 (bounded bivalue forcing chains). **Rung 10 (bifurcation) is a reject, never a tier.** Guess count 0; copy says "solvable by logic alone" | Research §2–§3: only Tatham ships a guessing tier ("Unreasonable"); GM Puzzles, Brainbashers, Puzzle Baron, puzzlemix all say "no guessing"; Tatham's own Easy/Hard/Extreme map onto rungs 0–4 / 6–7 / 8–9. The 5–7 ordering is the research's proposal (G7) | Proposed 2026-10-01 (research); tier cuts calibrated in E5 |
| D7 | Difficulty label assigned by the **classifier post-generation**; the generator's clue-removal order and target only *bias* | Research §3 (krnsk0: random valid puzzles need backtracking, published ones fall to propagation); Kakuro D8 precedent | Locked 2026-10-01 |
| D8 | **Visual first, simplest → hardest** (Kakuro D12): V0 looks-only board → V1 types + fixtures → V2 board → V3 PDF → E1 exact solver (Hint) → E2 classifier (badge, technique hints) → E3 yield spike → E4 generator → E5 tiers + pickers + hub card → R1 daily. Deep link from V2; hub card at E5; the owner may reorder (Kakuro pulled E1 ahead of V3) | Owner rule, 2026-09-11 (Kakuro), amended 2026-09-30 with V0 — inherited unchanged | Locked (inherited) |
| D9 | **Clue UX + a11y:** four-sided gutter of plain digits (no arrows); a clue turns the error colour as soon as its violation is **provable from the filled prefix** (Tatham's `check_errors` rule — count already over the clue, tallest seen with the count short, or count reached before the tallest; O(N), zero false positives), *not* only on a complete line; "satisfied" is an opt-in muted state (off by default — none of five players auto-tints); a manual **"mark clue done"** toggle ships in V2 (click / Enter on the clue), **undo-able and persisted** with the board, drawn **error > done > normal**; a "which towers this clue sees" highlight on focus is a later teaching aid. WAI-ARIA grid of (N+2)×(N+2): gutter cells `role="gridcell"` + `aria-readonly` with names spelling direction and state ("Clue 3, looking down from the top of column 2, open"); corners hidden; play-cell names carry the two clues that look at them; roving tabindex over play cells with a "jump to clues" key; `aria-invalid` on cells of a violated line; visible keyboard instructions | Research §6: Tatham draws no satisfied colour at all and errors only on complete lines; Brainbashers' click-to-grey "dealt with" is well liked and doubles as a progress tracker for AT users; Conceptis's auto-check is opt-in. **No accessible Skyscrapers implementation exists** — the pattern is Sudoku-derived (dokuel PR #192) and must be AT-tested (G8) | Proposed 2026-10-01 (research); **amended 2026-10-01 by G10** (prefix rule, draw priority, persisted toggle) |
| D10 | Roadmap **Phase 11**, engine-first like Phases 6 / 8 / 10 | Matches the sibling phases | Applied 2026-10-01 (this PR) |
| D11 | **Sizes are per puzzle type** — the smallest size that is genuinely interesting for *this* puzzle, its standard, and a large; "mini" in menus and the daily means "this type's smallest size" | Owner, 2026-09-11 (Kakuro log D11). Skyscrapers is the second type built under it; D4 is its application | Locked (inherited) |
| D12 | **Mini tiers:** the mini ships easy/medium/hard only if E3/E5 prove Hard separable from Medium at the chosen mini size at guess count 0; otherwise fewer tiers (Killer-4×4-easy-only precedent). Eligibility follows measurement | Research §5: Tatham ships 5×5 Hard but only 4×4 Easy; Puzzle Baron restricts 5×5 to Easy/Medium; only gridpuzzle claims five tiers at 4×4, where Hard would be "fewer clues", not deeper logic | Proposed 2026-10-01; measured in E3 / E5 |

## Gaps — research questions

| # | Question | What would resolve it | Blocks / degrades | Status |
|---|---|---|---|---|
| G1 | **Trademark clearance** for "Skyscrapers" / "Towers" as a puzzle-type label — live USPTO TSDR, EUIPO eSearch and J-PlatPat were **not** directly queried; the one U.S. record (abandoned 1997 "SKYSCRAPER" game filing) came from a search snippet (Justia 403) | ~~A direct register check~~ **Answered** ([findings §G1](research/skyscrapers-research-gaps-findings.md)): USPTO TSDR, TMview (US/EM/GB/JP/WO) and EUIPO JSON queried — US clear (the 1997 filing died 1998-03-19), Japan clear (Konami SKYSCRAPER and oneA TOWERS expired), **EU/UK has a live singular "SKYSCRAPER" mark** (Inspired Gaming, cl. 9/28/41/42, "games software", exp. 2027-10-12, flagged not-to-be-renewed); no "SKYSCRAPERS" or live bare "TOWERS" mark anywhere relevant | D1 locked with "Towers" as the wired fallback | ✅ Resolved 2026-10-01 (strong on records; a professional read still owed before EU logo / paid use) |
| G2 | Is finding-another-solution **ASP-complete** for Skyscrapers? Iwamoto & Matsui's NP-completeness reduction (2016) would need checking for parsimony; no result exists | **Answered** ([findings §G2](research/skyscrapers-research-gaps-findings.md)): both NP-completeness proofs use givens; Haraguchi–Tanaka's reduction is solution-bijective but from NAE-SAT (trivial ASP), so no ASP result; **with givens the puzzle is ASP-complete** via Latin-square completion (Colbourn–Colbourn–Stinson 1984); **clue-only ASP and #P are open**. Iwamoto–Matsui full text unobtainable | Nothing — count to 2, as Sudoku/Kakuro do | ✅ Resolved 2026-10-01 (open in theory, closed in practice) |
| G3 | **Per-tier generation yield** and **clue survival**: no source publishes how many of the 4N clues survive uniqueness-preserving removal per size, nor the fraction of attempts that land at each tier; Tatham's retry loop is unbounded; the research's own greedy-removal run did not complete | E3's spike ((b) clue survival, (c) tier reachability over ≥ 200 fills per N), then E4/E5 production logging | E3 (designs the generator's budget), E5 (bands) | Open — E3 measures |
| G4 | **All-clue ambiguity at N ≥ 6.** Measured exactly at 4×4 (35.42%) and 5×5 (57.61%); 6×6 has 812,851,200 Latin squares so sampling is required; the trend above 5 is unknown | E3 (a): ≥ 1,000 unbiased fills per N at 6/7/9 (shuffle rows, columns, symbols — no cyclic-shift sampler) | E4's reject-vs-repair choice; the fill budget at the standard size | Open — E3 measures |
| G5 | **Minimum clue count** for uniqueness per N (no givens). A circulating "1 clue can suffice" snippet is unsourced and internally inconsistent (a single clue cannot determine a Latin square for N ≥ 3) | **Narrowed** ([findings §G5](research/skyscrapers-research-gaps-findings.md)): Nakamura 2016 conjectures **exactly N−1** (≤ N−1 proven by construction; not ≤ N−2 verified to N = 8, slides only); measured exactly here at 4×4 — **3 clues suffice, no 2-clue subset determines any square**; 208/142/22 squares need 3/4/5, 204 undetermined by all 16. E3 (e) records the minimum *surviving* count per size against N−1 | E5 Extreme bias (floor ≈ N−1 kept clues) | 🟡 Narrowed 2026-10-01; E3 measures survival |
| G6 | **Human solve-time baselines** per size × tier for `PROFILE` floors and bot times. Public data: GM Puzzles' per-puzzle standards (very hard 6×6: 9:00 / 18:00 / 36:00 GM / Master / Expert), puzzle-skyscrapers.com hall-of-fame fastest small Easy grids ≈ 3.4–4.5 s; no population distributions anywhere | Rule adopted from Kakuro G2: floors from **cell count**, well below record pace (mini ≈ 2 s or cadence-based); tune from own telemetry after R1 | R1 floors (estimates, flagged in JSDoc) | 🟡 Resolved as a rule; numbers pending telemetry |
| G7 | **Rung ordering 5–7** (clue-2 patterns vs per-line permutation filtering vs Latin subsets) is the research's proposal; no published ladder exists beyond Conceptis's basic/advanced grouping and Tatham's four tiers. Also: how often fish / chains are *needed* in a 6×6 Hard–Extreme corpus is unmeasured — are Expert and Extreme reachable at 6×6? | E2's technique histograms on E3/E4 corpora; E5's gate that T4 and T5 are populated at the standard size | D6 tier cuts; D4 (whether 6×6 can be the standard) | Open — E2 / E3 / E5 measure |
| G8 | **Screen-reader behaviour** of a four-sided read-only gutter — no accessible Skyscrapers exists; the ARIA grid pattern is Sudoku-derived (dokuel PR #192, Higley, Roselli) | An NVDA / JAWS / VoiceOver pass over V2's board; adjust the clue naming and the "jump to clues" key from what is heard | V2 (degraded), R1 (launch gate) | Open — owed by R1 |
| G9 | **Print specs** — no publisher documents gutter spacing or border weights numerically; the Krazydad PDF was not rendered during research | **Answered** ([findings §G9](research/skyscrapers-research-gaps-findings.md)): Krazydad measured — clue digit **0.33 × cell = ½ the solved digit**, bold, one tone lighter (#444), ~0.2 cell clear of a **5 pt frame over 1 pt grey rules**, no arrows, one puzzle per A4 page, answers 3 × 4 without clues; championship booklets: same font as digits, ~0.5 cell standoff, frame 3.75–6.7× the inner rule, no arrows | V3 spec updated | ✅ Resolved 2026-10-01 |
| G10 | Should **satisfied clues auto-tint**? Conceptis/Brainbashers players were not inspected in detail; Tatham never does it | **Answered** ([findings §G10](research/skyscrapers-research-gaps-findings.md)): none of Tatham, Brainbashers, puzzle-skyscrapers.com, Conceptis, gridpuzzle auto-tints a satisfied clue; three have a manual click-to-grey "done" (Tatham's is undo-able with `COL_DONE`); violations are flagged on a full line (puzzle-skyscrapers) or **immediately when prefix-provable** (Tatham) | D9 amended | ✅ Resolved 2026-10-01 |
| G11 | **The first non-9×9 daily standard** (D5): does a 6×6 standard slot need its own copy, label, leaderboard framing, or bot-time model? Does "standard" still mean anything when sizes are per type? | Owner's design call before R1; grep every "9×9" in daily copy | R1 | Open — owner |
| G12 | **Mini tier separability** at the chosen mini size (5×5 Hard attested by Tatham; 4×4 not) — and whether the mini should carry three tiers at all | E3 (c) per-tier yield with distinct hardest-rung signatures at guess count 0 | D4, D12, R1 eligibility | Open — E3 measures |

## Bugs

| # | Found | Slice | Symptom | Cause | Fix |
|---|---|---|---|---|---|
| — | — | — | none yet | — | — |

## Learnings

| # | Rule | Came from |
|---|---|---|
| L1 | **Reuse a Latin technique only after checking the house property it rests on — and write the answer down.** Kakuro needed a `required` guard because a run need not contain every digit; Skyscrapers rows and columns are full permutations, so hidden singles / pairs / fish are sound unchanged. E2 asserts this in a test so the question is answered on record rather than re-asked per technique | Plan authoring, 2026-10-01 (Kakuro L12 applied in reverse) |
| L2 | **Put display-coordinate helpers in the engine's types module from day one when two consumers are already in the plan.** Kakuro's clue picture lived in board code until the PDF became a second consumer and had to move (its V3 step-log); Skyscrapers' gutter indexing has the board *and* the PDF as known consumers before V0 | Kakuro V3 step-log, applied 2026-10-01 |
| L4 | **Check a source mirror's freshness before quoting it as the source.** The research doc read Tatham's colour enum from a stale GitHub mirror (`ghewgill/puzzles`) that lacked `COL_DONE`, and inferred "violated only on a completed line"; the current `towers.c` has the done colour and flags prefix-provable violations immediately. Quote the upstream or a dated release, and say which | G10, 2026-10-01 |
| L3 | **A measured number from a research pass is "replicated" only when the repo can reproduce it.** The 4×4 / 5×5 ambiguity counts were replicated once in-session with a throwaway script; E1 turns them into tests so the claim survives the session that made it | Research banner, 2026-10-01 |

## Measurements

| Date | Commit | What | Numbers |
|---|---|---|---|
| 2026-10-01 | plan (no code) | **Minimum clue count at 4×4 (G5)** — every non-empty subset of the 16 edge clues (65,535) against all 576 Latin squares; a square is "determined" by a subset if no other square shares its masked clue vector; throwaway Node script, 9.7 s | **Smallest determining subset: 3 clues** (416 of 560 three-clue subsets determine ≥ 1 square); **no 2-clue subset determines any square**. Fewest clues per square: 3 → 208 squares, 4 → 142, 5 → 22, undetermined by all 16 → 204. Consistent with Nakamura's N−1 conjecture |
| 2026-10-01 | plan (no code) | **All-clue ambiguity** — exhaustive enumeration of every Latin square at N = 4 and 5, grouping by the full 4N-clue signature; the research's own measurement, replicated independently in-session with a second throwaway script (Node, 1.9 s total) | **4×4:** 576 squares → 438 signatures; **204 (35.42%) not unique**; multiplicities {1: 372, 2: 34, 4: 28, 6: 4}. **5×5:** 161,280 squares → 102,398 signatures; **92,912 (57.61%) not unique**; multiplicities up to 20 (4 signatures shared by 20 squares). N ≥ 6 unmeasured (G4) |
