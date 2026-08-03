import type { Variant } from '@/lib/db/daily-row';

/**
 * Shared shape + labelling for a day's daily slots, used by the `/daily` picker and the
 * leaderboard tabs. The TYPE is no longer encoded in the slot key (it's rolled per day and stored
 * in `daily_puzzles.variant`), so a slot must be labelled from its `(difficulty, variant, size)` —
 * e.g. "Hard · Killer" or "Easy 4×4 · Keisan" — not from the key alone.
 */
export interface DailySlotInfo {
  /** The `daily_puzzles.difficulty` value — a rung (standard) or `mini-<tier>` (mini). */
  key: string;
  variant: Variant;
  /** Engine difficulty rung (e.g. `hard`), already stripped of any `mini-` prefix. */
  difficulty: string;
  gridSize: number;
  section: 'standard' | 'mini';
}

const VARIANT_LABEL: Record<Variant, string> = {
  classic: 'Classic',
  killer: 'Killer',
  calc: 'Keisan',
};

/**
 * Pick a board key that actually exists for the day being viewed. Only 3 of the 5 standard rungs
 * are drawn on any given date, so a fixed default (`'easy'`) or a key carried over from another
 * date can easily name a board this day doesn't have — which surfaced as "No daily puzzle for
 * <date> (easy)". Keeps the current key when it's still valid so switching dates doesn't yank the
 * user off the board they were looking at; otherwise falls back to the day's first board.
 */
export function reconcileSelectedKey(slots: readonly DailySlotInfo[], current: string): string {
  if (slots.length === 0) return current; // nothing loaded yet — leave the selection alone
  return slots.some((s) => s.key === current) ? current : slots[0].key;
}

/** Compose a human label from a slot's difficulty + type (+ size for minis): "Hard · Killer". */
export function slotLabel(slot: DailySlotInfo): string {
  const difficulty = slot.difficulty.charAt(0).toUpperCase() + slot.difficulty.slice(1);
  const size = slot.section === 'mini' ? ` ${slot.gridSize}×${slot.gridSize}` : '';
  return `${difficulty}${size} · ${VARIANT_LABEL[slot.variant] ?? slot.variant}`;
}
