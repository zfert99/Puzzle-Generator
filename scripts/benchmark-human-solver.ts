import { HumanSolver } from '../lib/puzzle-engine/human-solver';

// A known expert-level puzzle (requires advanced strategies to solve)
// Note: This puzzle is notoriously difficult and requires multiple advanced techniques.
const expertGrid = [
  [8, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 3, 6, 0, 0, 0, 0, 0],
  [0, 7, 0, 0, 9, 0, 2, 0, 0],
  [0, 5, 0, 0, 0, 7, 0, 0, 0],
  [0, 0, 0, 0, 4, 5, 7, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 3, 0],
  [0, 0, 1, 0, 0, 0, 0, 6, 8],
  [0, 0, 8, 5, 0, 0, 0, 1, 0],
  [0, 9, 0, 0, 0, 0, 4, 0, 0]
];

async function main() {
  const iterations = 5000;

  console.log(`Running HumanSolver on an expert puzzle for ${iterations} iterations...`);

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const solver = new HumanSolver(expertGrid);
    solver.solve();
  }

  const end = performance.now();
  const timeMs = end - start;

  console.log(`\nTotal time: ${timeMs.toFixed(2)} ms`);
  console.log(`Average time per solve: ${(timeMs / iterations).toFixed(2)} ms`);
  console.log(`Solves per second: ${Math.round(1000 / (timeMs / iterations))}`);
}

main();
