# Eval Harness: Plain English Pseudocode

Companion to [`eval.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/eval.ts).

## Running it

```bash
npm run hint:eval            # full 52-state set
npm run hint:eval -- 5       # first 5 states, for a smoke run
HINT_MODEL=claude-sonnet-5 npm run hint:eval
```

Needs Anthropic credentials in the environment (`ANTHROPIC_API_KEY`, plus
`ANTHROPIC_WORKSPACE_ID` for an identity-linked Console key — see `agent.md`). Prints the `formatSummary` block and writes the full report — summary, per-state
grades, raw runs (including every tool call and the model's raw text), and the state set — to
`eval-results/<timestamp>-<model>.json`. Commit the JSON: it is the evidence behind any number
quoted in a writeup.

## runEval(options) → EvalReport

Concurrency is capped at 3 because each run spawns its own MCP server process and the aim is a
clean, attributable number, not throughput.

```text
states = options.states ?? buildEvalStates()
workers × concurrency, each:
    WHILE states remain: take next index
        run    = runHintAgent({ grid, model })          // spawns the MCP server for this grid
        oracle = reportDeductions(listDeductions(new HumanSolver(parseGrid(grid))))
        grades[index] = gradeRun(state, run, oracle)
        log one line to stderr
RETURN { model, startedAt, summary: summarize(grades), grades, runs, states }
```

The oracle is recomputed in-process from the grid string — the same function the server calls —
so the grader and the tool the model saw cannot disagree.
