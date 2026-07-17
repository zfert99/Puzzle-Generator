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
