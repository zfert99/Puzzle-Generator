# Hint Agent: Plain English Pseudocode

Companion to [`agent.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/agent.ts).

## What it does

Given one grid, asks Claude for **one** hint: a technique name and the cells it acts on, never
the digit. The model gets the two hint tools and is told to call `list_available_deductions`
before answering. Run it with `npm run hint:agent -- <81-digit grid>` (defaults to
`DEFAULT_PUZZLE`); `HINT_MODEL` overrides the model.

## The contract lives in two places

- `SYSTEM_PROMPT` — one step max, name the strategy, never state the value, refuse rather than
  guess, prefer the simplest technique. **This prompt is what the eval measures.** Changing it
  changes the number, so treat it as versioned alongside the results.
- `HintResponseSchema` (Zod) — `{ hint: { strategy, cells, explanation } | null, reason }`.
  Requested via `output_config.format` so the final turn is always parseable JSON. Narrow on
  purpose: the harness grades structure, not prose.

## Why a manual loop, not the SDK tool runner

The tools come from an MCP client (`HintToolClient`), and the harness needs the tool-call
trace — *did it consult the oracle?* — not just the final message. A hand-written loop gives
both without a beta dependency.

## runHintAgent(options) → HintRun

```text
client = options.client ?? new Anthropic()          // tests inject a scripted fake
tools  = options.tools  ?? connectHintServer(grid)   // tests inject the in-process client
messages = [user: "I am stuck. What is one thing I can do next? Do not tell me the answer."]
REPEAT up to maxTurns (default 6):
    response = messages.create({ model, system, tools, messages, output_config: zod format })
    accumulate usage
    IF stop_reason ≠ tool_use: BREAK
    append assistant content
    FOR each tool_use block: record name; call tool (errors → is_error result)
    append one user message holding ALL tool results
FINALLY close tools if we opened them
RETURN { grid, model, response: parseHint(text), rawText, toolCalls, stopReason, usage }
```

`parseHint` is lenient: a final message that is not schema-valid JSON becomes `response: null`
rather than a crash, so one bad turn is a graded failure, not a lost eval run.

## createClient()

Identity-linked keys from the Console (the default key type since mid-2026) reject any request
that does not carry an `anthropic-workspace-id` header. The SDK only reads
`ANTHROPIC_WORKSPACE_ID` on its identity-federation path, so for a plain API key the header is
set via `defaultHeaders` here. Export both:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

An ordinary key without the workspace variable still works unchanged.

## Deliberate omissions

- **No refusal fallbacks.** The Claude API skill recommends `fallbacks` by default on Opus 5;
  a Sudoku hint cannot trip a safety classifier, and one model per run keeps the eval number
  attributable to one model.
- **No forced `tool_choice`.** Forced tool use is rejected on some current models; the prompt
  instruction plus the `calledOracle` metric covers it.
