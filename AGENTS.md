# Agent Rules
<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:documentation-rules -->
## Documentation Rules

Whenever we generate a new file, create a corresponding markdown file (Plain English Pseudocode) for it.
Whenever we edit an existing file, update its corresponding markdown file to reflect the changes.
<!-- END:documentation-rules -->

<!-- BEGIN:roadmap-rules -->
## Roadmap Rules

Whenever a roadmap phase is started, completed, or its scope changes:

- Update `Docs/roadmap.md` to reflect the current status and any new details.
- Update the simplified roadmap table in `README.md` (change the Status column: 📋 Planned → 🚧 In Progress → ✅ Done).
<!-- END:roadmap-rules -->

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
- **CI Security Scanning:** Wire up free-tier tooling before launch — GitHub CodeQL (SAST) and Dependabot (SCA) are free on public/private repos, `npm audit`/`pnpm audit` catch known-vulnerable dependencies at zero cost. None of this replaces the manual review called out above, but it's a reasonable free baseline for a solo project.

### 7. Documentation Standards

- **Naming Convention:** All documentation files must explicitly use `lowercase-kebab-case.md` for their filenames.
- **Organization:**
  - Root `Docs/` directory: Active, living documents (e.g., `roadmap.md`, `architectural-analysis.md`).
  - `Docs/archive/` directory: Historical logs, past implementation plans, and phase walkthroughs.
  - `Docs/research/` directory: Standardized, deeply-researched topic documents.
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
<!-- END:update-log -->
