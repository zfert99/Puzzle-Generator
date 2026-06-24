# GitHub Repository Setup

## 1. "About" Description

*Click the gear icon ⚙️ next to the "About" section on your repository's right sidebar and paste this:*

> A modern Next.js web app that generates print-ready Sudoku puzzle books in PDF format, powered by a custom logical deduction engine guaranteeing human-solvable "Expert" puzzles.

---

## 2. GitHub Release Notes (v1.0.0)

*Go to **Releases** > **Draft a new release**. Create a new tag (e.g., `v1.0.0`), set the title, and paste the markdown below into the description box.*

**Release Title:** v1.0.0 - The Logic Engine Update

### Description Box

## What's New

We've completely overhauled how our Sudoku puzzles are generated and verified. Unlike traditional brute-force generators that can create puzzles requiring blind guessing, **v1.0.0 introduces the `HumanSolver`**—a pure logical deduction engine.

This guarantees that every generated puzzle, no matter how difficult, can actually be solved logically by a human.

### 🧠 The `HumanSolver` Engine

The generator now verifies "Expert" puzzles by running them through sophisticated human strategies at a blistering ~0.38ms per solve (over 2,500 solves per second):

- **Basic:** Naked Singles & Hidden Singles
- **Intermediate:** Naked Pairs, Hidden Pairs, & Pointing Pairs
- **Advanced:** X-Wing, Swordfish, Y-Wing, & XYZ-Wing

### ⚡ Other Features & Optimizations

- **Custom PDF Books:** Request exact quantities of Easy, Medium, Hard, and Expert puzzles, seamlessly bundled into a single print-ready PDF download.
- **Auto-Logging Benchmarks:** Integrated local `.ts` benchmarking scripts (`benchmark.ts` and `benchmark-human-solver.ts`) that append runtimes directly to a markdown log file.
- **Enhanced Documentation:** Extensive TypeScript JSDoc commenting and inline markdown pseudocode to help new contributors understand the logical solver patterns.

## Quick Start

```bash
npm install
npm run dev
```

## Running Benchmarks Locally

Test the raw logical solve speed against a notoriously difficult Expert puzzle:

```bash
npx tsx scripts/benchmark-human-solver.ts
```
