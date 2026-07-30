# Shared Benchmark Log Writer (`benchmark-log.ts`)

All four benchmark scripts (`benchmark.ts`, `benchmark-human-solver.ts`, `benchmark-calc.ts`,
`benchmark-killer.ts`) append their results to one shared `benchmark-logs.md` table. This module owns
that append so the four scripts don't each carry a copy of the path, the markdown header, and the
create-if-missing logic.

## Why an exclusive-create write instead of `existsSync`

The obvious shape is "check whether the log exists, write the header if it doesn't, then append":

```ts
if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, HEADER);
fs.appendFileSync(logPath, rows);
```

That is a check-then-use race (CodeQL `js/file-system-race`, flagged high on PR #25). Two benchmark
scripts started together — easy to do, since the generation benchmarks run for minutes — can both
observe "missing", and the second `writeFileSync` truncates the rows the first one already wrote.

Writing the header with the `wx` flag collapses the check and the write into one atomic syscall: the
first caller creates the file, every later caller gets `EEXIST` and falls straight through to
appending. `EEXIST` is therefore the expected path and is swallowed; any other errno is a real
filesystem problem and rethrows rather than silently losing benchmark history.

## Pseudocode

```text
BENCHMARK_LOG_PATH = <this directory>/benchmark-logs.md

appendBenchmarkRows(rows):
    try to create BENCHMARK_LOG_PATH containing just the markdown table header,
        using exclusive-create so it fails rather than overwriting an existing log
    if that failed because the file already exists: carry on, that is the normal case
    if it failed for any other reason: rethrow — do not append into a broken state
    append every row to the file
    return the path (callers print it)
```

## Row format

Each row is a pre-formatted markdown table line the caller builds:

```text
| <ISO timestamp> | `<short commit>` | <benchmark label> | <avg> ms | <metric or N/A> |
```
