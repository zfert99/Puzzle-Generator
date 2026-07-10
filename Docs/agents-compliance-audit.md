# Codebase Audit — Compliance vs. AGENTS.md

> Full file-by-file compliance audit of the codebase against the rules in
> `AGENTS.md` and the research set in `Docs/research/`. Generated as a living
> reference; the remediation plan at the end is tracked to completion.

## Context

A complete, thorough, file-by-file audit was requested against the rules in
`AGENTS.md`. This document is the deliverable: a findings report plus an ordered
remediation plan.

**Method:** every source file under `src/`, the docs tree, config, and
`git status` were read, then cross-checked against the on-disk `AGENTS.md`
(126 lines, revised July 2026 — the authoritative version).

**Overall verdict:** Architecture (Section 1) and structured logging (Section 5)
are strongly compliant. The material gaps cluster in testing tooling (Section 4),
a security info-leak (Section 6), engine representation (Section 1), and
documentation sync (Sections 2 and 7).

## File-by-File Coverage

Legend: compliant (OK) · minor issue (WARN) · violation (FAIL)

### Application / routing (`src/app/`, `src/`)

| File | Status | Notes |
|---|---|---|
| `src/app/page.tsx` | OK | Pure Server Component, delegates to feature. |
| `src/app/layout.tsx` | OK | Routing/layout only. Has `layout.md`. |
| `src/app/api/generate/route.ts` | FAIL | Leaks `err.stack` + `details` to client (L121-125). Otherwise strong validation + `runtime='nodejs'`. |
| `src/instrumentation.ts` | FAIL | Missing `onRequestError()` (Section 5). No `.md` mirror. |
| `src/lib/logger.ts` | WARN | Pino wired correctly; no `.md` mirror. |

### Engine (`src/features/engine/`)

| File | Status | Notes |
|---|---|---|
| `human-solver.ts` | FAIL | Candidates as `Set<number>[][]` (L16,43), not the mandated bitmask/popcount MRV (Section 1). Only 1 JSDoc block / 405 lines. |
| `sudoku.ts` | WARN | Good JSDoc; no colocated test. |
| `grid-utils.ts`, `diggers.ts` | WARN | No colocated tests. |
| `strategies/basic.ts`, `advanced.ts`, `extreme.ts` | WARN | Performance-critical, no tests. |
| `services/generation.service.ts` | WARN | Sparse JSDoc; no test. |
| `benchmarks/benchmark-human-solver.ts` | OK | Randomized pool defeats V8 caching (Section 5). |
| `solver.test.ts` | FAIL | `@jest-environment` pragma (Section 4); no `.md` mirror. |
| `*.md` mirrors | FAIL | `human-solver.md:3` & `benchmark.md:13` reference the old `lib/puzzle-engine/` path (unsynced docs). `human-solver.md` Types section is syntax-translation. |
| `benchmark-logs.md` | FAIL | Latest run Basic 0.56ms > 0.3ms threshold; Extreme 0.59ms is anomalous (likely a broken no-op solve vs. the healthy ~8ms prior run). |

### Feature UI (`src/features/puzzle-configuration/`, `pdf-generation/`)

| File | Status | Notes |
|---|---|---|
| `components/PuzzleForm.tsx` | WARN | Fragmented well; uses relative not `@/` imports. Has `.md`. |
| `components/GridSizeSelector.tsx` | FAIL | No `.md` mirror. |
| `components/DifficultyConfigurator.tsx` | FAIL | No `.md` mirror. |
| `hooks/usePuzzleGeneration.ts` | FAIL | No `.md` mirror; untested and mocked out in the one component test. |
| `components/PuzzleForm.test.tsx` | FAIL | `jest.mock('../hooks/...')` mocks an internal module (Section 4); `@jest-environment` pragma. |
| `pdf-generation/services/pdf.service.ts` | WARN | No colocated test. |
| `pdf-generation/tests/*.js` | FAIL | Banned `tests/` folder (Section 4) — ad-hoc `.js` pdfkit spikes, not E2E, not colocated. |

### Config / tooling / repo

| File | Status | Notes |
|---|---|---|
| `package.json`, `jest.config.js`, `jest.setup.js` | FAIL | On Jest, not Vitest (Section 4; migration explicitly mandated). |
| `scripts/run-tests.sh` | FAIL | Calls `npx jest`. `scripts/*` lack `.md` mirrors. |
| `.github/` | FAIL | Absent — no CodeQL/Dependabot/`npm audit` (Section 6). |
| `README.md` | WARN | Features omit Extreme (L9); Tech Stack says Jest (L85); Phase 3 still Planned (L74). |
| `Docs/roadmap.md` | FAIL | Phase 3 has no Status line (branch `feature/interactive-board` = started); stale Windows `c:/Users/...` + `lib/puzzle-engine/` paths (L45-61); refs `generator.ts` (L31, actual: `pdf.service.ts`). |
| `Docs/phase3-implementation-plan.md` | FAIL | Misplaced in `Docs/` root; belongs in `Docs/archive/` (Section 7). |
| `Docs/research/Git_GitHub_Best_Practices.md` + `Git & GitHub Best Practices- ....md` | FAIL | Naming violations (snake/Pascal/spaces/`&`); duplicate content. |

## Findings by Severity

### High

1. **Jest to Vitest migration not done** (Section 4, Update Log). Repo is fully on
   Jest. The spec explicitly says this "needs an actual migration, not just an
   instruction update."
2. **Info-disclosure: stack trace leaked to client** — `route.ts:121-125` returns
   `details: err.message` and `stack: err.stack` in the 500 body. Already logged
   server-side; must be removed from the HTTP response (OWASP Security
   Misconfiguration, Section 6).

### Medium

3. **Engine uses `Set`-based candidates, not bitmask/MRV** — `human-solver.ts:16,43`
   (Section 1). Plausibly linked to the Basic tier breaching its 0.3ms benchmark.
4. **`instrumentation.ts` missing `onRequestError()`** (Section 5).
5. **Internal-module mock** — `PuzzleForm.test.tsx:9` mocks the `usePuzzleGeneration`
   hook (Section 4).
6. **Banned `tests/` folder** — `src/features/pdf-generation/tests/` (Section 4).
7. **No CI security scanning** — no `.github/` with CodeQL/Dependabot/`npm audit`
   (Section 6).
8. **Missing `.md` mirrors** for `instrumentation.ts`, `lib/logger.ts`,
   `GridSizeSelector.tsx`, `DifficultyConfigurator.tsx`, `usePuzzleGeneration.ts`,
   `solver.test.ts`.
9. **Stale engine docs** — `human-solver.md:3`, `benchmark.md:13` point to the
   pre-refactor `lib/puzzle-engine/` path (Section 2).
10. **Broad untested surface** — all of `strategies/`, `sudoku.ts`,
    `generation.service.ts`, `pdf.service.ts`, both configurator components, and
    `usePuzzleGeneration.ts` have no colocated tests.
11. **Anomalous/failing benchmark** — `benchmark-logs.md` Basic 0.56ms > 0.3ms;
    latest Extreme 0.59ms looks like a broken no-op solve.

### Low / Documentation hygiene

12. **Roadmap Status not bumped** — Phase 3 in progress but `README.md:74` = Planned
    and `roadmap.md` Phase 3 lacks a Status line.
13. **Doc naming/placement** — the two `Git*` research files and
    `phase3-implementation-plan.md` in `Docs/` root (Section 7).
14. **README staleness** — omits Extreme difficulty; lists Jest.
15. **Sparse JSDoc** on `human-solver.ts` / `generation.service.ts` (Section 2).
16. **`human-solver.md` syntax-translation** in Types/Properties (Section 2).
17. **Markdown lint** — `markdownlint-cli` fires broadly; `roadmap.md` suppresses
    MD060 inline rather than fixing.
18. **Minor** — `PuzzleForm.tsx` relative imports; `scripts/` files lack `.md` mirrors.

## Remediation Plan

### Batch 1 — Security & correctness

- `route.ts`: drop `details`/`stack` from the 500 response body; keep server-side
  `logger.error`.
- Add `onRequestError()` to `instrumentation.ts`.
- Investigate the anomalous benchmark run.

### Batch 2 — Testing stack migration (Section 4)

- Add Vitest + jsdom, `vitest.config.ts`; port the three test files; swap
  `@jest-environment` to `// @vitest-environment`; replace the internal
  `jest.mock` with a boundary-level approach; update scripts; remove Jest.
- Scaffold Playwright for E2E.

### Batch 3 — Test coverage

- Add colocated tests for `sudoku.ts`, `strategies/*`, `generation.service.ts`,
  `pdf.service.ts`, and the configurator components. Remove `pdf-generation/tests/*.js`.

### Batch 4 — Engine representation (Section 1)

- Refactor `HumanSolver` candidates to a bitmask with popcount MRV; re-benchmark.
  (Higher-effort; may be split into its own PR.)

### Batch 5 — Documentation sync & hygiene

- Create the 6 missing `.md` mirrors; fix stale paths; bump Phase 3 status; fix
  README; rename/dedupe the `Git*` docs; move `phase3-implementation-plan.md` to
  `Docs/archive/`; add JSDoc; run markdown lint.

### Batch 6 — Infrastructure (Section 6)

- Add `.github/` with CodeQL + Dependabot + `npm audit`.

## Verification

- **Tests:** `npx vitest run` — 34 tests across 8 files, all green.
- **Types:** `npx tsc --noEmit` clean.
- **Lint:** `npm run lint` clean; `npx markdownlint-cli --ignore node_modules "**/*.md"`
  clean except pre-existing bullet-style issues in `Docs/research/*`.
- **Benchmarks:** `npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts`
  now uses tier-representative pools (hard/expert/extreme).
- **Security fix:** force a 500 on `/api/generate`; confirm no `stack`/`details`
  in the response while `logger.error` still captures them.

## Remediation Status (applied)

| Batch | Status | Notes |
|---|---|---|
| 1 — Security & correctness | ✅ Done | Stack/details removed from 500 response; `onRequestError()` added; benchmark made tier-representative (revealed the honest numbers below). |
| 2 — Jest → Vitest | ✅ Done | Vitest + jsdom installed, Jest removed, `vitest.config.ts`/`vitest.setup.ts` added, pragmas swapped, internal-hook mock replaced with a `fetch`-boundary mock, scripts + `tsconfig` types updated. |
| 3 — Test coverage | ✅ Mostly | Banned `pdf-generation/tests/*.js` removed; added colocated tests for `sudoku`, `generation.service`, `pdf.service`, `GridSizeSelector`, `DifficultyConfigurator`. `strategies/*`, `grid-utils`, `diggers` remain covered only indirectly (isolated tests need hand-crafted grids — follow-up). |
| 4 — Engine bitmask/MRV | ✅ Done | HumanSolver candidates converted from `Set<number>[][]` to per-cell bitmasks (helpers: `candidateCount`/`hasCandidate`/`removeCandidate`/`candidateList`); `fillGrid` and `countSolutions` rewritten as bitmask + MRV backtracking. All 34 tests still pass. Benchmark: Basic 0.58→0.34 ms, Advanced 0.59→0.40 ms, Extreme ~35→~17 ms; hard 9×9 generation ~3.5 ms/puzzle. Basic/Extreme were still above the example thresholds after this batch — **superseded by the hot-path optimization in section 7 below**, which brought Basic to 0.11 ms. |
| 5 — Documentation sync | ✅ Done | 6 `.md` mirrors created; stale `lib/puzzle-engine/`/Windows paths fixed; roadmap/README status + Extreme feature; Git docs renamed to kebab-case; JSDoc added; `.markdownlint.json` added. |
| 6 — CI security scanning | ✅ Done | `.github/` with CodeQL, Dependabot, and an `npm audit` CI gate. |

### Note on the corrected benchmark (finding #11)

The original "Extreme 0.59 ms" was **not** a broken solver — the existing test
suite passes and Extreme-puzzle generation depends on the extreme strategies
firing. It was a benchmark that ran an **expert-only** pool against all three
tiers, so the extreme tier never invoked its own strategies. With honest,
tier-representative pools the current numbers are roughly **Basic ~0.5 ms**,
**Advanced ~0.5 ms**, **Extreme ~30–35 ms** — the engine genuinely exceeds the
AGENTS.md example thresholds (Basic < 0.3 ms, Extreme < 10 ms) because candidates
are stored as `Set<number>[][]`. Batch 4 (bitmask + popcount MRV, AGENTS.md
Section 1) is the lever to bring these back under threshold. The Phase 1 roadmap
target of "AIC-heavy boards < 2 s" is comfortably met.

## Post-audit work (follow-on to the six batches)

After the six batches landed, two further pieces of work were requested and completed.

### 7 — Solver hot-path optimization

Profiling of the (now honest) tiers showed two dominant costs, which were removed:

- **Basic tier — Hidden Single (was ~76% of Basic time).** The strategy rescanned
  the whole grid `3 × size` times per call. Replaced with
  `HumanSolver.findAndPlaceHiddenSingle()` — a single tallying pass over the empty
  cells using reused, preallocated buffers (zero per-call allocation).
  `applyHiddenSingle` now delegates to it.
- **Extreme tier — ALS-XZ (was ~89% of Extreme time).** Addressed in two passes:
  - `enumerateALS` was materialising every C(n, k) cell subset per house. Replaced
    with a pruned DFS that carries the candidate-union as a bitmask and abandons any
    branch whose union exceeds `maxSize + 1` candidates. Each ALS returns a candidate
    **bitmask**, and `applyALSXZ` rejects pairs with `popcount(maskA & maskB) < 2` in
    O(1).
  - Diagnostics then showed the residual was **per-call**, not call-frequency
    (~5.8 calls/solve, ~234 ALS/call → ~55k pairs). So `applyALSXZ` now **precomputes**
    the work that was repeated per pair: a per-ALS `digit → cells` map (instead of
    re-filtering an ALS's cells for each of its ~234 partners) and a grid-wide
    `digit → empty cells` list (so eliminations scan only the ~10–25 cells that hold
    the digit, not all 81), with allocation-free ALS-cell exclusion via a tagged
    `Int32Array`.

**Result (tier-representative benchmark, versus the pre-optimization Batch-4 code):**

| Tier | Set-based (pre-Batch-4) | Batch 4 (bitmask) | + hot-path opt |
|---|---|---|---|
| Basic | 0.58 ms | 0.34 ms | **0.11 ms** ✅ (< 0.3 ms target) |
| Advanced | 0.59 ms | 0.40 ms | **0.13 ms** ✅ |
| Extreme | ~35 ms | ~25 ms | **~10 ms** ✅ (18.7 → 10.1 ms on a frozen A/B pool, −46%) |

All three tiers now sit at or under the AGENTS.md example thresholds; extreme is
pool-dependent (under 10 ms on easier extreme mixes, marginally over on the hardest).
**Solver strength is provably unchanged** — the ALS-XZ rework was validated by a
byte-identical fingerprint of `{solved, requiresExtreme}` over a frozen 40-grid pool
before and after, plus a re-verification that extreme generation still produces
puzzles that genuinely require extreme strategies. The Phase 1 roadmap target of
"AIC-heavy boards < 2 s" remains met with a wide margin.

### 8 — Playwright E2E scaffolding (AGENTS.md Section 4)

- Installed `@playwright/test`; added `playwright.config.ts` (top-level, exempt from
  colocation) with a `webServer` that boots `npm run dev`, a `chromium` project (with
  `firefox`/`webkit` ready to enable), and `baseURL` `http://localhost:3000`.
- Added the top-level `e2e/` directory with `home.spec.ts` (accessibility-first smoke
  tests of the landing page + mini-grid difficulty disabling) and a `README.md`.
- Added the `test:e2e` script and gitignored Playwright artifacts.
- **Verified:** `npx playwright install chromium` + `npm run test:e2e` → 2/2 passing
  in a real browser. Vitest's `include` is scoped to `src/**`, so it does not pick up
  the E2E specs.

## Verification (final state)

- `npx tsc --noEmit` clean · `npm run lint` clean · `npx vitest run` **34/34** ·
  `npm run test:e2e` **2/2** (Chromium).

### Follow-ups still open

- **Isolated strategy tests** for `strategies/*`, `grid-utils`, `diggers` — covered
  indirectly today; hand-crafted-grid unit tests remain a follow-up.
- **Extreme tier on the hardest pools** occasionally edges just over 10 ms. Getting a
  hard guarantee would need a further structural change (e.g. reusing ALS state across
  deduction iterations rather than re-enumerating each stall); the current per-call
  precomputation already brought the average to ~10 ms with strength unchanged.
- **`Docs/research/*` markdown** bullet-style/blank-line lint issues — these files
  are the user's imported prose; auto-fix with `npx markdownlint-cli --fix` when ready.
