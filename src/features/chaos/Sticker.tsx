import type { ReactNode } from 'react';

type StickerColor = 'pink' | 'lime' | 'sky';

const BG: Record<StickerColor, string> = {
  pink: 'bg-sticker-pink',
  lime: 'bg-sticker-lime',
  sky: 'bg-sticker-sky',
};

/**
 * A small hand-cut "sticker" badge (chaos layer, §8) — a rotated pill in a wildcard color,
 * with an **asymmetric** border-radius so it reads as cut, not a uniform pill. Marker font.
 *
 * Decoration only: the wildcard sticker colors are quarantined to this component and never
 * carry meaning on their own (pair the label with real UI when it conveys state — a11y §6).
 * Absolutely positioned by the caller (pass position classes via `className`).
 */
export function Sticker({
  children,
  color = 'pink',
  rotate = -10,
  className = '',
}: {
  children: ReactNode;
  color?: StickerColor;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ transform: `rotate(${rotate}deg)`, borderRadius: '16px 6px 16px 6px' }}
      // `text-on-sticker`, not `text-ink`: the fill is the same in both themes, so the ink on it
      // must be too — the theme-flipping ink read cream-on-lime at 1.25:1 in the dark theme.
      className={`inline-block select-none border-2 border-ink px-2 py-0.5 text-xs text-on-sticker shadow-[2px_2px_0_0_var(--ink)] ${BG[color]} ${className}`}
    >
      <span style={{ fontFamily: 'var(--font-marker, cursive)' }}>{children}</span>
    </span>
  );
}
