# Interactive PDF Puzzle Generator

A very simple, premium-looking web application that allows users to generate custom PDF puzzle books. The user can select a puzzle type (starting with Sudoku), choose difficulty levels, and specify the quantity of puzzles per difficulty. The final output will be a dynamically generated, downloadable PDF featuring clickable internal links for easy navigation between the puzzles and an answer key page at the end.

## Proposed Architecture Based on Research

Based on the research documents provided (`Building a PDF Puzzle Generator` and `Programmatic PDF Generation With Links`), the recommended approach is a **Server-Side Node.js architecture**. This avoids client-side memory exhaustion and guarantees consistent performance for complex recursive backtracking and PDF rendering.

- **Framework**: **Next.js (App Router)**. This allows us to build a visually stunning frontend while utilizing serverless API routes (`/api/generate-pdf`) to handle the heavy computational puzzle generation and PDF creation.
- **PDF Generation Engine**: **PDFKit**. As the research highlights, PDFKit is exceptionally performant for drawing geometric vector grids and features a built-in, high-level API for creating complex interactive elements (like internal hyperlinks `doc.addNamedDestination()` and `goTo` options).
- **Puzzle Generation**: Implement a procedural puzzle engine using recursive backtracking for matrix generation and human-simulated heuristic grading for accurate difficulty (Beginner, Medium, Expert) as outlined in the research.
- **Frontend Design**: Vanilla CSS with a focus on modern, rich aesthetics (glassmorphism, vibrant palettes, smooth micro-animations, and a sleek dark mode) to ensure a premium user experience.

## Open Questions

> [!IMPORTANT]
> - **Puzzle Types**: Should we focus strictly on Sudoku for the initial minimum viable product, or would you like to include another puzzle type (e.g., Nonograms, Mazes) from the start?
> - **Aesthetics**: Do you have a preferred color palette or specific visual theme (e.g., playful, minimalist, neon, elegant)?

## Proposed Changes

---

### Frontend Components

#### [NEW] `app/page.tsx`
The main landing page featuring a dynamic form to select puzzle type, difficulties, and quantities.

#### [NEW] `app/globals.css`
A robust CSS design system implementing a premium aesthetic with custom CSS variables, hover effects, and modern typography.

#### [NEW] `components/PuzzleForm.tsx`
An interactive component handling state for user selections and triggering the PDF generation API.

---

### Backend / API & Puzzle Logic

#### [NEW] `app/api/generate/route.ts`
The server-side API endpoint that accepts the configuration, invokes the puzzle engine, generates the PDF in-memory using PDFKit, and streams it back to the client as a `.pdf` download.

#### [NEW] `lib/puzzle-engine/sudoku.ts`
The procedural Sudoku generator utilizing recursive backtracking to generate valid grids, uniquely verify them, and punch holes according to difficulty heuristics.

#### [NEW] `lib/pdf/generator.ts`
The PDFKit rendering logic that iterates through generated puzzles, draws the vector grids, assigns `NamedDestinations` for the answers, and builds the clickable Table of Contents and Answer Key.

## Verification Plan

### Automated Tests
- N/A for MVP, but the Sudoku generator will be verified with unit tests for uniqueness and difficulty grading.

### Manual Verification
- Generate a PDF with multiple difficulties and verify that the puzzles are visually correct.
- Click the internal links (e.g., "Go to Answer") in the generated PDF to ensure they navigate to the precise answer key page and vice versa.
