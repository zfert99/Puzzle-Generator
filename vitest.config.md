# Vitest Config (`vitest.config.ts`)

Plain-English notes on the test-runner configuration. Every option below exists for a
reason that is not obvious from the value itself — that reasoning is what this file records.

## `environment: 'node'` (global) + per-file jsdom pragma

**Why:** AGENTS.md Section 4 mandates Vitest over Jest, and requires the *global* environment
stay `node`. Running jsdom globally puts a browser `Request`/`Response` polyfill in scope, which
collides with the real Web APIs the Next.js App Router route-handler tests exercise — the route
tests then assert against the wrong `Request` implementation.

React component tests opt in individually with a `// @vitest-environment jsdom` pragma on the
first line of the file, rather than via `environmentMatchGlobs`. The pragma keeps the choice
visible in the file that needs it.

## `globals: true`

**Why:** Lets test files use `describe`/`it`/`expect` without importing them, matching the Jest-style
ergonomics the suite was written against. `@testing-library/jest-dom/vitest` (see `setupFiles`) also
expects a global `expect` to extend.

## `setupFiles: ['./vitest.setup.ts']`

Registers the `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeDisabled`, …). Safe to
load in the `node` environment — it only extends the matcher registry; the DOM matchers themselves
are exercised only by the jsdom-pragma component tests.

## `maxWorkers: '50%'` (August 2026)

**Why:** Vitest defaults to roughly one worker per logical CPU minus one. That is right for
IO-bound or light unit tests, and wrong here — a large share of this suite drives the *real* puzzle
generators, each saturating a core for its full duration. On a 12-core box that default is textbook
oversubscription, and it was the direct cause of the timeout flake described below (a test needing
<0.7s of CPU failing a 5s timeout).

Capping the pool attacks the amplification at its source rather than only raising the ceiling it
hits. Measured worst-observed durations, default workers (24 runs) vs capped (14 runs):

| Test | Default | Capped | Change |
| --- | --- | --- | --- |
| `hard leans on ×` | 4698ms | **1812ms** | −61% (while *doubling* its sample size) |
| `killer-sudoku` → extreme | 22033ms | 7382ms | −66% |
| `calc-sudoku` → Expert | 11492ms | 3118ms | −73% |
| `strategies/extreme` → solve-every | 29497ms | 15107ms | −49% |

**It costs nothing.** Total wall-clock was 14.9–19.4s capped vs 16–20s uncapped — fewer workers
doing less context-switching finish the same work in the same time. Tune this on p95 runtime and
flake rate if it is ever revisited; do not raise it back on intuition.

## `testTimeout: 30_000` (August 2026)

**Why:** Vitest's 5000ms default was too tight for this suite, and — this is the part worth
recording — **the cause was worker contention, not slow code.**

A large share of the suite drives the *real* generators (`generateSudoku`, `generateKillerSudoku`,
`generateCalcSudoku`) rather than fixtures, because the assertions are difficulty-calibration
checks that only mean something against genuinely generated boards. Each such test saturates a
core. With ~11 forked workers on a 12-core machine, several of them land on generator files at
once and every one of those tests stretches well past its isolated wall-clock time.

Measured on `calc-sudoku.test.ts`'s `hard leans on ×` test (14 × `generateCalcSudoku('hard',
{ gridSize: 6 })`):

| Measurement | Result |
| --- | --- |
| Isolated, 40 samples | min 157ms, p50 408ms, p90 572ms, **p99 673ms** |
| Full suite, typical run | 1914ms (4.3× its isolated time) |
| Full suite, bad run | **5738ms → "Test timed out in 5000ms"** (13×) |

So the test needed under 0.7s of actual CPU at the 99th percentile and still failed. That is a
scheduling artifact, not a regression — which is why the fix is a timeout floor and **not** a
weakened assertion. It failed roughly 10–15% of full-suite runs (reproduced twice in ~18 runs).

**Why global rather than per-test or engine-scoped:**

- The amplification is a property of *how the suite is scheduled*, so it applies to every
  generator-backed test equally. Annotating one test is whack-a-mole. At the 13× factor already
  observed, at least three other un-annotated tests cross 5s: `killer-sudoku.test.ts`'s
  `lands hard in its two-factor score band` (455ms isolated) and `keeps the medium/hard foothold
  bands apart` (591ms isolated), and `calc-sudoku.test.ts`'s `bands are disjoint per size`. They
  were never safer than the test that flaked — only luckier.
- The exposure is **not confined to `src/features/engine/**`**. `src/app/api/generate/route.test.ts`
  and `src/app/api/puzzle/route.test.ts` call the same generators (one measured 11036ms), so an
  engine-scoped rule would leave real cases out.
- Vitest has no glob-scoped `testTimeout`; scoping it would require splitting the config into
  `test.projects`. That is real config surface and it changes suite reporting — not worth it for
  a timeout value.
- A global floor also covers generator tests written *later*, which would otherwise each have to
  remember an explicit value.

**This is now the secondary defence, not the primary one.** `maxWorkers: '50%'` (above) removes most
of the amplification; the timeouts remain sized from the measured tails as belt-and-braces. Note the
tradeoff a large timeout carries: a 120s value is a weak hang detector, since a genuinely wedged
generator takes two minutes to surface. That is accepted only where the intrinsic tail justifies it.

**Why 30s and not 20s:** the floor was first set to 20s off the p99-673ms figure. Verification then
caught the same test at **4698ms** — worse than the 2992ms seen in the first batch, and only 4.3×
under a 20s floor, below the ≥5× rule below. Projecting instead from intrinsic work × observed
contention (673ms × 13 ≈ **8.7s**) rather than from any single observation, 20s left only ~2.3×.
30s keeps ≥6× on both figures. The lesson generalises: size these off *intrinsic p99 × contention
factor*, not off the worst run you happened to see.

**What it costs:** a genuinely hung test now surfaces in 30s instead of 5s. That is irrelevant for
a non-interactive suite that already carries deliberate 120s outliers.

**Interaction with existing per-test timeouts:** a per-test value wins over this floor, so the
explicit larger ones still apply — they cover tests that are *actually* heavy, not merely contended.

Verifying the fix over **30 consecutive full-suite runs** surfaced a **second, independent flake**
that the global floor could not fix precisely *because* a per-test value overrides it: the Keisan
`9×9 Extreme` test was seen at **35094ms** against its `30000`. Sizing that correctly needed the
generator's real distribution, not its average — measured idle over 30 samples, Extreme is p50
1663ms but max 11635ms (7× the median), and Expert is p50 152ms but max 1264ms (8.3×). Averages
were never the right basis for these timeouts. Three values were raised as a result:

| Test | Worst of 30 runs | Timeout | Headroom | Note |
| --- | --- | --- | --- | --- |
| `calc-sudoku.test.ts` → Extreme | 35094ms | `120_000` | 3.4× | **was `30000` — this failed** |
| `calc-logical-solver.test.ts` → T4-stuck 9×9 | 10378ms | `60_000` | 5.8× | was `30000` (only ~3×) |
| `calc-sudoku.test.ts` → Expert | 9897ms | `60_000` | 6.1× | was `30000` (only ~3×) |
| `strategies/extreme.test.ts` → solve-every | 25213ms | `120_000` | 4.8× | unchanged |
| `killer-sudoku.test.ts` → `extreme` | 23705ms | `120_000` | 5.1× | unchanged |
| `api/puzzle` → extreme 9×9 | 19022ms | `120_000` | 6.3× | unchanged |
| `api/generate` → Extreme Challenge | 16633ms | `120_000` | 7.2× | unchanged |
| `strategies/extreme.test.ts` → require-extreme | 7904ms | `120_000` | 15× | unchanged |
| `calc-sudoku.test.ts` → `hard leans on ×` | **1812ms** | `30_000` (floor) | **16.6×** | the original flake, post-cap |

The rule of thumb applied: **target ≥5× headroom over the worst observed run.** Two entries are
knowingly below it and accepted rather than escalated:

- `calc-sudoku.test.ts` → Extreme at 3.4×: the 35094ms reading was itself a compounded outlier
  (typical in-suite ~2000ms), and `120_000` matches the sibling Killer extreme precedent.
- `strategies/extreme.test.ts` → solve-every, whose worst grew to 29497ms across the post-fix runs
  (4.1× under its existing `120_000`). This is the **thinnest remaining margin in the suite** and
  the one to look at first if flake reappears. It was left alone because 120s is already this
  repo's ceiling idiom and raising a single test past it trades one risk for a slower CI timeout.

## `include: ['src/**/*.{test,spec}.{ts,tsx}']`

**Why:** Restricts discovery to colocated unit/integration tests under `src/`. AGENTS.md Section 4
requires strict colocation — tests live next to the source they validate — and reserves top-level
directories for Playwright E2E suites, which must not be picked up by Vitest.

## `resolve.alias: { '@': './src' }`

**Why:** Mirrors the `@/*` path alias in `tsconfig.json` so tests import through the same stable
module paths as application code, instead of deep relative chains (`../../../`). Vitest does not
read `tsconfig` paths on its own, so this has to be restated here.

## No explicit `jsx` option

**Why:** React 19 uses the automatic JSX runtime. Vitest's esbuild transform already picks up
`"jsx": "react-jsx"` from `tsconfig.json`, and Vitest 4 no longer types a `jsx` option on
`esbuild` — setting one would be both redundant and a type error.
