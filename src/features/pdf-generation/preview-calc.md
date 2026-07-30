# Keisan PDF Preview Script (`preview-calc.ts`)

A **dev-only** CLI script (not imported by the app) that generates a Keisan (Calcudoku) booklet to a
local PDF so the rendering — empty grid + dashed cages + target/operator labels — can be eyeballed
without booting the app or hitting `/api/generate`.

## Run

```bash
npx tsx src/features/pdf-generation/preview-calc.ts [outfile.pdf] [countPerDifficulty] [--mystery]
```

- `outfile.pdf` — output path (default `keisan-preview.pdf`).
- `countPerDifficulty` — how many of each difficulty to generate (default `2`).
- `--mystery` — No-Op / Mystery mode: hide the cage operators so each label shows only the target.

## What it does

1. Reads the args above.
2. Generates `count` each of easy/medium/hard/expert/extreme at **9×9** (the only size carrying the
   full 5-tier ladder — expert/extreme are 9×9-only) via `generateCalcBatch`.
3. Renders them with `generateCalcPDF` and writes the bytes to `outfile`, logging the byte count.

`console.log`/`console.error` here are legitimate CLI output, not business-logic logging (AGENTS.md
§5 applies to the app runtime, not dev scripts). No test is colocated — it's a manual visual-check
tool, not app logic.
