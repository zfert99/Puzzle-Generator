// @vitest-environment node
import { HumanSolver } from './human-solver';
import { generateSudoku } from './sudoku';

describe('HumanSolver Engine', () => {
  it('can solve a basic puzzle', () => {
    // We'll generate a real puzzle using the generator (which uses the solver internally)
    const puzzle = generateSudoku('easy');
    
    // Now we instantiate our own solver to verify it works
    const solver = new HumanSolver(puzzle.grid);
    
    // An easy puzzle should only require basic strategies
    const result = solver.solve({ maxTier: 'basic' });
    
    expect(result.solved).toBe(true);
    expect(result.requiresAdvanced).toBe(false);
    expect(result.requiresExtreme).toBe(false);
  });

  it('can solve an advanced puzzle', () => {
    const puzzle = generateSudoku('expert');
    const solver = new HumanSolver(puzzle.grid);
    
    // Expert requires advanced tier
    const result = solver.solve({ maxTier: 'advanced' });
    
    expect(result.solved).toBe(true);
  });
});
