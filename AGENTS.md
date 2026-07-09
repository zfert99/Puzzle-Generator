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

- **Domain-Driven Architecture:** Maintain a feature-based architecture under the `src/features/` directory rather than grouping purely by technical type (e.g., `src/features/engine/`, `src/features/pdf-generation/`). Leave `src/components/` strictly for dumb, highly reusable UI elements.
- **Separation of Concerns (SRP):** The UI components must remain entirely decoupled from the core puzzle generation logic.
  - Fragment large monolithic UI components into smaller composable sub-components.
  - Extract data-fetching and complex state logic out of components into custom hooks.
  - API routes should act merely as controllers; move generation logic into dedicated service files.
- **Colocation:** Files that change together should be stored together. Tests (e.g., `.test.ts`) and benchmarking scripts must be placed directly beside the feature modules they test, not in a generic global folder.
- **The Engine:** The `src/features/engine/` directory contains pure, highly-optimized TypeScript. It relies on logical deduction (`HumanSolver`), not just brute-force backtracking. Keep `HumanSolver` as a class (since it's a stateful complex entity) but strictly avoid introducing inheritance (`extends`).

### 2. Code Documentation Philosophy (CRITICAL)

- **Mirroring:** Every core logic file in `src/features/engine/` (e.g., `human-solver.ts`, `sudoku.ts`) and its subdirectories has a mirrored `.md` file (e.g., `human-solver.md`).
- **Syncing:** Whenever you modify a `.ts` file, you **MUST** simultaneously update its corresponding `.md` file.
- **Explain the "Why":** The `.md` files contain "Plain English Pseudocode". Ensure that our mirrored `.md` files focus on explaining *why* certain algorithmic paths were chosen, rather than just translating the `for` loops into English. For every method, write the English explanation of the logic/strategy *immediately above* the pseudocode block.
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
- **Behavioral UI Testing:** UI tests must follow the Arrange, Act, Assert (AAA) pattern. Use accessibility-first queries (`getByRole`, `getByLabelText`) from React Testing Library to test user behavior, not implementation details.
- **Unit Tests:** After any logic or API route changes, run `npx jest`. All tests must pass before concluding your task.
- **Linting:** Run `npm run lint` to catch TypeScript/React issues.
- **Markdown Linting:** Ensure all markdown files (`.md`) follow strict markdown linting rules (proper heading hierarchy, no trailing spaces, explicit code block languages) by running `npx markdownlint-cli "**/*.md"`.

### 5. Telemetry & Profiling

- **Structured Logging:** Production telemetry must use structured JSON logging (e.g., Pino) via Next.js `instrumentation.ts` or custom wrappers. Do NOT use raw `console.log` for business logic or errors. Emitting "wide events" is preferred over scattered logs.
- **Microbenchmarking Warning:** Be cautious of V8 JIT over-optimization in synthetic loops. Benchmarks should use randomized inputs/grids to prevent V8 from caching object shapes or eliminating dead code, ensuring realistic macroscopic profiling.

### 6. Security & Infrastructure (CRITICAL)

- **Cryptographic Storage:** Never use deprecated hashes (MD5, SHA-1). Passwords must be hashed using memory-hard algorithms like **Argon2id** or **bcrypt** (with SHA-256 pre-hashing to bypass the 72-byte limit) combined with a 16-byte salt.
- **Session Management:** NEVER store JWTs or sensitive session tokens in `localStorage` or `sessionStorage` (vulnerable to XSS). Implement the "Hybrid Token Architecture": short-lived access tokens in memory, and long-lived refresh tokens stored exclusively in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Authorization (BOLA Prevention):** Do not solely verify authentication ("is the user logged in?"). Always verify authorization ownership ("does the user own this specific record?") at the data-access layer using strict `WHERE` clauses or RBAC/ABAC models.
- **Database Hardening:** Exclusively use parameterized queries (via a type-safe ORM like Prisma or Drizzle) to eliminate SQL injection vulnerabilities. Enforce the principle of least privilege for the database connection.

### 7. Documentation Standards

- **Naming Convention:** All documentation files must use `lowercase-kebab-case.md` for their filenames.
- **Organization:** Active, living documents (e.g., `roadmap.md`) belong in the root `Docs/` directory. Historical logs (implementation plans, walkthroughs) must be archived in `Docs/archive/`. Research documents belong in `Docs/research/`.
<!-- END:codebase-management-rules -->

<!-- BEGIN:git-rules -->
## Git Rules

- **Committing and Pushing Code:** ONLY run `git commit` or `git push` when the user explicitly requests it (e.g., "commit", "push", "commit push"). Do NOT commit code automatically or unprompted.
<!-- END:git-rules -->
