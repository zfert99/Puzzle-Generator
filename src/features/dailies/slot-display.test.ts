import { describe, expect, it } from 'vitest';
import { reconcileSelectedKey, slotLabel, type DailySlotInfo } from './slot-display';

const slot = (key: string, variant: DailySlotInfo['variant'], difficulty: string, gridSize: number, section: DailySlotInfo['section']): DailySlotInfo =>
  ({ key, variant, difficulty, gridSize, section });

/** A representative day: 3 standard rungs (hard/expert/extreme) + the 3 mini tiers. */
const DAY: DailySlotInfo[] = [
  slot('hard', 'killer', 'hard', 9, 'standard'),
  slot('expert', 'calc', 'expert', 9, 'standard'),
  slot('extreme', 'classic', 'extreme', 9, 'standard'),
  slot('mini-easy', 'killer', 'easy', 4, 'mini'),
  slot('mini-medium', 'calc', 'medium', 4, 'mini'),
  slot('mini-hard', 'classic', 'hard', 4, 'mini'),
];

describe('reconcileSelectedKey', () => {
  /**
   * Regression: the archive seeded its selection to `'easy'` and never reconciled it against the
   * date being viewed. Only 3 of the 5 standard rungs are drawn per day, so on any day `easy`
   * didn't roll the page opened on "No daily puzzle for <date> (easy)".
   */
  it('falls back to the first real board when the current key is not drawn that day', () => {
    expect(reconcileSelectedKey(DAY, 'easy')).toBe('hard');
    expect(reconcileSelectedKey(DAY, 'medium')).toBe('hard');
  });

  it('keeps a still-valid key so changing dates does not yank the user off their board', () => {
    expect(reconcileSelectedKey(DAY, 'expert')).toBe('expert');
    expect(reconcileSelectedKey(DAY, 'mini-hard')).toBe('mini-hard');
  });

  it('leaves the selection alone before any slots have loaded', () => {
    expect(reconcileSelectedKey([], 'easy')).toBe('easy');
  });

  it('handles a pre-restructure date, whose keys are the retired type-encoding ones', () => {
    const legacyDay = [
      slot('killer-hard', 'killer', 'hard', 9, 'standard'),
      slot('mini6-easy', 'classic', 'easy', 6, 'mini'),
    ];
    expect(reconcileSelectedKey(legacyDay, 'hard')).toBe('killer-hard'); // 'hard' isn't in that day
    expect(reconcileSelectedKey(legacyDay, 'mini6-easy')).toBe('mini6-easy');
  });
});

describe('slotLabel', () => {
  it('composes difficulty and type for a standard board', () => {
    expect(slotLabel(DAY[0])).toBe('Hard · Killer');
    expect(slotLabel(DAY[1])).toBe('Expert · Keisan');
  });

  it('includes the grid size for minis, so same-tier boards stay distinguishable', () => {
    expect(slotLabel(DAY[3])).toBe('Easy 4×4 · Killer');
    expect(slotLabel(slot('mini-hard', 'calc', 'hard', 6, 'mini'))).toBe('Hard 6×6 · Keisan');
  });
});
