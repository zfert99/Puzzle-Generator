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
- **Next.js Runtime Declarations (AI Pitfall):** Explicitly require `export const runtime = 'nodejs';` in App Router API routes (`route.ts`) that rely on native Node modules (e.g., `fs`, `stream`, `pdfkit`). Without this, Next.js may attempt Edge runtime deployment, causing crashes.
- **Separation of Concerns (SRP):** The UI components must remain entirely decoupled from the core puzzle generation logic.
  - Fragment large monolithic UI components into smaller composable sub-components. However, avoid premature "Component File Explosion." If a sub-component is only used by one parent, it belongs in the exact same file or a colocated private folder, not a global components directory.
  - Extract data-fetching and complex state logic out of components into custom hooks.
  - API routes should act merely as controllers; move generation logic into dedicated service files.
- **Colocation & Import Aliases:** Files that change together should be stored together. Tests and benchmarking scripts must be placed directly beside the feature modules they test. Require the use of module path aliases (e.g., `@/features/`) instead of deep, fragile relative imports (e.g., `../../../`) to improve refactoring stability.
- **File Naming & Component Discovery:** Explicitly ban the `index.ts` pattern for components (e.g., use `Avatar/Avatar.tsx` instead of `Avatar/index.ts`) to ensure IDE searchability.
- **UI Composition:** Explicitly mandate the use of the `children` prop and "named slots" for building complex React layouts, completely avoiding deep component class inheritance.
- **The Engine:** The `src/features/engine/` directory contains pure, highly-optimized TypeScript. It relies on logical deduction (`HumanSolver`), not just brute-force backtracking. Keep `HumanSolver` as a class (since it's a stateful complex entity) but strictly avoid introducing inheritance (`extends`).

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

### 4. Testing & Linting

- **Strict Colocation:** Test files MUST reside immediately adjacent to the source code they are validating (e.g., `PuzzleForm.test.tsx` next to `PuzzleForm.tsx`). Global `tests/` folders are banned except for E2E tests.
- **Jest Hybrid Environments (AI Pitfall):** Use the `/** @jest-environment jsdom */` pragma at the top of React UI test files. The global Jest environment must remain `node` to prevent `Request` polyfill collisions in Next.js API route tests.
- **Mocking Boundaries:** Testing mocks must only occur at the boundaries of the application (e.g., network requests, external APIs), never mocking internal application modules, to preserve test realism.
- **Behavioral UI Testing:** UI tests must follow the Arrange, Act, Assert (AAA) pattern. Use accessibility-first queries (`getByRole`, `getByLabelText`) from React Testing Library to test user behavior, not implementation details.
- **Unit Tests:** After any logic or API route changes, run `npx jest`. All tests must pass before concluding your task.
- **Linting:** Run `npm run lint` to catch TypeScript/React issues.
- **Markdown Linting:** Ensure all markdown files (`.md`) follow strict markdown linting rules (proper heading hierarchy, no trailing spaces, explicit code block languages) by running `npx markdownlint-cli "**/*.md"`.

### 5. Telemetry & Profiling

- **Structured Logging:** Production telemetry must use structured JSON logging (e.g., Pino) via Next.js `instrumentation.ts` or custom wrappers. Do NOT use raw `console.log` for business logic or errors. Emitting "wide events" is preferred over scattered logs.
- **Microbenchmarking Warning:** Be cautious of V8 JIT over-optimization in synthetic loops (Hidden Class Caching, Dead Code Elimination, Inline Caching). Benchmarks should use randomized inputs/grids to prevent V8 from caching object shapes or eliminating dead code, ensuring realistic macroscopic profiling.
- **V8 Deoptimization (AI Pitfall):** AI-generated code frequently produces polymorphic functions (functions accepting varying input types). In high-performance areas like the puzzle engine, functions must remain monomorphic (consistent input shapes) to prevent V8 engine deoptimization and potential DoS attack surfaces.

### 6. Security & Infrastructure (CRITICAL)

- **Cryptographic Storage:** Never use deprecated hashes (MD5, SHA-1). Passwords must be hashed using memory-hard algorithms like **Argon2id** or **bcrypt** (with SHA-256 pre-hashing to bypass the 72-byte limit) combined with a 16-byte salt.
- **Session Management:** NEVER store JWTs or sensitive session tokens in `localStorage` or `sessionStorage` (vulnerable to XSS). Implement the "Hybrid Token Architecture": short-lived access tokens in memory, and long-lived refresh tokens stored exclusively in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Authorization & BOLA (AI Pitfall):** Do not solely verify authentication ("is the user logged in?"). Always verify authorization ownership ("does the user own this specific record?") at the data-access layer using strict `WHERE` clauses or RBAC/ABAC models. AI tends to hallucinate CRUD endpoints that forget to verify resource ownership.
- **Database Hardening:** Exclusively use parameterized queries (via a type-safe ORM like Prisma or Drizzle) to eliminate SQL injection vulnerabilities. Enforce the principle of least privilege for the database connection.
- **Prompt Injection Defense:** Any untrusted user input passed into future AI logic must be rigorously sanitized and architecturally isolated to prevent Prompt Injection attacks.

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
