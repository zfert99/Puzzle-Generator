import { PuzzleCard } from './PuzzleCard';
import { Sticker } from '@/features/chaos/Sticker';

/**
 * The puzzle hub (5.4) — the app's front door. A **compact, aligned** bento grid of puzzle
 * types (`minmax(150px, 1fr)`); Sudoku's entry points now, plus a dimmed "coming soon"
 * Killer card so the layout visibly accepts future types (Phase 6+). Chaos decoration
 * (stickers, tilt) sits on top of the orderly grid — never scattering it.
 *
 * A Server Component: it's just links + presentational cards.
 */
export function PuzzleHub() {
  return (
    <div
      className="grid gap-4 w-full"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
    >
      <PuzzleCard
        href="/daily"
        emoji="🗓️"
        title="Daily"
        desc="One shared puzzle a day"
        tilt="tilt-a"
        sticker={
          <Sticker color="pink" rotate={-12} className="absolute -top-3 -right-2 z-10">
            new!
          </Sticker>
        }
      />
      <PuzzleCard href="/play" emoji="🧩" title="Free play" desc="Any size, any level" tilt="tilt-b" />
      <PuzzleCard href="/leaderboard" emoji="🏆" title="Leaderboard" desc="Daily speed ranks" tilt="tilt-c" />
      <PuzzleCard href="/generate" emoji="🖨️" title="Print packs" desc="PDF puzzle books" tilt="tilt-d" />
      <PuzzleCard
        emoji="🔪"
        title="Killer"
        desc="Coming soon"
        tilt="tilt-b"
        sticker={
          <Sticker color="lime" rotate={10} className="absolute -top-3 -right-2 z-10">
            soon
          </Sticker>
        }
      />
    </div>
  );
}
