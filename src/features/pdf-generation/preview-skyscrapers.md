# Skyscrapers PDF Preview Script (`preview-skyscrapers.ts`)

A **dev-only** CLI script (not imported by the app) that writes a Skyscrapers booklet to a local
PDF so the rendering — the four-sided clue gutter, the framed play area, the clue and answer digit
sizes — can be eyeballed without booting the app or hitting `/api/generate`.

## Run

```bash
npx tsx src/features/pdf-generation/preview-skyscrapers.ts [outfile.pdf]
```

- `outfile.pdf` — output path (default `skyscrapers-preview.pdf`).

## What it does

1. Takes the served fixtures (`SKYSCRAPERS_FIXTURES`: one per planned size, 5×5 / 6×6 / 7×7, all
   `'unrated'`). There is no count argument because, until the generator lands (plan slice E5),
   the fixtures are the only Skyscrapers puzzles there are — the script will take a count once
   `generateSkyscrapersBatch` exists.
2. Renders them with `generateSkyscrapersPDF` and writes the bytes to `outfile`, logging the byte
   count.

`Docs/samples/skyscrapers-sample.pdf` is this script's output. `console.log`/`console.error` here
are legitimate CLI output, not business-logic logging (AGENTS.md §5 applies to the app runtime,
not dev scripts). No test is colocated — it's a manual visual-check tool, not app logic.
