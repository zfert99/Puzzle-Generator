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
- **Separation of Concerns:** The UI (React/Next.js in `app/` and `components/`) must remain entirely decoupled from the core puzzle generation logic (`lib/puzzle-engine/`). 
- **The Engine:** The `lib/puzzle-engine/` directory contains pure, highly-optimized TypeScript. It relies on logical deduction (`HumanSolver`), not just brute-force backtracking.

### 2. The Pseudocode Markdown Files (CRITICAL)
- **Mirroring:** Every core logic file in `lib/puzzle-engine/` (e.g., `human-solver.ts`, `sudoku.ts`) has a mirrored `.md` file (e.g., `human-solver.md`).
- **Syncing:** Whenever you modify a `.ts` file, you **MUST** simultaneously update its corresponding `.md` file. 
- **Format:** The `.md` files contain "Plain English Pseudocode". For every method, write the English explanation of the logic/strategy *immediately above* the pseudocode block.

### 3. Performance & Benchmarks
- **Speed is Key:** The puzzle generator relies on running the solver dozens of times per second. Performance regressions are unacceptable.
- **When to Run:** Whenever you modify `human-solver.ts`, `sudoku.ts`, or any core solving logic, you MUST run the tiered benchmarks:
  ```bash
  npx tsx scripts/benchmark-human-solver.ts
  ```
- **Logging:** The benchmark script automatically appends results to `scripts/benchmark-logs.md`. Review these logs to ensure the 'Basic', 'Advanced', and 'Extreme' tiers maintain their expected performance (e.g., Basic < 0.3ms, Extreme < 10ms).

### 4. Testing & Linting
- **Unit Tests:** After any logic or API route changes, run `npx jest`. All tests must pass before concluding your task.
- **Linting:** Run `npm run lint` to catch TypeScript/React issues.
- **Markdown Linting:** Ensure all markdown files (`.md`) follow strict markdown linting rules (proper heading hierarchy, no trailing spaces, explicit code block languages). 
<!-- END:codebase-management-rules -->
