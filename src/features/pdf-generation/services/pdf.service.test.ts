// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generatePuzzlePDF } from './pdf.service';
import { generatePuzzleBatch } from '@/features/engine/services/generation.service';

/**
 * Replaces the deleted ad-hoc `tests/test-pdfkit.js` spike scripts with a real,
 * colocated behavioural test. We drive the public `generatePuzzlePDF` end-to-end
 * with genuinely generated puzzles (no internal mocks) and assert the output is a
 * well-formed PDF binary.
 */
describe('generatePuzzlePDF', () => {
  it('returns a Buffer whose bytes start with the %PDF magic header', async () => {
    const puzzles = generatePuzzleBatch({ easy: 1, medium: 1 });

    const pdf = await generatePuzzlePDF(puzzles);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('produces a valid PDF even for a mix that includes mini grids', async () => {
    const puzzles = generatePuzzleBatch({ easy: 1, gridSize: 4 });

    const pdf = await generatePuzzlePDF(puzzles);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
