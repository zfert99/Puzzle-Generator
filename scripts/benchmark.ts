import { generateSudoku } from '../lib/puzzle-engine/sudoku';

async function main() {
  console.log('Generating 10 Expert puzzles...');
  const times: number[] = [];
  
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    generateSudoku('expert');
    const end = Date.now();
    const duration = end - start;
    times.push(duration);
    console.log(`Puzzle ${i + 1}: ${duration}ms`);
  }

  const total = times.reduce((a, b) => a + b, 0);
  const average = total / times.length;

  console.log(`\nTotal time: ${total}ms`);
  console.log(`Average time per Expert puzzle: ${average.toFixed(2)}ms`);
}

main();
