/**
 * A hand-drawn 7×7 Kakuro layout for the looks-only board (plan slice V0) — shape only, no
 * clues and no solution. One string per interior row: `.` is a white (fillable) cell, `#` a
 * black one. Interior cells only (plan decision D2): the clue gutter along the top and left
 * is added by the renderer, so `layout.length` stays the puzzle's named size.
 *
 * Drawn to the plan's layout rules (D9) so the picture is a plausible real board rather than
 * a random scatter: 180° rotationally symmetric, one connected white region, every white cell
 * in an across AND a down run of length 2–7, and 32 white cells (the published ceiling for a
 * uniquely-solvable 7×7 is 34).
 */
export const KAKURO_SAMPLE_7X7: readonly string[] = [
  '##..###',
  '#......',
  '...#...',
  '..###..',
  '...#...',
  '......#',
  '###..##',
];
