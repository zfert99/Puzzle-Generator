# Hint Agent — MCP server, agent, eval harness

> **Status (September 2, 2026):** All four pieces done. The full 52-state eval ran live on
> `claude-opus-5` (raw report committed under `src/features/hint-agent/eval-results/`), and the
> writeup below carries the numbers. Remaining: publish the writeup as a devlog (Build Log
> rule), and — as a follow-up, not this weekend — add a singles-free state population so the
> elimination techniques are actually exercised (see Limits).

## Background

`HumanSolver` (`src/features/engine/human-solver.ts`) is a logical-deduction solver with twelve
techniques from Naked Single to AIC. It is an *oracle*: for any grid it can say exactly which
techniques apply. That is the thing most people building "AI tutor" demos do not have — they
can prompt a model to give hints, but they cannot grade the hints. This build turns the solver
into a tool an agent calls, and into the grader that scores what the agent says.

The scope was cut deliberately to one weekend and four pieces:

1. **MCP server** exposing the solver — `src/features/hint-agent/mcp-server.ts`
2. **Agent** that gives one hint by calling it — `agent.ts`
3. **Eval harness** scoring every hint against the oracle — `eval.ts`, `eval-states.ts`,
   `eval-grade.ts`
4. **Writeup** — this doc's "Build log" section, to be published as a devlog once numbers exist

Explicit cut list: puzzle generation through tools, session state, move application,
before/after intervention, any UI, public demo.

Related: [`deductions.md`](../src/features/engine/deductions.md) (the enumerator that made
this possible), the per-file docs under `src/features/hint-agent/*.md`, and AGENTS.md's
Build Log rule for where the writeup publishes.

## Steps

### Step 0 — Check: does `HumanSolver` enumerate? ✅

**Process.** Read `solve()`. It is a stepper: cheapest-first, apply the first technique that
fires, restart. Each `apply*` mutates the solver and returns a boolean.

**Learning.** The spec said "if it's a stepper this becomes two weekends". It didn't: the
enumeration wrapper is ~150 lines. Clone the solver (grid *and* candidate bitmasks), run each
strategy on its own clone, diff the bitmasks, label the diff. Singles are scanned directly so
every one is reported, not just the first. Landed as `src/features/engine/deductions.ts` with a
ground-truth test: at every step of a walk on easy/medium/hard/expert, every placement equals
the solution digit and no elimination removes it.

**Blocker.** None. One design call: elimination techniques are reported once per strategy with
the union of every instance found (the strategy functions apply all instances in one call), so
the grader's validity check is a subset test rather than an exact match.

### Step 1 — MCP server ✅

**Process.** `@modelcontextprotocol/sdk` 1.30 (confirmed on npm before install), stdio
transport, two tools, one hardcoded puzzle (`DEFAULT_PUZZLE`, a frozen `hard` grid). Grid can be
overridden by `HINT_GRID` so the harness can point it at any state. Registered in `.mcp.json`
as `sudoku-hint`. Verified two ways: an in-memory transport test, and a raw JSON-RPC
`initialize` + `tools/call` over the real stdio process.

**Learning.** Keep the tool bodies (`hint-tools.ts`) separate from the transport. The server,
the in-process test client and the grader all call the same functions, so what the model saw
and what the grader scored are one code path.

**Blocker.** None. "Done when Claude Code answers from your solver" requires restarting Claude
Code so it picks up `.mcp.json` — not verified inside the build session.

### Step 2 — Agent ✅

**Process.** Manual tool loop on `@anthropic-ai/sdk` 0.123 with `output_config.format` (Zod
schema) so the answer is always `{ hint: { strategy, cells, explanation } | null, reason }`.
Tools arrive through a `HintToolClient` interface, either the spawned MCP server or the
in-process table; the loop cannot tell which. Tests script the API at the boundary (first turn
asks for the deduction list, second answers) and assert the tool result is fed back correctly.

**Learning.** The system prompt *is* the thing under test. It is exported as a constant and
should be treated as versioned with the eval results.

**Blockers.** (1) No credentials in the build environment; the CLI was run to the SDK's
"could not resolve authentication method" error to prove the wiring, and the owner ran it live.
(2) The Console's default key type is now *identity-linked* and rejects requests without an
`anthropic-workspace-id` header. The SDK only reads `ANTHROPIC_WORKSPACE_ID` on its federation
path, so `createClient()` sets the header itself when that variable is present.
(3) An open question going in — does `output_config.format` coexist with tool use in one
request? — was answered yes by the first live call; no fallback needed.

### Step 3 — Eval harness ✅

**Process.** 52 seeded states: 40 sampled along solve walks (10 per difficulty), 12 with
*nothing* available (clues dug out of a puzzle until the oracle is empty). Four numbers —
validity, label accuracy, leak, refusal accuracy — plus the two failure counts behind them and
two sanity rates (parsed, called the oracle). Full report JSON written to
`src/features/hint-agent/eval-results/`.

**Learning.** The empty states are the cheap part nobody has. Digging clues out until
`listDeductions` returns `[]` took ten lines because the oracle exists.

**Blocker.** Same as Step 2. Run live the same day: 5-state smoke, then the full 52.

### Step 4 — Writeup ✅ (drafted here; devlog publish pending)

**Process.** Numbers filled from `eval-results/2026-09-02T17-24-42-536Z-claude-opus-5.json`.
Before quoting them, the raw runs were read for what the grader cannot see: the twelve refusal
reasons all cite the tool result ("the deduction engine returned no available steps") rather
than the model's own reading of the candidates, and the 37 explanations the digit-word regex
flagged are all the phrase "one candidate" — not leaks.

**Learning.** A perfect score is a finding about the *eval*, not just the model. See Limits.

**Next.** Publish per the Build Log rule (Biscuit-Website
`src/content/log/sudoku-hint-agent-eval.mdx`).

## Build log (draft)

### What I set out to do

Turn the Sudoku engine's human solver into something an agent can call, have the agent give
one honest hint, and — the part that matters — *measure* whether the hints are right, using the
solver as ground truth.

### What surprised me

- **The solver was a stepper, not an enumerator.** I expected this to double the work. It
  didn't; cloning the solver per strategy and diffing candidate bitmasks is a small wrapper,
  and the bitmask representation made the diff trivial.
- **States with nothing available are the interesting half of the eval.** On a normal position
  the model can hardly go wrong: the tool hands it a list. On an empty list it still has the
  full candidate table in front of it and every incentive to be helpful. That is where an agent
  invents a move.
- **`StdioClientTransport`'s `env` replaces the environment.** Without spreading the default
  environment first the child has no `PATH` and dies silently. Half an hour.

### The numbers

`claude-opus-5`, default effort, one run of the 52-state set, September 2, 2026:

| Metric | Value | n |
|---|---|---|
| validity (named cells are one real deduction) | 100% | 40 |
| strategy label correct | 100% | 40 |
| leak (stated the digit for a placement) | 0% | 40 |
| refusal on empty states | 100%, 0 invented hints | 12 |
| unnecessary refusals on solvable states | 0 | 40 |
| parsed / called the oracle | 100% / 100% | 52 |

Cost: 255K input + 7.8K output tokens, about $1.50. Every run called both tools, always
`get_grid_state` first and then `list_available_deductions`, and every hint named exactly one
cell.

What the model actually said, on a solvable state: *"Every other digit in that cell's row,
column, and box has already been used, so only one candidate survives there."* And on an empty
one: *"I checked the position with the deduction engine and it returned no available steps …
Since I won't invent a step that isn't actually supported, I can't give you a nudge here;
please double-check that the grid was entered correctly."*

### Deviations from the spec

- Structured output (`output_config.format`) instead of free text, so grading is on structure.
- The MCP server takes its grid from `HINT_GRID` rather than being purely hardcoded, so one
  server design serves both the demo and the harness. Still no session state or move tool.
- The agent spawns a real MCP server per run rather than calling the tools in-process. Slower,
  but the artifact is then honestly "an agent talking to an MCP server".

### Limits

- **The number measures this prompt and this model, not models in general.** `SYSTEM_PROMPT`
  is part of the experiment; change it and the number is a different experiment.
- **Ceiling effect — the solvable half of the set is too easy.** Every one of the 40 sampled
  positions had a single available, and the prompt says prefer the simplest technique, so all
  40 hints were Naked or Hidden Singles. The ten elimination techniques (pairs, pointing, fish,
  wings, ALS, AIC) were never asked for. What 100% shows is that the agent *follows the tool*:
  it reads the list, picks the first entry, and does not editorialise. It does not show the
  agent can explain an X-Wing. The fix is a third population — positions where the oracle
  returns *no* singles — which is a filter on the existing walk, not a new mechanism.
- "No deduction available" means none of the twelve implemented techniques. A human might see
  something the solver does not (uniqueness arguments, forcing chains beyond AIC).
- The leak check is a regex heuristic on the explanation: it misses digits written as words
  and can flag innocent counts.
- Elimination techniques are validated as a subset of one strategy's union of instances, so a
  hint mixing cells from two X-Wings would pass validity.
- n = 52 from four generated puzzles plus twelve dug grids. Enough to see a failure mode, not
  enough for a second decimal place.
