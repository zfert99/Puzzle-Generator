# Samples

Generated example artifacts, for reference.

## `killer-sudoku-sample.pdf`

A sample Killer Sudoku booklet — two puzzles each of easy / medium / hard, followed by the
answer pages. Each puzzle shows the empty grid (Killer has no givens), dashed cage outlines, and
the cage sum in each cage's corner.

Regenerate (writes a fresh random booklet — the second arg is puzzles per difficulty, default 2):

```bash
npx tsx src/features/pdf-generation/preview-killer.ts Docs/samples/killer-sudoku-sample.pdf 2
```

The rendering comes from `drawKillerGrid` / `generateKillerPDF` in
[pdf.service.ts](../../src/features/pdf-generation/services/pdf.service.ts). You can also generate
Killer PDFs from the browser on `/generate` (the Sudoku/Killer toggle).

## `keisan-sample.pdf`

A sample Keisan (Calcudoku) booklet — two puzzles each of the full **9×9 ladder** (easy / medium /
hard / expert / extreme), followed by the answer pages. Each puzzle shows the empty grid (no givens),
dashed cage outlines, and the target + operator in each cage's corner (`12+`, `3÷`, …). Expert boards
need a hypothesis (Nishio) step; Extreme boards need many.

Regenerate (second arg is puzzles per difficulty, default 2; add `--mystery` to hide the operators —
No-Op mode):

```bash
npx tsx src/features/pdf-generation/preview-calc.ts Docs/samples/keisan-sample.pdf 2
```

The rendering comes from `drawCalcGrid` / `generateCalcPDF` in
[pdf.service.ts](../../src/features/pdf-generation/services/pdf.service.ts). You can also generate
Keisan PDFs from the browser on `/generate` (the Keisan toggle, with a 🔮 Mystery switch).

## `keisan-mystery-sample.pdf`

The same 9×9 booklet with **Mystery / No-Op mode** on — the puzzle pages show only the target (no
operator), so the solver must deduce whether each cage is `+ − × ÷` as well as its digits. The
**answer pages reveal the operator** (`12+`, `3÷`, …) so the key doubles as a check on your deductions.
Two each of easy / medium / hard / expert / extreme, plus answers.

Regenerate:

```bash
npx tsx src/features/pdf-generation/preview-calc.ts Docs/samples/keisan-mystery-sample.pdf 2 --mystery
```
