# Docs

Index of the project's documentation. Naming is `lowercase-kebab-case.md` everywhere
(AGENTS.md §7).

## The three folders

| Folder | Holds | Test |
|---|---|---|
| `Docs/` (root) | **Active, living documents** | Would someone act on this *today*? |
| `Docs/research/` | **Deeply-researched topic references** | Durable knowledge, not a plan |
| `Docs/archive/` | **Historical logs, past plans, phase walkthroughs, closed reviews and incidents** | Records what *was* true |

**Archived docs are never rewritten.** They correctly state what was true when written; editing
them to match today falsifies the record. A stale statement gets a dated **Archived** or
**Superseded** note at the top instead — see [archive/architectural-analysis.md](archive/architectural-analysis.md)
for the pattern.

**Research is for knowledge that outlives an event, not for the event.** A one-time review of a
plan, a pre-cutover validation, or a closed incident write-up is a *record*, not a reference — it
goes to `archive/` once the plan ships or the incident closes, even if it arrived as commissioned
"research". The roadblock docs AGENTS.md sends to `research/` stay there while the reason they
record still shapes live code (`keisan-test-flake-and-bent-ratio-divergence.md` is cited by the
calc engine; `vercel-cron-deployment-protection-outage.md` by the daily-puzzles workflow) — which
is the rule below, applied to research.

### The one non-obvious rule: live source rationale outranks "completed"

A finished plan normally moves to `archive/`. **But a doc that live source code cites as the
rationale for current behavior stays in the root regardless of how complete its plan is** —
archiving it would break the code's own explanatory links, which are the main way a reader gets
from a puzzling line of code to the reason for it. Six docs are in the root for exactly this
reason, and each says so in its own banner:

- [kenken-implementation-plan.md](kenken-implementation-plan.md) — `sudoku.ts`, `human-solver.ts`
  and `human-solver.test.ts` all point at its **K0** section for why 5×5/7×7 can't be box-Sudoku.
- [multi-zone-migration-plan.md](multi-zone-migration-plan.md) — `next.config.ts`, `auth.ts`
  (rpID binding) and `base-path.ts` point here for why `basePath` and the passkey rpID look the
  way they do.
- [killer-6x6-implementation-plan.md](killer-6x6-implementation-plan.md) — `killer-sudoku.ts`
  points here from `DIFFICULTY_CONFIG_6` for why the 6×6 score bands cut at 16/28 instead of
  reusing the 9×9 cuts.
- [qa-remediation-plan.md](qa-remediation-plan.md) — `PuzzleHub.tsx` cites its Step 4 for why the
  hub is grouped Play / Compete / Print.
- [mobile-a11y-audit.md](mobile-a11y-audit.md) — `e2e/a11y.spec.ts` cites gap G2 for why the
  reflow + axe loop exists.
- [performance-audit.md](performance-audit.md) — `Cell.tsx` (the `React.memo` boundary) and
  `bot-identity.ts` (keeping Drizzle out of the client bundle) cite it.

Before archiving any doc, grep for it in `src/`, `e2e/`, `.github/` and `*.config.ts`, not just in
`*.md`. The `e2e/` hit is the one an `src/`-only grep misses — it nearly cost the a11y audit its
citation in September 2026.

**This rule has been broken once already.** `killer-6x6-implementation-plan.md` was archived on
completion while `killer-sudoku.ts` was still citing it, leaving a dangling path in live source
until it was restored in September 2026 — a docs-only sweep never could have caught it. Nothing
enforces this yet, in either direction: moving a doc also breaks inbound `*.md` links and the
table below, and both are yours to fix by hand.

## Active documents

| Doc | What it's for | Status |
|---|---|---|
| [project-status.md](project-status.md) | **START HERE** — cold-start handoff: state, next horizons, traps that already cost time | 🚧 Living |
| [roadmap.md](roadmap.md) | The plan of record — phases, tracks, backlog | 🚧 Living |
| [pre-merge-log.md](pre-merge-log.md) | One entry per pre-merge run + **known flaky tests** + **standing lessons**. Runs older than the current month rotate to `archive/pre-merge-log-<yyyy-mm>.md` | 🚧 Living |
| [kakuro-implementation-plan.md](kakuro-implementation-plan.md) | Phase 10 — Kakuro (Cross Sums): reuse map, D#/G# decisions, slices V1–V3 → E1–E5 → R1 (visual first, engine underneath) with step-logs | 📋 Planned (Sept 2026) |
| [kakuro-log.md](kakuro-log.md) | Kakuro running log — decisions, research gaps, bugs, learnings, measurements (newest first) | 🚧 Living |
| [daily-redesign-plan.md](daily-redesign-plan.md) | Daily restructure (type-as-slot) — spec + step-log per step; `dailies.service.ts` and `daily-row.ts` cite it | 🚧 Step 4 polish left |
| [social-progression-economy-plan.md](social-progression-economy-plan.md) | Phase 9 — crumbs, achievements, streaks, shop, social | 📋 Planned |
| [strategy-courses-implementation-plan.md](strategy-courses-implementation-plan.md) | Phase 7 — interactive strategy courses | 📋 Planned |
| [qa-remediation-plan.md](qa-remediation-plan.md) | Aug 2026 QA findings + UX asks — every step landed; **live source rationale (hub grouping)** | ✅ Complete, kept live |
| [mobile-a11y-audit.md](mobile-a11y-audit.md) | Mobile + WCAG 2.2 AA findings — G1–G4 shipped, G5–G9 open; **live source rationale (e2e reflow loop)** | ✅ Quick wins done, kept live |
| [performance-audit.md](performance-audit.md) | Core Web Vitals / RSC / caching — P1–P2 shipped, P3–P6 wait on RUM; **live source rationale** | ✅ Instrumented, kept live |
| [kenken-implementation-plan.md](kenken-implementation-plan.md) | Keisan design — **live source rationale (K0)** | ✅ Complete, kept live |
| [multi-zone-migration-plan.md](multi-zone-migration-plan.md) | `biscuitlab.net/puzzles` — **live source rationale** | ✅ Applied, kept live |
| [killer-6x6-implementation-plan.md](killer-6x6-implementation-plan.md) | 6×6 Killer design — **live source rationale (16/28 bands)** | ✅ Complete, kept live |

Also here: `design/` (design-system tokens + mockup) and `samples/` (example PDF output).

## What's in `archive/`

Everything here is frozen; a dated banner at the top of each says why it moved. Grouped by kind:

- **Rotated logs** — [pre-merge-log-2026-08.md](archive/pre-merge-log-2026-08.md), the August 2026
  pre-merge runs.
- **Completed builds** (plan + walkthrough pairs, oldest first) —
  [implementation-plan.md](archive/implementation-plan.md) / [pdf-generator-walkthrough.md](archive/pdf-generator-walkthrough.md)
  (the original PDF generator);
  [expert-implementation-plan.md](archive/expert-implementation-plan.md), [-2](archive/expert-implementation-plan-2.md)
  / [expert-walkthrough.md](archive/expert-walkthrough.md);
  [extreme-implementation-plan.md](archive/extreme-implementation-plan.md) / [phase1-walkthrough.md](archive/phase1-walkthrough.md);
  [phase2-implementation-plan.md](archive/phase2-implementation-plan.md) / [phase2-walkthrough.md](archive/phase2-walkthrough.md);
  [phase3-implementation-plan.md](archive/phase3-implementation-plan.md) / [phase3-walkthrough.md](archive/phase3-walkthrough.md);
  [phase4-implementation-plan.md](archive/phase4-implementation-plan.md) / [phase4-walkthrough.md](archive/phase4-walkthrough.md);
  [phase5-implementation-plan.md](archive/phase5-implementation-plan.md);
  [killer-sudoku-implementation-plan.md](archive/killer-sudoku-implementation-plan.md),
  [killer-expert-implementation-plan.md](archive/killer-expert-implementation-plan.md),
  [killer-difficulty-rebalance-report.md](archive/killer-difficulty-rebalance-report.md);
  [keisan-walkthrough.md](archive/keisan-walkthrough.md);
  [hint-agent-plan.md](archive/hint-agent-plan.md) (Sept 2026).
- **Refactors, carried out** — [architectural-analysis.md](archive/architectural-analysis.md),
  [refactor-implementation-plan.md](archive/refactor-implementation-plan.md) /
  [refactor-walkthrough.md](archive/refactor-walkthrough.md),
  [enterprise-implementation-plan.md](archive/enterprise-implementation-plan.md) /
  [enterprise-walkthrough.md](archive/enterprise-walkthrough.md),
  [comprehensive-refactor-walkthrough.md](archive/comprehensive-refactor-walkthrough.md),
  [agents-compliance-audit.md](archive/agents-compliance-audit.md),
  [docs-organization-plan.md](archive/docs-organization-plan.md) (the first docs reorg).
- **Closed reviews and validations** — [kenken-plan-review.md](archive/kenken-plan-review.md),
  [multi-zone-migration-validation.md](archive/multi-zone-migration-validation.md),
  [multi-zone-migration-safety-review.md](archive/multi-zone-migration-safety-review.md).
- **Closed incidents** — [multi-zone-basepath-fetch-fix.md](archive/multi-zone-basepath-fetch-fix.md)
  (deep write-up) and [multi-zone-cutover-fix-summary.md](archive/multi-zone-cutover-fix-summary.md)
  (executive summary) — the same July 2026 regression.
- **Superseded references** — [git-github-best-practices.md](archive/git-github-best-practices.md)
  (→ `research/git-github-best-practices-solo-multi-repo.md`).
- **Never started** — [impossible-implementation-plan.md](archive/impossible-implementation-plan.md),
  an unapproved "Impossible" tier.

## Where to put a new doc

- A **plan or spec** you're about to build from → root, with a `> **Status:**` banner. If it's a
  multi-step build, make it a *living* doc with a per-step log (AGENTS.md → Living Planning Docs).
- **Research** — an external or deep-dive answer that outlives the feature → `research/`.
- A **roadblock** — a measurement that contradicted the plan, an approach that turned out
  infeasible → `research/`, and stop building until it's written (AGENTS.md → Roadblock Rules).
- A **build log / walkthrough** of something now finished, a **review or validation** of a plan
  that has shipped, or an **incident write-up** once closed → `archive/`, with a dated banner and
  every inbound link re-pointed (grep `src/`, `e2e/`, `.github/` and `*.config.ts` first).

Mirrored `.md` files for source (`foo.ts` → `foo.md`) do **not** live here — they sit next to
their source file, and updating them is part of every PR.
