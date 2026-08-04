# Agent Rules
<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:documentation-rules -->
## Documentation Rules

Whenever we generate a new file, create a corresponding markdown file (Plain English Pseudocode) for it.
Whenever we edit an existing file, update its corresponding markdown file to reflect the changes.

**Backfill docs before every PR.** Before opening any pull request, bring all documentation
current as part of that same PR — never as a follow-up. Verify and update, as applicable:

- The mirrored `.md` file for every `.ts`/`.tsx` touched (per the two rules above).
- **The reverse-reference sweep — docs you did NOT touch that describe what you changed.**
  Mirroring only covers files whose *source* you edited; it silently misses every *other* doc
  that names a symbol you renamed or deleted, or that describes a design you superseded. Grep
  the whole repo for what you removed and fix each live hit:

  ```bash
  grep -rn "RemovedSymbol\|renamedThing\|old-concept" --include="*.md" . | grep -v node_modules
  ```

  Sweep for: exported symbols removed/renamed, function signatures changed, and any *plan* doc
  that anticipates the thing you just built (its "pending" banner is now wrong — and if the
  design changed along the way, actively misleading). **Leave genuinely historical records
  alone** — `Docs/archive/*`, dated roadmap phase entries, and completed plans correctly state
  what was true when written; rewriting those falsifies the record. Fix *live* docs only.
- `Docs/roadmap.md` and the `README.md` status table when a phase's scope or status changed
  (see Roadmap Rules).
- A `Docs/research/*.md` record for any roadblock, plan divergence, or incident hit while
  building (see Roadblock & Research Rules).
- Markdown linting on every doc changed (`npx markdownlint-cli`).

A PR that ships code with stale, missing, or unlinted docs is incomplete. If a fix or
incident is discovered *after* a PR merges (e.g. during production smoke-testing), record it
in `Docs/` and land that doc via its own quick follow-up PR rather than leaving it uncommitted.

> **Why the sweep exists (July 2026).** The daily restructure passed the mirrored-doc audit and
> still shipped three stale live docs: `bot.md` and `solve/route.md` named exports that no longer
> existed, and `social-progression-economy-plan.md` still advertised the *superseded* daily design
> as its plan of record — so anyone starting Phase 9 cold would have built against a rejected
> model. None of their source files were touched, so mirroring could never have caught them.
<!-- END:documentation-rules -->

<!-- BEGIN:roadmap-rules -->
## Roadmap Rules

Whenever a roadmap phase is started, completed, or its scope changes:

- Update `Docs/roadmap.md` to reflect the current status and any new details.
- Update the simplified roadmap table in `README.md` (change the Status column: 📋 Planned → 🚧 In Progress → ✅ Done).
<!-- END:roadmap-rules -->

<!-- BEGIN:living-planning-docs-rules -->
## Living Planning Docs Rules

Planning and implementation docs (e.g. `Docs/daily-redesign-plan.md`) are **living,
self-contained handoff documents** — not write-once plans. The goal: a doc that can be dropped
into a brand-new chat with zero prior context, and someone can start the next step with the
full history, rationale, and gotchas from every prior step.

- **Keep the canonical copy in the repo** (`Docs/`), never only in an ephemeral
  `~/.claude/plans/` scratch file — it must ship with the project and survive sessions.
- **Front-load the background:** all necessary knowledge up front, with inline links to the
  applicable research (`Docs/research/*`) and related plans, so the doc stands on its own.
- **Give each plan a numbered step list**, and when a step lands, append a short **step-log**
  entry to that step: *process* (what was done + how), *learnings*, and *blockers + how they
  were resolved*.
- Updating the living plan doc's step-log is part of the pre-PR **doc audit** (see Pre-Merge /
  Pre-PR Checklist), alongside the mirrored-`.md`, roadmap, and research updates.
<!-- END:living-planning-docs-rules -->

<!-- BEGIN:devlog-rules -->
## Build Log (Devlog) Rule

When we ship something **big** — a feature, a meaningful refactor, or a genuinely new
discovery/learning (a de-risk that overturns an assumption, a hard-won bug fix, a non-obvious
tradeoff) — write a **build-log entry** ("devlog") for it. Not every PR: only the notable ones;
a small fix or routine change does not need one. Craft guidance and the evidence base live in
`Docs/research/devlog-blog-portfolio-strategy.md`; the short version:

- **Show, don't announce.** Write the entry *after* there's something real to show — a working
  feature, a measured result, a resolved bug — never a "here's what I'm about to build" post.
- **Narrative arc, not a changelog.** Frame it as *what I set out to do → what broke / what
  surprised me → what I changed and why*. A bare changelog is the worst-performing format;
  always wrap it in the story. First person, human voice, scannable (`##` headings, short
  paragraphs).
- **Concrete over abstract.** Real numbers (yields, timings, benchmark deltas), the ugly first
  attempt, before/after. GIFs / short clips are the single highest-impact asset for anything
  visual or interactive — capture them *as you build* so they cost nothing later.
- **Keep it lightweight.** Time-box and batch the writing. If devlog production ever starts
  eating build time (rule of thumb: > ~10%), cut cadence — the feature ships first. Cadence is
  weekly-to-biweekly at most, **never daily**.

**Where it publishes — the `Biscuit-Website` repo (biscuitlab.net), NOT this one.** The build
log lives there at `/log`:

- Add one file: `src/content/log/<kebab-slug>.mdx` — the filename *is* the URL slug
  (`/log/<slug>`), no date prefix. It is auto-discovered; there is no index or registry to edit.
- Frontmatter is deliberately thin: `title` (required), `date: yyyy-mm-dd` (required),
  `summary` — one sentence, reused on the index + `feed.json` + meta description (required), and
  `project: puzzles` (optional cross-link). No tags/author/draft fields — "draft" = don't commit
  the file yet.
- Body is MDX. Images/GIFs go in that repo's `public/…` and are referenced via `next/image`
  with real alt text + explicit width/height (its a11y/CLS gate enforces this).
- Author per *that* repo's own `AGENTS.md`, then `npm run build && npm run typecheck &&
  npm run lint` there and commit + push to `main` (Vercel deploys).
<!-- END:devlog-rules -->

<!-- BEGIN:roadblock-research-rules -->
## Roadblock & Research Rules

When implementation diverges from the plan — a measurement contradicts an assumption, a slice hits a
roadblock, generation/yield/performance doesn't behave as designed, or a chosen approach turns out to
be infeasible — **stop building and write a research document** rather than improvising a workaround
or silently narrowing scope.

- Put the document in `Docs/research/` (`lowercase-kebab-case.md`). Capture: what we planned, what we
  actually measured/observed (with numbers), why it doesn't work, the options considered, and the
  **open questions** to research before proceeding.
- Surface it to the user with a concise summary and a recommendation. Let the user run research (or
  approve a direction) before resuming — don't answer plan-invalidating questions by guessing.
- When the answer comes back, **fold it into the plan/levers/roadmap docs first**, then resume the
  build. The `Docs/research/` doc stays as the durable record of *why* the approach changed.
- This is the K7 pattern: the 9×9 de-risk contradicted the levers doc, so we stopped, wrote
  `keisan-9x9-feasibility-findings.md`, took in external research, re-sliced the plan, and only then
  built. Repeat that loop for any similar divergence.
<!-- END:roadblock-research-rules -->

<!-- BEGIN:pre-merge-checklist-rules -->
## Pre-Merge / Pre-PR Checklist

Every PR passes this gate before merge. It ties together rules that already live elsewhere in
this file (docs backfill, benchmarks, tests) plus a code-review pass, in one ordered flow. The
weighting is deliberate and evidence-based — see
`Docs/research/solo-dev-ai-qa-code-review-playbook.md`: push **defect-finding onto tests,
types, and automation**, and reserve the human review for the judgment calls automation can't
make. Do not turn this into ceremony; keep it mechanical.

1. **Keep the slice small.** Target a diff **< ~400 LOC**; split if larger. Review quality and
   defect detection fall off sharply past that — vertical slices keep it in range.
2. **Doc audit** (same PR, never a follow-up — see Documentation Rules → "Backfill docs before
   every PR"). Verify and update, as applicable: the mirrored `.md` for every `.ts`/`.tsx`
   touched; the **reverse-reference sweep** (`grep -rn` the repo for every symbol you
   renamed/removed and every design you superseded — mirroring cannot catch docs whose source
   you never touched, and plan docs that "anticipate" what you just built go stale silently);
   `Docs/roadmap.md` + the `README.md` status table (Roadmap Rules); the **living plan doc's
   step-log** (Living Planning Docs Rules); a `Docs/research/*.md` record for any roadblock
   (Roadblock & Research Rules); and `npx markdownlint-cli "**/*.md"` on every doc changed.
3. **Benchmarks + tests.** If core solving logic changed (`human-solver.ts`, `sudoku.ts`, or
   any solver/generator core), run the relevant benchmark(s) —
   `npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts` and the sibling
   `benchmark-calc.ts` / `benchmark-killer.ts` for those engines — and review
   `benchmark-logs.md` against the tier targets (Section 3). Always run `npx vitest run` and
   `npm run lint`.
4. **Code review — judgment, not defect-hunting.** Tests, types, CI, and the AI reviewer own
   mechanical defect-finding; the human pass owns what they can't:
   - **Authorization correctness** and **business/economy invariants** (ownership `WHERE`
     clauses, server-authoritative scores — see Section 6 BOLA rule).
   - **Trust boundaries:** every new endpoint/action does **authorize → validate (Zod) →
     mutate**; economy/leaderboard writes are idempotent and replay-safe.
   - **AI-written logic is actually right:** re-derive or explain-back the risky parts; the AI
     failure mode is plausible-but-wrong, not obviously-broken.
   - **Generated migration safety:** read the Drizzle-generated SQL by hand; destructive
     changes need reverse SQL + a backup; additive-only until cutover.
   - **New dependencies exist and are reputable** before install (slopsquatting — Section 6).
   - **Who runs what.** `/code-review` (and `/code-review ultra`) is **user-triggered and billed** —
     an agent cannot launch it, so an agent must never treat this step as "run the command". An
     agent runs `/pre-merge` (`.claude/commands/pre-merge.md`), which walks steps 1–3 plus the
     project-specific judgment prompts, logs the run (step 5), and then **states plainly that the
     hosted review has not been run** so the owner can decide whether to trigger it. `/security-review` *is*
     agent-invocable and is required for any auth/authz/data-access change (Section 6, "AI-generated
     code is unaudited by default").
5. **Log the run** in `Docs/pre-merge-log.md` (newest first), in the **same** PR — mechanical
   numbers, findings, invariants actually checked, docs sweep, verified-vs-read, and the two review
   statements. The gate's output otherwise lives only in a chat transcript, so every run re-derives
   what the last one already knew. Two things carry real forward value and must land here:
   - **The Known flaky tests table.** Read it *before* running the suite. A listed test failing does
     not implicate the diff under review. This exists because attributing one red test to a
     pre-existing engine flake (rather than to the diff) cost ~18 full-suite runs plus isolated
     timing — an answer worth writing down once.
   - **Generalizable lessons**, phrased as a rule the next run can apply, not as a story about this
     one (e.g. "a call-history assertion in a file with no `mockClear` is presumed vacuous until a
     deliberately-broken run proves otherwise").

   Keep entries short — a finding fixed inside the same PR gets one line. Don't restate that lint
   passed.
6. **Merge** only once 1–5 are green **and** CI passes (`ci.yml`: `npm run lint`,
   `markdownlint`, `npm test`, `npm audit --audit-level=high --omit=dev`; plus `codeql.yml`).

> **Deferred hardening.** Making this gate *physical* (a `.github/pull_request_template.md`,
> branch protection requiring green CI, a configured AI reviewer, axe-in-CI + a Lighthouse INP
> budget, fast-check property tests for generator invariants, Stryker mutation testing on the
> engine core, gitleaks) is tracked as "Solo-dev QA hardening" in `Docs/roadmap.md`, staged per
> the research doc. Not required per-PR today; recorded so the gap stays visible.
<!-- END:pre-merge-checklist-rules -->

<!-- BEGIN:markdown-linting-rules -->
## Markdown Linting Rules

Ensure all markdown files adhere to proper linting standards and formatting (e.g., correct list indentation, explicit code block languages, proper heading hierarchy) to avoid markdown linting errors.
<!-- END:markdown-linting-rules -->

<!-- BEGIN:codebase-management-rules -->
## Codebase Management & AI Guidelines

When operating within this codebase, AI agents MUST adhere to the following workflow and structural guidelines:

### 1. Architecture & Structure

- **Domain-Driven Architecture:** Maintain a feature-based architecture under the `src/features/` directory rather than grouping purely by technical type (e.g., `src/features/engine/`, `src/features/pdf-generation/`).
- **App Router Purity (AI Pitfall):** The `src/app/` directory is strictly for routing, layouts, and server-side entry points. AI agents frequently conflate routing with business logic, creating insecure monolithic files. `page.tsx` files must act solely as controllers, delegating all logic and UI rendering to the `src/features/` directory.
- **`pageExtensions` Trap (AI Pitfall):** Do NOT use the `pageExtensions` config (`next.config.js`) to force a `.page.tsx` suffix as a colocation trick. It's a Pages Router-era technique with long-standing, still-open Next.js issues (404s, missing CSS, broken builds) when combined with the App Router. Use private folders (`_components/`, `_lib/`) for colocating non-route files instead — see below.
- **Next.js Runtime Declarations (AI Pitfall):** Explicitly require `export const runtime = 'nodejs';` in App Router API routes (`route.ts`) that rely on native Node modules (e.g., `fs`, `stream`, `pdfkit`). Without this, Next.js may attempt Edge runtime deployment, causing crashes. If PDF generation ever moves from `pdfkit` to a headless-browser approach, prefer Playwright over Puppeteer (Puppeteer is in Google maintenance mode; Playwright is the 2026 default) — but note headless-browser rendering needs a Node server/container, not Edge or a serverless platform with tight bundle/timeout limits.
- **Server vs. Client Components:** Components are Server Components by default. Reserve `"use client"` for leaf components that genuinely need interactivity — the puzzle grid, numpad, and timer. Marketing/landing pages and static layout chrome should stay server-rendered. Don't reflexively add `"use client"` to a whole route just because one child needs it.
- **Separation of Concerns (SRP):** The UI components must remain entirely decoupled from the core puzzle generation logic.
  - Fragment large monolithic UI components into smaller composable sub-components. However, avoid premature "Component File Explosion." If a sub-component is only used by one parent, it belongs in the exact same file or a colocated private folder, not a global components directory.
  - Extract data-fetching and complex state logic out of components into custom hooks.
  - API routes should act merely as controllers; move generation logic into dedicated service files.
- **Colocation & Import Aliases:** Files that change together should be stored together. Tests and benchmarking scripts must be placed directly beside the feature modules they test. Require the use of module path aliases (e.g., `@/features/`) instead of deep, fragile relative imports (e.g., `../../../`) to improve refactoring stability.
- **File Naming & Component Discovery:** Explicitly ban the `index.ts` pattern for components (e.g., use `Avatar/Avatar.tsx` instead of `Avatar/index.ts`) to ensure IDE searchability. Keep barrel files (`index.ts` re-exporting a whole feature folder) shallow if used at all — one level, no re-exporting other barrels — since deep barrels defeat tree-shaking and slow Turbopack cold builds.
- **UI Composition:** Explicitly mandate the use of the `children` prop and "named slots" for building complex React layouts, completely avoiding deep component class inheritance.
- **The Engine:** The `src/features/engine/` directory contains pure, highly-optimized TypeScript. It relies on logical deduction (`HumanSolver`), not just brute-force backtracking. Keep `HumanSolver` as a class (since it's a stateful complex entity) but strictly avoid introducing inheritance (`extends`). For the generator/solver core, prefer bitmask-based backtracking with an MRV heuristic (popcount over candidate bitmasks) rather than DLX/exact-cover — DLX is elegant but is not the fastest known approach for 9x9 grids, and the tiered benchmark targets in Section 3 assume bitmask-level performance. See `Docs/research/sudoku-generation.md`.
- **Hydration-Safe Puzzle Generation (AI Pitfall):** Never run the backtracking generator during Server Component rendering and again on the client — `Math.random()`-driven shuffling will never produce identical server/client output, causing a hydration mismatch. Generate client-side only (mark the board container `"use client"`, generate inside `useEffect` or on first interaction, render a skeleton until the grid exists), or pass a server-generated seed to a seeded PRNG so server and client produce identical output. Client-only generation is the default for this project — there's no SEO/LCP benefit to server-rendering a specific puzzle instance.

### 2. Code Documentation Philosophy (CRITICAL)

- **Mirroring:** Every core logic file in `src/features/engine/` (e.g., `human-solver.ts`, `sudoku.ts`) and its subdirectories has a mirrored `.md` file (e.g., `human-solver.md`).
- **Syncing & Stale Comments:** Whenever you modify a `.ts` file, you **MUST** simultaneously update its corresponding `.md` file and JSDoc block. Updating code without updating its documentation is a severe architectural failure.
- **The AI Translation Trap:** Explicitly ban writing comments that merely translate syntax into English (e.g., `// Set count to 0`). Code must be self-documenting through expressive variable naming.
- **Explain the "Why":** The `.md` files contain "Plain English Pseudocode". Ensure that our mirrored `.md` files focus on explaining *why* certain algorithmic paths were chosen, rather than just translating the `for` loops into English. For every method, write the English explanation of the logic/strategy *immediately above* the pseudocode block. Document external constraints, workarounds (e.g., browser bugs), and architectural trade-offs.
- **JSDoc Usage:** Add standard JSDoc block comments (`/** */`) to the top of all major exports to enable rich tooltip hints in the IDE. Never write redundant "syntax-restating" inline comments.

### 3. Performance & Benchmarks

- **Speed is Key:** The puzzle generator relies on running the solver dozens of times per second. Performance regressions are unacceptable.
- **When to Run:** Whenever you modify `human-solver.ts`, `sudoku.ts`, or any core solving logic, you MUST run the tiered benchmarks:

  ```bash
  npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts
  ```

- **Logging:** The benchmark script automatically appends results to `src/features/engine/benchmarks/benchmark-logs.md`. Review these logs to ensure the 'Basic', 'Advanced', and 'Extreme' tiers maintain their expected performance (e.g., Basic < 0.3ms, Extreme < 10ms).
- **Interaction to Next Paint (INP):** For interactive grid components, INP (not FID, which was retired March 2024) is the Core Web Vital that matters — target ≤200ms. A player fires dozens of clicks/keystrokes per minute; a slow 40th interaction tanks the score even if the first was instant. Keep cell `onClick`/`onKeyDown` handlers cheap, avoid recomputing whole-board derived state (candidate validity, error highlighting) on every keystroke, and use narrow Zustand selectors (see `useShallow` guidance in `Docs/research/react-sudoku-implementation-research.md`) rather than broad state subscriptions.

### 4. Testing & Linting

- **Strict Colocation:** Test files MUST reside immediately adjacent to the source code they are validating (e.g., `PuzzleForm.test.tsx` next to `PuzzleForm.tsx`). Global `tests/` folders are banned except for E2E tests.
- **Vitest, Not Jest:** Default to **Vitest** for unit/integration tests, not Jest — Next.js ships an official Vitest setup guide, it starts faster (no Babel/`ts-jest` transform), and has native ESM support. Only reach for Jest if this project later adds React Native/Expo compatibility.
- **Vitest Hybrid Environments (AI Pitfall):** Use the `// @vitest-environment jsdom` pragma comment at the top of React UI test files (or configure `environmentMatchGlobs` in `vitest.config.ts`). The global Vitest environment must remain `node` to prevent `Request` polyfill collisions in Next.js API route tests.
- **Mocking Boundaries:** Testing mocks must only occur at the boundaries of the application (e.g., network requests, external APIs), never mocking internal application modules, to preserve test realism.
- **Behavioral UI Testing:** UI tests must follow the Arrange, Act, Assert (AAA) pattern. Use accessibility-first queries (`getByRole`, `getByLabelText`) from React Testing Library to test user behavior, not implementation details.
- **Snapshot Testing:** Use sparingly. Large component snapshots get rubber-stamp-approved during `--update` runs without anyone reading the diff, which defeats the point. Reserve snapshots for things like generated CSS or serialized data structures; prefer explicit `getByRole`/`getByText` assertions for anything a human needs to actually verify.
- **E2E Testing:** Use **Playwright**, not Cypress, for end-to-end suites — it has real WebKit/Safari coverage and free parallelization (Cypress's parallelization requires a paid cloud service). E2E suites live in a top-level directory, exempt from the colocation rule above.
- **Unit Tests:** After any logic or API route changes, run `npx vitest run`. All tests must pass before concluding your task.
- **Linting:** Run `npm run lint` to catch TypeScript/React issues.
- **Markdown Linting:** Ensure all markdown files (`.md`) follow strict markdown linting rules (proper heading hierarchy, no trailing spaces, explicit code block languages) by running `npx markdownlint-cli "**/*.md"`.

### 5. Telemetry & Profiling

- **Structured Logging:** Production telemetry must use structured JSON logging (e.g., Pino) via Next.js `instrumentation.ts` (server-only, exports `register()` and `onRequestError()`) or custom wrappers. Do NOT use raw `console.log` for business logic or errors. Emitting "wide events" is preferred over scattered logs. Note `instrumentation-client.ts` is a separate, browser-only convention for client-side analytics/error tracking — it is not the place for server logging.
- **Pino + Edge Runtime (AI Pitfall):** Pino's async transport relies on Node worker threads (`thread-stream`), which breaks under Middleware, Edge-runtime routes, and can also fail under Turbopack bundling (`pino.transport is not a function`). Keep logging routes on the standard Node.js runtime (see the runtime declaration rule above), or configure Pino without transports (synchronous JSON writes) for any code path that might run on the edge — confirm this before wiring up logging in `middleware.ts`.
- **Microbenchmarking Warning:** Be cautious of V8 JIT over-optimization in synthetic loops (Hidden Class Caching, Dead Code Elimination, Inline Caching). Benchmarks should use randomized inputs/grids to prevent V8 from caching object shapes or eliminating dead code, ensuring realistic macroscopic profiling.
- **V8 Deoptimization (AI Pitfall):** AI-generated code frequently produces polymorphic functions (functions accepting varying input types). In high-performance areas like the puzzle engine, functions must remain monomorphic (consistent input shapes) to prevent V8 engine deoptimization and potential DoS attack surfaces.

### 6. Security & Infrastructure (CRITICAL)

- **Cryptographic Storage:** Never use deprecated hashes (MD5, SHA-1). Passwords must be hashed using memory-hard algorithms like **Argon2id** (baseline m=19456/t=2/p=1; consider 128 MiB/3-5 iterations for extra headroom) or **bcrypt** (with SHA-256 pre-hashing to bypass the 72-byte limit) combined with a 16-byte salt.
- **Passkeys First:** For any new account/sign-in flow, offer passkey (WebAuthn/FIDO2) sign-in as the primary option — via a library like SimpleWebAuthn or an auth provider with built-in support — with email/password or OAuth as fallback, not the default. This doesn't remove the session-management rules below; a passkey authenticates the user, but the resulting session still needs the same cookie discipline.
- **Session Management:** NEVER store JWTs or sensitive session tokens in `localStorage` or `sessionStorage` (vulnerable to XSS). Implement the "Hybrid Token Architecture": short-lived access tokens in memory, and long-lived refresh tokens stored exclusively in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Authorization & BOLA (AI Pitfall):** Do not solely verify authentication ("is the user logged in?"). Always verify authorization ownership ("does the user own this specific record?") at the data-access layer using strict `WHERE` clauses or RBAC/ABAC models. AI tends to hallucinate CRUD endpoints that forget to verify resource ownership — this and unparameterized queries are the two categories most likely to be wrong in AI-generated endpoints, so review both manually regardless of how confident the generated code looks. This maps to OWASP Top 10:2025 "Broken Access Control" (#1) and "Security Misconfiguration" (#2, up from #5 in 2021).
- **Database Hardening:** Exclusively use parameterized queries (via a type-safe ORM like Prisma or Drizzle) to eliminate SQL injection vulnerabilities. Enforce the principle of least privilege for the database connection.
- **Prompt Injection Defense:** Any untrusted user input passed into future AI logic must be rigorously sanitized and architecturally isolated to prevent Prompt Injection attacks.
- **CI Security Scanning:** Wire up free-tier tooling before launch — GitHub CodeQL (SAST) and Dependabot (SCA) are free on public/private repos, `npm audit`/`pnpm audit` catch known-vulnerable dependencies at zero cost. None of this replaces the manual review called out above, but it's a reasonable free baseline for a solo project. **Gotcha:** a top-level version bump doesn't always reach a natively-compiled sub-dependency a framework bundles internally (e.g., Next.js pins its own nested `sharp`) — after patching a CVE, confirm with `npm ls <pkg>` that no vulnerable nested copy remains, and add a `package.json` `overrides` entry if it does.
- **Middleware Is Not an Auth Boundary (AI Pitfall):** CVE-2025-29927 let attackers bypass all Next.js middleware-based auth via a spoofed `x-middleware-subrequest` header. Real authorization must live in Server Actions, Route Handlers, or a Data Access Layer — never middleware alone. Treat middleware auth checks as an optimization/early-reject at best, and make sure they fail closed. This project currently ships no `middleware.ts` at all, which sidesteps the bug entirely — keep it that way unless a genuine need for middleware-level logic arises.
- **Origin/CSRF Trust Is Explicit, Not Assumed:** Auth libraries typically auto-trust only your primary deployment origin. Every additional real origin a session/OAuth/passkey flow must work from — including Vercel preview deployments (`*.vercel.app`) — needs to be added to `trustedOrigins` (or the library's equivalent) explicitly, and re-verified after any auth-config change; getting this wrong either breaks preview auth or silently widens trust.
- **Security Headers & CSP:** Ship baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) via `next.config.ts` `headers()` for every route — a zero-cost default, not optional polish. A full nonce-based CSP is the eventual target but is real, separate work (it forces nonce'd inline scripts and dynamic rendering on the routes that need it) — don't let its absence block shipping the cheaper headers now.
- **Rate Limiting on Serverless:** A rate limiter's default in-memory store does not share state across Vercel's separate serverless instances/cold starts — it looks like protection but mostly isn't, especially once real value (currency, purchases, auth) is on the line. Back it with shared storage (e.g., Upstash Redis) before an endpoint is worth abusing at scale; framework defaults are an acceptable stopgap only while traffic stays low.
- **AI-Generated Code Is Unaudited by Default:** Per Veracode's 2025/2026 GenAI Code Security Reports, models pick the insecure implementation roughly half the time regardless of model generation, and CodeRabbit's 2025 study found AI-authored PRs ~1.9x more likely to introduce IDOR — passing tests or compiling is not evidence of security. Run a dedicated, separately-prompted security self-review pass on auth/authz/data-access changes before calling them done (a "review your own code for security issues, then fix what you found" loop measurably reduces vulnerability density); don't rely on "act as a security expert"-style persona prompting alone — the same research found it *increases* average vulnerabilities. Before adding any newly-suggested package, confirm it actually exists and is real/maintained — LLMs hallucinate plausible package names at a meaningful rate ("slopsquatting"), and attackers register the hallucinated ones.

### 7. Documentation Standards

- **Naming Convention:** All documentation files must explicitly use `lowercase-kebab-case.md` for their filenames.
- **Organization:** `Docs/README.md` is the index — it lists every active doc and where a new one
  goes. Keep it current when adding, archiving, or retitling a doc.
  - Root `Docs/` directory: Active, living documents (e.g., `roadmap.md`, `pre-merge-log.md`).
  - `Docs/archive/` directory: Historical logs, past implementation plans, and phase walkthroughs.
  - `Docs/research/` directory: Standardized, deeply-researched topic documents.
- **Live source rationale outranks "completed" (AI Pitfall).** A finished plan normally moves to
  `archive/` — **but not if live source code cites it as the reason current code looks the way it
  does.** Archiving such a doc breaks the code's own explanatory links, which are how a reader gets
  from a puzzling line to its rationale. `kenken-implementation-plan.md` (cited by `sudoku.ts` /
  `human-solver.ts` for K0) and `multi-zone-migration-plan.md` (cited by `next.config.ts`,
  `auth.ts`, `base-path.ts`) stay in the root for exactly this reason. **Before archiving anything,
  grep for it in `src/` and `*.config.ts`, not just in `*.md`** — the doc-only sweep misses code
  comments entirely.
- **Never rewrite an archived doc to match today.** It correctly records what was true when
  written; editing it falsifies the record. Add a dated **Archived** / **Superseded** note at the
  top instead, and say what superseded it. When moving a doc, fix the relative links *inside* it
  (its depth changed) as well as every inbound link to it.
<!-- END:codebase-management-rules -->

<!-- BEGIN:git-rules -->
## Git Rules

- **Committing and Pushing Code:** ONLY run `git commit` or `git push` when the user explicitly requests it (e.g., "commit", "push", "commit push"). Do NOT commit code automatically or unprompted.
<!-- END:git-rules -->

<!-- BEGIN:update-log -->
## Update Log

**July 2026:** Revised against the project's own `Docs/research/` set after a research-backed accuracy pass on those docs. Notable changes:

- Testing stack switched from **Jest to Vitest** as the default unit/integration runner (Section 4) — this is a real tooling change, not just a docs correction; if Jest is already configured in the repo, this needs an actual migration, not just an instruction update. Playwright added as the named E2E tool (previously unspecified).
- Added `pageExtensions` as an explicit anti-pattern (Section 1) — a plausible-looking colocation trick that causes real App Router bugs.
- Added Core Web Vitals/INP guidance (Section 3), a Pino + Edge Runtime gotcha (Section 5), passkeys-first auth and free CI security tooling (Section 6), and a hydration-safety rule plus bitmask-vs-DLX engine guidance (Section 1) — all previously absent from this file.
- No changes were made to the Documentation, Roadmap, Markdown Linting, or Git Rules sections; nothing in the research contradicted them.

**July 22, 2026:** Revised after auditing the codebase against a new web-security research
doc (`Docs/research/ai-assisted-nextjs-security-reference.md` — OWASP Top 10:2025, Next.js/
Drizzle/better-auth-specific CVEs, and AI-generated-code security data) and applying its
cheapest, highest-value fixes live. Notable changes:

- Added six Section 6 rules previously absent: a dependency-patching gotcha (natively-
  compiled sub-dependencies a framework bundles internally, e.g. Next.js's nested `sharp`,
  may need an explicit `overrides` entry even after the top-level package is patched),
  middleware-is-not-an-auth-boundary (CVE-2025-29927), explicit origin/CSRF trust
  configuration (the Vercel-preview `trustedOrigins` gotcha), baseline security headers as a
  standing requirement (nonce-based CSP named as deliberate follow-up work, not a blocker),
  rate-limiting-on-serverless (in-memory vs. shared-store reality), and treating AI-generated
  code as unaudited by default (a security self-review loop + a package-hallucination
  caution).
- Concretely applied this pass to the codebase in the same session: fixed a red CI
  `npm audit --audit-level=high` gate (`sharp`/`brace-expansion` CVEs), added the
  `trustedOrigins` wildcard for Vercel previews in `auth.ts`, and shipped the baseline
  security headers via `next.config.ts`.
- Upstash-backed rate-limit storage and the nonce-based CSP were deliberately tabled for a
  dedicated future security pass (tracked in `Docs/roadmap.md`'s backlog) rather than
  implemented now — noted here so the gap stays visible, not silent.
- No changes to the Documentation, Roadmap, Markdown Linting, or Git Rules sections.

**July 31, 2026:** Added two new top-level rule sections and imported a supporting research
doc, ahead of the daily restructure + next two puzzle types. Notable changes:

- **New `## Pre-Merge / Pre-PR Checklist`** — a single ordered gate (small slice → doc audit →
  benchmarks + tests → code review → merge) that consolidates rules previously scattered across
  Documentation Rules and Sections 3–4. Its weighting is evidence-based (defect-finding onto
  tests/types/automation; human review reserved for authz, business/economy invariants,
  AI-logic verification, and migration safety), drawn from the new
  `Docs/research/solo-dev-ai-qa-code-review-playbook.md`. Names a deferred "Solo-dev QA
  hardening" track (PR template + branch protection, AI reviewer, axe/Lighthouse CI,
  property-based tests, mutation testing, gitleaks) tracked in `Docs/roadmap.md`, not required
  per-PR today.
- **New `## Living Planning Docs Rules`** — planning/impl docs in `Docs/` are living,
  self-contained handoff documents: repo-resident, background + research links front-loaded, a
  numbered step list with a step-log (process / learnings / blockers) appended as each step
  lands. Folded into the pre-PR doc audit.
- **New `## Build Log (Devlog) Rule`** — when we ship something big (feature, meaningful
  refactor, or a notable discovery/learning), write a narrative build-log entry, published to
  the separate `Biscuit-Website` repo (biscuitlab.net) at `/log`
  (`src/content/log/<slug>.mdx`), not this repo. Show-don't-announce, story-not-changelog,
  GIFs/numbers, weekly-to-biweekly, kept lightweight. Evidence base:
  `Docs/research/devlog-blog-portfolio-strategy.md`.
- Imported two research docs: `Docs/research/solo-dev-ai-qa-code-review-playbook.md` (solo-dev,
  heavy-AI QA/review evidence base) and `Docs/research/devlog-blog-portfolio-strategy.md`
  (portfolio/blog/devlog writing strategy). No changes to Sections 1–7, Markdown Linting, or Git
  Rules.

**July 31, 2026 (later):** Added the **reverse-reference sweep** to the docs-backfill rule
(Documentation Rules) and to step 2 of the Pre-Merge / Pre-PR Checklist. Prompted by a real miss:
the daily restructure passed the mirrored-doc audit and still shipped three stale *live* docs
(`bot.md` and `solve/route.md` naming deleted exports; `social-progression-economy-plan.md` still
advertising the **superseded** daily design as its plan of record). None of their source files were
touched, so file-mirroring structurally could not catch them. The sweep closes that gap: `grep` the
repo for every symbol renamed/removed and every design superseded — including *plan* docs that
"anticipate" what you just built — while explicitly leaving genuinely historical records
(`Docs/archive/*`, dated roadmap entries, completed plans) untouched. No other rules changed.

**August 3, 2026:** Made the pre-merge gate partly *physical*, and fixed the rule that made it
unfollowable. Notable changes:

- **Corrected step 4 of the Pre-Merge / Pre-PR Checklist.** It instructed the agent to "Run the
  `/code-review` skill" — but `/code-review` is **user-triggered and billed**, so an agent cannot
  launch it. An instruction no agent can follow is the likeliest reason that step kept getting
  skipped in practice. Step 4 now names who runs what: an agent runs `/pre-merge` and must state
  outright that the hosted review was NOT run; `/security-review` is agent-invocable and stays
  required for auth/authz/data-access changes.
- **Added `.github/pull_request_template.md`** (Stage 1 of the Solo-dev QA hardening track). Based
  on the draft in `solo-dev-ai-qa-code-review-playbook.md`, extended with the traps this repo has
  actually hit: the Drizzle bare `ADD COLUMN … NOT NULL` migration shape, `npm run build` as a
  separate gate because eslint does not type-check, the reverse-reference doc sweep, and an explicit
  "an agent cannot run `/code-review`" line.
- **Added `/pre-merge`** (`.claude/commands/pre-merge.md`) — an agent-runnable pass over checklist
  steps 1–3 plus this project's own invariants (a slot key is not an identity; randomised inputs
  void `ON CONFLICT DO NOTHING`; retired keys stay readable). Kept deliberately short: the playbook
  cites Braz et al. that *pointing* a reviewer at where to look moves detection, while checklist
  length does not.
- No changes to Sections 1–7, Documentation, Roadmap, Markdown Linting, or Git Rules.

**August 3, 2026 (later):** Gave the pre-merge gate a **memory**. Notable changes:

- **New checklist step 5 — "Log the run"** in `Docs/pre-merge-log.md` (newest first, same PR; merge
  renumbered to step 6), and a matching step 5 in `/pre-merge`. The gate's output previously lived
  only in a chat transcript, so each run started blind and re-derived what the last one already knew.
- **The log carries a standing `Known flaky tests` table, read BEFORE running the suite.** Prompted
  by a concrete cost: on the Step 5 run, deciding that one red test was a *pre-existing* engine flake
  rather than a regression from the diff took ~18 full-suite runs plus isolated timing (median
  261–640 ms solo vs a measured 5738 ms under parallel load, against Vitest's default 5000 ms). That
  is an answer worth paying for once. A test listed there failing does not implicate the diff.
- The log also carries **generalizable lessons phrased as rules** — the first being "a call-history
  assertion in a file with no `mockClear` is presumed vacuous until a deliberately-broken run proves
  otherwise", which came from a real vacuous BOLA assertion caught in the Step 5 review pass.
- Entries are deliberately short (a finding fixed in the same PR gets one line; "lint passed" is not
  worth writing). No changes to Sections 1–7, Documentation, Roadmap, Markdown Linting, or Git Rules.

**August 3, 2026 (docs tidy):** Organized `Docs/` and hardened Section 7 with what the pass taught.

- **Added `Docs/README.md`** as the index — the three-folder rule, every active doc with its status,
  and where a new doc goes. Section 7 now points at it.
- **Archived three completed docs** (`architectural-analysis.md`, `keisan-walkthrough.md`,
  `multi-zone-cutover-fix-summary.md`), each with a dated **Archived** banner rather than a rewrite.
  `architectural-analysis.md` had gone actively misleading: it argued *for* the `src/features/`
  layout, so its "Current State" section described the root-level `app/`/`components/`/`lib/`
  structure it replaced — and Section 7 was still citing it as the example of an *active* doc.
- **New Section 7 rule — live source rationale outranks "completed".** Two finished plans
  (`kenken-implementation-plan.md`, `multi-zone-migration-plan.md`) are cited by live code comments
  in `sudoku.ts`, `human-solver.ts`, `next.config.ts`, `auth.ts` and `base-path.ts` as the reason
  that code looks the way it does. Archiving them would have broken those links, and a docs-only
  grep would never have revealed it — hence the rule to grep `src/` and `*.config.ts` before
  archiving. Also codified: never rewrite an archived doc, and fix a moved doc's *internal* links
  (its depth changed) as well as inbound ones.
- Fixed a stale banner: `multi-zone-migration-plan.md` still read "draft / not yet applied" months
  after it shipped. Original text preserved inline.
<!-- END:update-log -->
