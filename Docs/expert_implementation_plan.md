# Goal Description

The goal is to implement advanced Sudoku solving strategies (X-Wings, Y-Wings, and Alternating Inference Chains) to ensure that generated "Expert" puzzles actually require these human-like logical deductions rather than just being sparse grids that are solved by brute-force guessing. We will also create a new Git branch to safely isolate this complex refactoring.

## User Review Required

> [!WARNING]
> Building a human-like solver from scratch is extremely complex, specifically implementing Alternating Inference Chains (AICs). It will require us to track "candidates" (pencil marks) for every cell and update them after every deduction. 
> 
> The plan is to create a separate `human-solver.ts` module to avoid breaking the existing lightweight backtracking solver. The `generateSudoku` function will use the human solver specifically to validate 'Expert' puzzles. 

## Open Questions

> [!IMPORTANT]
> 1. **Performance vs Complexity**: Advanced techniques like AICs are computationally expensive to detect. If a generated puzzle *doesn't* require them after digging a hole, we have to keep digging and checking. This could significantly slow down PDF generation. Are you okay with the `/api/generate` route potentially taking 10-20+ seconds for Expert puzzles?
> 2. **Library vs Custom**: Do you want me to write the candidate-elimination engine and X-Wing/Y-Wing logic entirely from scratch, or would you be open to importing a lightweight specialized Sudoku-solving NPM package to handle the advanced graph logic?

## Proposed Changes

### Version Control
- Create and switch to a new git branch: `feature/expert-strategies`

---

### Puzzle Engine

#### [NEW] [human-solver.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/human-solver.ts)
Create a new engine focused on candidate tracking and logical deduction:
- **State Management**: Track a 9x9 grid of `Set<number>` for pencil marks.
- **Basic Techniques**: Naked Singles, Hidden Singles, Intersection Removal (Pointing Pairs).
- **Advanced Techniques**: X-Wing, Y-Wing (Bent Bivalue), Simple Coloring, and basic Alternating Inference Chains.
- **Evaluation Loop**: A function that applies techniques in order of difficulty. It will return an object detailing which strategies were forced to be used.

#### [MODIFY] [sudoku.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/sudoku.ts)
Update the `applyExhaustiveDigger` logic to utilize the new human solver. 
- Instead of just checking if the puzzle has 1 solution (which backtracking does), we will verify: `canHumanSolve(grid)` AND `requiresAdvancedStrategy(grid)`.
- If a dug hole creates a puzzle that requires guessing (i.e., the human solver gets stuck), we revert the hole.

#### [MODIFY] [sudoku.md](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/sudoku.md)
Update the documentation to reflect the new architecture involving `human-solver.ts`.

#### [NEW] [human-solver.md](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/human-solver.md)
Create plain-English documentation explaining the advanced strategies (X-Wing, Y-Wing, etc.) per our project rules.

---

## Verification Plan

### Automated Tests
- Create `human-solver.test.ts` with known puzzle layouts that *specifically* require an X-Wing or Y-Wing to proceed, and assert that the solver successfully identifies and applies the strategy.
- Ensure the existing `route.test.ts` still passes to verify backwards compatibility.

### Manual Verification
- Generate an 'Expert' puzzle via the UI and manually run it through an external solver (like SudokuWiki) to verify its difficulty rating accurately hits "Diabolical/Expert".
