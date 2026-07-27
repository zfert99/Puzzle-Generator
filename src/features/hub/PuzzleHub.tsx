import { PuzzleCard } from './PuzzleCard';
import { ContinueBanner } from './ContinueBanner';
import { Sticker } from '@/features/chaos/Sticker';

/**
 * The puzzle hub (5.4) — the app's front door. A **compact, aligned** bento grid of puzzle
 * types (`minmax(150px, 1fr)`). Killer went live in Phase 6; **Keisan** (Calcudoku) is the
 * newest, deep-linking to `/play?variant=calc` (the play menu preselects the variant). Chaos
 * decoration (stickers, tilt) sits on top of the orderly grid — never scattering it; the single
 * "new!" sticker follows whatever actually shipped last (now Keisan).
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
        />
        <PuzzleCard
          href="/play?variant=calc"
          emoji="🧮"
          title="Keisan"
          desc="Math cages — the sums, differences, products & quotients are the clue"
          tilt="tilt-c"
          sticker={
            <Sticker color="lime" rotate={10} className="absolute -top-3 -right-2 z-10">
              new!
            </Sticker>
          }
        />
      </div>
    </div>
  );
}
