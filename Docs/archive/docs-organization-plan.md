# Docs Restructuring & Naming Standardization Plan

This plan aims to clean up the `Docs/` directory. Currently, we have a mix of `lowercase_snake_case`, `Title Case With Spaces`, and `Mixed_Case_Snake_Case`. We also have many historical implementation plans cluttering the root directory.

## Proposed Changes

### 1. Root `Docs/` Directory (Living Documents)

We will keep only the active, living documents here, standardized to kebab-case.

#### [NEW] [Docs/architectural-analysis.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/architectural-analysis.md)

#### [NEW] [Docs/comprehensive-refactor-walkthrough.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/comprehensive-refactor-walkthrough.md)

#### [DELETE] [Docs/architectural-analysis.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/architectural-analysis.md)

#### [DELETE] [Docs/comprehensive-refactor-walkthrough.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/comprehensive-refactor-walkthrough.md)

*(Note: `roadmap.md` is already correct and will stay)*

### 2. `Docs/research/` Directory (Standardized Titles)

The research folder contains very long file names with spaces. We will shorten and standardize them.

- `Building a PDF Puzzle Generator.md` → `pdf-generation.md`
- `Comprehensive_Website_Security_Vulnerability_Mitigation.md` → `web-security-mitigation.md`
- `Enterprise Architecture, Testing, and Telemetry in React and Next.js Applications.md` → `enterprise-architecture.md`
- `Expert Sudoku Strategies Document.md` → `expert-sudoku-strategies.md`
- `Next.js Portfolio Hosting Options.md` → `portfolio-hosting.md`
- `Nonogram Puzzle Creation and Solving.md` → `nonograms.md`
- `Programmatic PDF Generation With Links.md` → `programmatic-pdfs.md`
- `Puzzle Website Strategy Analysis.md` → `puzzle-website-strategy.md`
- `Sudoku Puzzle Generation and Solving.md` → `sudoku-generation.md`
- `Sudoku_Minis_Research_Guide.md` → `sudoku-minis.md`
- `Web_Development_React_Nextjs_Best_Practices.md` → `web-best-practices.md`

### 3. `Docs/archive/` Directory (Historical Logs)

We will create this new directory and move the 14 historical planning/walkthrough files here to declutter the root. They will also be renamed to kebab-case (e.g., `Docs/archive/expert-implementation-plan.md`).

### 4. Link Updates

We will run a global search and replace across the entire repository to update all Markdown links and `file:///` paths that referenced the old names.
