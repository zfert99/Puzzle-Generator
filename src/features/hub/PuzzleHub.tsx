import { PuzzleCard } from './PuzzleCard';
import { ContinueBanner } from './ContinueBanner';
import { Sticker } from '@/features/chaos/Sticker';

/**
 * The puzzle hub (5.4) — the app's front door. A **compact, aligned** bento grid of puzzle
 * types (`minmax(150px, 1fr)`). The Killer card went live with Phase 6: it deep-links to
 * `/play?variant=killer` (the play menu preselects the variant). Chaos decoration
 * (stickers, tilt) sits on top of the orderly grid — never scattering it; the single
 * "new!" sticker follows whatever actually shipped last.
 *
 * A Server Component: it's just links + presentational cards.
 */
export function PuzzleHub() {
  return (
    <div className="w-full">
      {/* Resume the one saved game, if any — only renders client-side when one exists. */}
      <ContinueBanner />

      <div
        className="grid gap-4 w-full"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <PuzzleCard href="/daily" emoji="🗓️" title="Daily" desc="One shared puzzle a day" tilt="tilt-a" />
        <PuzzleCard href="/play" emoji="🧩" title="Free play" desc="Any size, any level" tilt="tilt-b" />
        <PuzzleCard href="/leaderboard" emoji="🏆" title="Leaderboard" desc="Daily speed ranks" tilt="tilt-c" />
        <PuzzleCard href="/archive" emoji="📅" title="Archive" desc="Past dailies & boards" tilt="tilt-a" />
        <PuzzleCard href="/generate" emoji="🖨️" title="Print packs" desc="PDF puzzle books" tilt="tilt-d" />
        <PuzzleCard
          href="/play?variant=killer"
          emoji="🔪"
          title="Killer"
          desc="Cage sums are the only clue"
          tilt="tilt-b"
          sticker={
            <Sticker color="lime" rotate={10} className="absolute -top-3 -right-2 z-10">
              in progress
            </Sticker>
          }
        />
        <PuzzleCard
          emoji="➗"
          title="KenKen"
          desc="Coming soon"
          tilt="tilt-c"
          sticker={
            <Sticker color="pink" rotate={-8} className="absolute -top-3 -right-2 z-10">
              soon
            </Sticker>
          }
        />
      </div>
    </div>
  );
}
