# KenKen — Implementation Plan

> **Status:** 📋 Planned (do not start without a fresh branch — Killer's branch is retired)
> **Research:** [kenken-engine-reference.md](research/kenken-engine-reference.md) ·
> [puzzle-grid-size-landscape.md](research/puzzle-grid-size-landscape.md)
> **Pattern source:** the Killer plans — this plan reuses their slice/gate discipline and,
> deliberately, large parts of their code.

KenKen (Calcudoku/Mathdoku): fill an N×N **Latin square** (1..N once per row and column —
**no boxes**) partitioned into cages, each showing a target and an operator (+, −, ×, ÷).
The KenKen inventor's company trademarked the name — the UI should ship under a neutral name
(**"MathCage"?** decide at K1; "Calcudoku" is the community generic) with KenKen used only
descriptively.

## 1. What the research locks in (before any code)

- **Sizes: 4×4 (entry), 5×5, 6×6 (standard), 7×7 — 9×9 optional later.** Latin-square-only
  means ANY N ≥ 3 works, including primes — that's the structural difference from box
  Sudoku and it unlocks 5 and 7. NYT ships 4×4/6×6 daily; grid-size research recommends
  exactly this ladder and warns off 16×16+ ("long but shallow"). Start with **4 and 6**
  (mirrors our mini infrastructure), add 5/7 in a follow-up slice, hold 9.
- **The duplicate-in-cage rule changes the math.** Digits MAY repeat in a cage if not
  sharing a row/column — so cage-combination tables are **multisets**, not the Killer
  digit-set tables. This is the single most common source of solver bugs (research's
  words) and the reason K1 exists as its own gated slice.
- **Operator difficulty ordering is ÷ < − < × < + (counterintuitive, measured by candidate
  count).** Two-cell ÷ and − cages have tiny candidate sets; big + cages are the ambiguous
  ones. Difficulty configs lean on this ordering, not "arithmetic complexity".
- **Operator set is a first-class difficulty axis**: SingleOp (+ only) → DualOp (+− or ×÷)
  → QuadOp (all four) → **No-Op/Mystery** (operator hidden — uniqueness must hold across
  every operator interpretation; true hard mode, deferred to the last slice).
- **Subtraction/division are two-cell cages only** (NYT/Shortz convention). Single-cell
  cages are free givens — same difficulty lever we tuned for Killer.
- **Techniques**: classic singles/pairs/X-wing carry over but on rows+columns only; the
  KenKen-specific tiers are prime factorization (×), line invariants (each line sums to
  N(N+1)/2 and multiplies to N! — the "Rule of 21 / Rule of 720" on 6×6), and cage-combo
  restriction (the E2 pattern transfers directly).
- **House rule override (same as Killer):** bitmask/MRV backtracking, NOT the research's
  DLX default (AGENTS.md §1). KSudoku proves a shared Killer/KenKen cage engine works; we
  already own most of it.

## 2. What we already have (reuse map)

| Existing asset | KenKen reuse |
|---|---|
| `cage-generator.ts` (region growing) | Directly — drop the no-repeat eligibility check (repeats are legal); keep `minSize`/`maxSize`/`maxSizeBias` levers |
| `cage-geometry.ts` + `CageOverlay` + PDF `drawKillerGrid` | Directly — the corner label renders `12+` / `3÷` instead of a bare sum |
| Bitmask exact-solver skeleton (`killer-solver.ts`) | Pattern — new `kenken-solver.ts` with row/col masks only (no box mask) + per-cage multiset-combo pruning |
| Logical-solver architecture (technique table, tiers, counts, openness, `disable`) | Pattern-copy — classic strategies constrained to rows/cols; KenKen technique rows added |
| Two-factor scoring + disjoint bands + recalibration protocol | Directly — same `raw × density` scorer, KenKen weights, bands measured fresh per size |
| Difficulty pipeline (shape gates → capped solve → necessity → band → budgeted verify) | Directly — proven twice now |
| Daily-board registry, board store variant plumbing, hub card | Registry rows + a `variant: 'kenken'`; the hub's KenKen card goes live |

## 3. Slices

### K1 — Multiset cage-combination tables + operator model

- `kenken-combinations.ts`: for each (op, target, cageSize, N) the candidate multisets and
  union/guaranteed masks. Multiset enumeration with per-shape repeat legality handled at
  the SOLVER (a combo is only placeable if repeats land in distinct rows/cols) — tables
  over-approximate, solver enforces. −/÷ restricted to size 2 by construction.
- Table sizes are bounded (N ≤ 9, targets ≤ 9! for ×) — precompute per N like the Killer
  tables; memoized excluding-variants included from day one (E1's lesson: memo or lose).
- **Gate:** exhaustive spot-tests against published examples (e.g. `6×` 4-cell → {1,1,2,3});
  table-size/perf budget documented.

### K2 — Exact solver + Latin-square generator

- Latin-square fill (trivial vs Sudoku fill — no boxes; keep `fillGrid` config-driven with
  a boxless config or a 10-line standalone).
- `kenken-solver.ts`: bitmask/MRV over rows+cols, cage pruning via K1 masks + a
  placement-time repeat check (same-row/col duplicate legality). Node budget from day one.
- Operator/target assignment on the solved grid (KSudoku's `setCageTarget` pattern):
  operator chosen per cage from the active operator SET (difficulty axis), target computed.
- **Gate:** uniqueness verify < 50 ms avg at 6×6 QuadOp shapes; fuzz vs brute force on 4×4.

### K3 — Logical solver + difficulty tiers

- Tier ladder (provisional, measured before locking): T1 givens/singles + two-cell ÷ and −
  cage resolution; T2 pairs + × prime-factorization cages; T3 line invariants (sum/product
  "rule of 21/720") + cage-combo restriction (E2's Hall-check pattern); T4 X-wing-class on
  rows/cols + multi-line invariants.
- Same solve-result instrumentation (counts, passes, openness) feeding the shared scorer.
- **Gate:** soundness fuzz vs K2 (0 mismatches); gradable share measured per size/op-set.

### K4 — Difficulty configs + generation

- Five-band product ladder built from the research's axes, e.g. easiest = 4×4 SingleOp(+),
  easy = 4×4 DualOp, medium = 6×6 DualOp, hard = 6×6 QuadOp, expert = 6×6/7×7 QuadOp with
  tight given/foothold budgets. **No-Op mode explicitly deferred** (needs
  uniqueness-across-interpretations verification — its own slice later).
- Shape gates (singles budget, two-cell-cage share, operator mix) + score bands placed on
  measured distributions per the recalibration protocol; stage-rate sweeps before
  end-to-end benchmarks (the Killer discipline, verbatim).
- **Gate:** every band ≤ 1 s avg generation, 0 fails in 20, bands disjoint per size.

### K5 — Surfaces

- `/play`: third variant toggle (Classic / Killer / KenKen), size + difficulty pickers;
  cage overlay labels show `target op`. Board store: `variant: 'kenken'`, cage-mate pencil
  stripping DISABLED for KenKen (repeats are legal!) — flag on the variant, not new logic.
- PDF: operator-aware corner labels; `/generate` section; sample booklet.
- Dailies: registry rows (`kenken4-easy` … `kenken6-expert` — exact set decided at K4) in
  a fourth picker section; per-board anti-cheat floors.
- Hub: the KenKen card goes live (deep link `/play?variant=kenken`); sticker moves per the
  established "newest thing wears new!" convention.
- **Gate:** full battery + in-browser verification, both themes, both sizes.

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Multiset tables explode at 9×9 × (× targets up to 362 880) | Ship 4/6 first; tables per-N lazy; × targets sparse — index by factorization, measure before 7/9 |
| 2 | Repeat-legality bugs (the research's #1 bug source) | Enforced at ONE place (solver placement check); fuzz 4×4 exhaustively vs brute force |
| 3 | Trademark ("KenKen") | Neutral product name decided at K1; research doc keeps the descriptive term |
| 4 | Difficulty bands compress at 4×4 (like 6×6 Killer) | Expected; measured cuts, honesty over ladder-padding |
| 5 | Cage-mate pencil stripping wrongly applied to KenKen | Variant-gated in `inputDigit`; regression test |

## 5. Definition of done (v1)

4×4 + 6×6 KenKen: unique, difficulty-banded (measured cuts), operator-set-aware, playable
on `/play` with cage overlay + operator labels, printable, in the daily registry, full test
battery green, mirrored docs synced, roadmap flipped.
