import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * One compact bento tile in the puzzle hub (5.4). Chunky but scaled down (`--r-md`, 2px
 * border, small offset shadow) per the updated design so more puzzles fit at once. A fixed
 * `tilt` + `wobble-hover` gives the corkboard feel (chaos §8) while the grid itself stays
 * aligned. `sticker` is optional decorative overlay.
 *
 * A `href` renders an interactive tile; omit it for a "coming soon" placeholder (dimmed,
 * non-interactive) so the layout visibly accepts future puzzle types.
 */
export function PuzzleCard({
  href,
  emoji,
  title,
  desc,
  tilt = 'tilt-a',
  sticker,
}: {
  href?: string;
  emoji: string;
  title: string;
  desc: string;
  tilt?: 'tilt-a' | 'tilt-b' | 'tilt-c' | 'tilt-d';
  sticker?: ReactNode;
}) {
  const base =
    'relative block p-4 text-center bg-paper-2 border-2 border-ink rounded-[var(--r-md)] shadow-chunky';

  const inner = (
    <>
      {sticker}
      <div className="text-4xl mb-1" aria-hidden>
        {emoji}
      </div>
      <div className="font-display text-lg text-ink leading-tight">{title}</div>
      <div className="text-xs text-ink-soft mt-0.5">{desc}</div>
    </>
  );

  if (!href) {
    return (
      <div className={`${base} ${tilt} opacity-70`} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={`${base} ${tilt} wobble-hover`}>
      {inner}
    </Link>
  );
}
