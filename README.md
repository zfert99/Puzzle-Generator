# Puzzle Generator

A modern Next.js web application that generates print-ready Sudoku puzzle books in PDF format.

Unlike typical brute-force generators, this project features a custom-built, purely logical `HumanSolver` engine. This guarantees that even the most "Expert" level puzzles generated can actually be solved by a human without ever needing to blindly guess.

## Features

- **Custom Puzzle Books**: Choose exactly how many Easy, Medium, Hard, and Expert puzzles you want in your book.
- **PDF Generation**: Instantly compiles your selected puzzles into a clean, print-ready PDF.
- **Logical Solver Engine (`HumanSolver`)**: An advanced deduction engine capable of performing sophisticated Sudoku strategies:
  - Naked Singles & Hidden Singles
  - Naked Pairs & Hidden Pairs
  - Pointing Pairs / Box-Line Reduction
  - X-Wing & Swordfish
  - Y-Wing & XYZ-Wing
  - W-Wing, Almost Locked Sets (ALS-XZ), & Alternating Inference Chains (AICs)
- **High Performance**: Highly optimized grid scanning capable of verifying thousands of puzzle states per second.

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the UI.

## Testing & Benchmarks

The project includes a robust Jest test suite and benchmarking tools to measure the performance of the logical solver engine.

### Run Tests

To run the automated test suite:

```bash
npm test
```

### Run Benchmarks

There are two benchmark scripts provided. When executed, they automatically append their performance results (along with the current Git commit hash and timestamp) to `scripts/benchmark-logs.md`.

To test the pure logical solving speed on a notoriously difficult Expert puzzle:

```bash
npx tsx scripts/benchmark-human-solver.ts
```

To test the entire end-to-end generation pipeline (generating 10 completely random Expert puzzles from scratch):

```bash
npx tsx scripts/benchmark.ts
```

## How It Works

1. **Generation**: The `generateSudoku` function first creates a valid, fully solved 9x9 grid.
2. **Digging**: It then begins removing numbers ("digging holes") one by one to create a playable puzzle.
3. **Verification**: After *every single hole is dug*, the puzzle is passed to the `HumanSolver`. The solver attempts to complete the puzzle using only logical human deduction. If the solver gets stuck (meaning a human would be forced to guess), the hole is filled back in, and the generator tries another spot.
4. **Difficulty Rating**: The difficulty of the puzzle is determined by the most advanced logical strategy the `HumanSolver` had to use to verify it.

## Roadmap

We're evolving from a PDF generator into a full interactive puzzle platform. See the [full roadmap](Docs/roadmap.md) for detailed plans.

| Phase | What | Track | Status |
| :---: | --- | --- | :---: |
| **1** | **Extreme Difficulty** 💀🔥 — W-Wing, ALS, AICs | 🧮 Engine | ✅ Done |
| **2** | **Mini Puzzles** — 4×4 & 6×6 grids | 🧮 Engine + 🎨 UI | 📋 Planned |
| **3** | **Interactive Board** — Play in the browser | 🎨 Frontend | 📋 Planned |
| **4** | **Dailies & Leaderboards** — DB, Auth, Speed Runs | 🗄️ Infrastructure | 📋 Planned |
| **5** | **Strategy Courses** — Visual solver teaching | 🎨 UI + 🧮 Engine | 📋 Planned |

> Phases 1 & 2 can run in parallel. Phases 4 & 5 both depend on Phase 3.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Jest (Testing)
