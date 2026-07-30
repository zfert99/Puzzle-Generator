# Killer PDF Preview Script (`preview-killer.ts`)

A **dev-only** CLI script (not imported by the app) that generates a Killer Sudoku booklet to a local
PDF so the rendering — empty grid + dashed cages + cage sums — can be eyeballed without booting the
app or hitting `/api/generate`.

## Run

```bash
npx tsx src/features/pdf-generation/preview-killer.ts [outfile.pdf] [countPerDifficulty]
```

- `outfile.pdf` — output path (default `killer-preview.pdf`).
- `countPerDifficulty` — how many of each difficulty to generate (default `2`).

## What it does

1. Reads the args above.
2. Generates `count` each of the full 9×9 ladder (easy/medium/hard/expert/extreme), then a **6×6**
   section (the beginner variant — digits 1–6, easy/medium/hard only) via `generateKillerBatch`.
3. Renders them with `generateKillerPDF` and writes the bytes to `outfile`, logging the byte count.

`console.log`/`console.error` here are legitimate CLI output, not business-logic logging (AGENTS.md
§5 applies to the app runtime, not dev scripts). No test is colocated — it's a manual visual-check
tool, not app logic.
