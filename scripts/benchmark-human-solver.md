# Benchmark: Human Solver

This script measures the performance of our pure logical deduction engine (`human-solver.ts`), which is used to guarantee that generated "Expert" puzzles are solvable by a human without brute-force guessing.

## What it does

It runs the `HumanSolver` class against a notoriously difficult, known Expert-level Sudoku grid for 5,000 iterations. It then calculates:

- The total time taken to run all iterations
- The average time taken to logically solve a single expert puzzle
- The estimated number of expert solves per second

## How to run

Execute the script from the root of the project using `tsx` (which is standard for executing TypeScript files directly in modern Node environments):

```bash
npx tsx scripts/benchmark-human-solver.ts
```

## Expected Results

With the recent refactoring and helper optimizations, the solver should be able to logically deduce its way through an Expert puzzle in roughly **~0.3ms** on a modern CPU, allowing it to process approximately **3,000 expert puzzles per second**.
