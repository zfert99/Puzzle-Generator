# Benchmark: Human Solver

This script measures the performance of our pure logical deduction engine (`human-solver.ts`) across different difficulty tiers (`basic`, `advanced`, and `extreme`). This ensures that puzzle generation at each difficulty level remains highly performant.

## What it does

It runs the `HumanSolver` class against a notoriously difficult, known Expert-level Sudoku grid across three separate benchmark profiles:

1. **Basic Tier (`maxTier: 'basic'`)**: Tests how quickly the solver evaluates easy/medium/hard puzzles or identifies when advanced strategies are needed (5,000 iterations).
2. **Advanced Tier (`maxTier: 'advanced'`)**: Tests the speed of solving Expert-level puzzles using advanced strategies like X-Wings and Y-Wings (5,000 iterations).
3. **Extreme Tier (`maxTier: 'extreme'`)**: Tests the speed of the full solver suite, including computationally expensive extreme strategies like W-Wings, ALS-XZ, and Alternating Inference Chains (1,000 iterations).

For each tier, it calculates:

- The total time taken to run all iterations
- The average time taken per solve/evaluation
- The estimated number of solves per second

## How to run

Execute the script from the root of the project using `tsx` (which is standard for executing TypeScript files directly in modern Node environments):

```bash
npx tsx scripts/benchmark-human-solver.ts
```

## Expected Results

With the tiered early-exit optimization and helper improvements, typical performance on a modern CPU should be approximately:

- **Basic Tier**: **~0.23 ms** per evaluation (~4,300 solves/sec)
- **Advanced Tier**: **~0.39 ms** per solve (~2,600 solves/sec)
- **Extreme Tier**: **~7.72 ms** per solve (~130 solves/sec)

This confirms that the highly complex Extreme strategies do not impact the blazingly fast generation speed of Easy through Expert puzzles.
