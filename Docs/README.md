# Docs

Index of the project's documentation. Naming is `lowercase-kebab-case.md` everywhere
(AGENTS.md §7).

## The three folders

| Folder | Holds | Test |
|---|---|---|
| `Docs/` (root) | **Active, living documents** | Would someone act on this *today*? |
| `Docs/research/` | **Deeply-researched topic references** | Durable knowledge, not a plan |
| `Docs/archive/` | **Historical logs, past plans, phase walkthroughs** | Records what *was* true |

**Archived docs are never rewritten.** They correctly state what was true when written; editing
them to match today falsifies the record. A stale statement gets a dated **Archived** or
**Superseded** note at the top instead — see [archive/architectural-analysis.md](archive/architectural-analysis.md)
for the pattern.

### The one non-obvious rule: live source rationale outranks "completed"

A finished plan normally moves to `archive/`. **But a doc that live source code cites as the
rationale for current behavior stays in the root regardless of how complete its plan is** —
archiving it would break the code's own explanatory links, which are the main way a reader gets
from a puzzling line of code to the reason for it. Two docs are in the root for exactly this
reason, and both say so in their own banners:

- [kenken-implementation-plan.md](kenken-implementation-plan.md) — `sudoku.ts`, `human-solver.ts`
  and `human-solver.test.ts` all point at its **K0** section for why 5×5/7×7 can't be box-Sudoku.
- [multi-zone-migration-plan.md](multi-zone-migration-plan.md) — `next.config.ts`, `auth.ts`
  (rpID binding) and `base-path.ts` point here for why `basePath` and the passkey rpID look the
  way they do.

Before archiving any doc, grep for it in `src/` and `*.config.ts`, not just in `*.md`.

## Active documents

| Doc | What it's for | Status |
|---|---|---|
| [roadmap.md](roadmap.md) | The plan of record — phases, tracks, backlog | 🚧 Living |
| [pre-merge-log.md](pre-merge-log.md) | One entry per pre-merge run + **known flaky tests** (read before blaming a red test on your diff) | 🚧 Living |
| [daily-redesign-plan.md](daily-redesign-plan.md) | Daily restructure (type-as-slot) — spec + step-log per step | 🚧 Step 4 polish left |
| [qa-remediation-plan.md](qa-remediation-plan.md) | Aug 2026 QA findings + hub/archive/rules UX asks — 9 ordered steps, step-log per step | 📋 Planned |
| [social-progression-economy-plan.md](social-progression-economy-plan.md) | Phase 9 — crumbs, achievements, streaks, shop, social | 📋 Planned |
| [strategy-courses-implementation-plan.md](strategy-courses-implementation-plan.md) | Phase 7 — interactive strategy courses | 📋 Planned |
| [mobile-a11y-audit.md](mobile-a11y-audit.md) | Mobile + WCAG 2.2 AA findings | 📋 Analysis, unimplemented |
| [performance-audit.md](performance-audit.md) | Core Web Vitals / RSC / caching findings | 📋 Analysis, unimplemented |
| [kenken-implementation-plan.md](kenken-implementation-plan.md) | Keisan design — **live source rationale (K0)** | ✅ Complete, kept live |
| [multi-zone-migration-plan.md](multi-zone-migration-plan.md) | `biscuitlab.net/puzzles` — **live source rationale** | ✅ Applied, kept live |

Also here: `design/` (design-system tokens + mockup) and `samples/` (example PDF output).

## Where to put a new doc

- A **plan or spec** you're about to build from → root, with a `> **Status:**` banner. If it's a
  multi-step build, make it a *living* doc with a per-step log (AGENTS.md → Living Planning Docs).
- **Research** — an external or deep-dive answer that outlives the feature → `research/`.
- A **roadblock** — a measurement that contradicted the plan, an approach that turned out
  infeasible → `research/`, and stop building until it's written (AGENTS.md → Roadblock Rules).
- A **build log / walkthrough** of something now finished → `archive/`.

Mirrored `.md` files for source (`foo.ts` → `foo.md`) do **not** live here — they sit next to
their source file, and updating them is part of every PR.
