# Kakuro PDF Preview Script (`preview-kakuro.ts`)

A **dev-only** CLI script (not imported by the app) that writes a Kakuro booklet to a local PDF
so the rendering — clue gutter, shaded blocks, diagonals, down/across sums, answer digits — can
be eyeballed without booting the app or hitting `/api/generate`.

## Run

```bash
npx tsx src/features/pdf-generation/preview-kakuro.ts [outfile.pdf]
```

- `outfile.pdf` — output path (default `kakuro-preview.pdf`).

## What it does

1. Takes the served fixtures (`KAKURO_FIXTURES`: the full easy→extreme ladder at 7×7 and 9×9).
   There is no count argument because, until the generator lands (plan slice E5), the fixtures
   are the only Kakuro puzzles there are — the script will take a count once `generateKakuroBatch`
   exists.
2. Renders them with `generateKakuroPDF` and writes the bytes to `outfile`, logging the byte count.

`Docs/samples/kakuro-sample.pdf` is this script's output. `console.log`/`console.error` here are
legitimate CLI output, not business-logic logging (AGENTS.md §5 applies to the app runtime, not
dev scripts). No test is colocated — it's a manual visual-check tool, not app logic.
