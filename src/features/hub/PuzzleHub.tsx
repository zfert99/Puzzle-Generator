import type { ReactNode } from 'react';
import { PuzzleCard } from './PuzzleCard';
import { ContinueBanner } from './ContinueBanner';
import { Sticker } from '@/features/chaos/Sticker';

/**
 * A section label inside the hub grid. Spans the full row so it breaks the flow between
 * groups, which is what gives each group its own row without needing a grid per group
 * (see `PuzzleHub`'s note on why one shared grid matters).
 *
 * A real `<h2>`, not a styled `<div>`: these are the page's document outline under the `<h1>`,
 * so a screen-reader user can jump between groups the same way a sighted one scans them.
 */
function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="col-span-full text-sm font-medium text-ink-soft tracking-wide mt-2 first:mt-0">
      {children}
    </h2>
  );
}

/**
 * The puzzle hub (5.4) — the app's front door. A compact bento grid, now **grouped**: the
 * three puzzle *types* first, then the competitive surfaces, then print.
 *
 * **Why grouped (Aug 2026, `Docs/qa-remediation-plan.md` Step 4).** The flat 7-card grid
 * interleaved puzzle *types* (Killer, Keisan) with *modes* (Daily, Free play, Leaderboard,
 * Archive, Print packs), and — the asymmetry that prompted the change — there was **no plain
 * Sudoku card at all**, even though the other two types had one. A player looking for ordinary
 * Sudoku had to infer that "Free play" meant it.
 *
 * **Why no Free play card.** The type cards now *are* free play — each deep-links into
 * `/play` with its variant preselected, so a separate "Free play" card would be a fourth door
 * to the same room. `/play` itself stays reachable from the header.
 *
 * **Why this type order.** Play group is ordered by difficulty-to-learn, not by generator
 * cost: Sudoku (rules everyone knows) → Killer (those rules plus cage sums) → Keisan (a
 * different constraint model — no boxes — plus four operators and the optional mystery mode).
 * It also matches the order the `/play` picker already uses (`classic, killer, calc`), so the
 * hub and the picker agree.
 *
 * **Why one grid, not one per group.** A grid per group would size cards independently, so a
 * one-card group (Print) would stretch that card across the full row. Sharing a single grid and
 * letting the headings span it keeps every card the same size in every group. The container is
 * capped at 640px so `auto-fit` settles on exactly **3 columns** on desktop — the width at
 * which each three-card group fills its row exactly — while still collapsing to 2 and then 1
 * on narrow screens.
 *
 * A Server Component: it's just links + presentational cards.
 */
export function PuzzleHub() {
  return (
    <div className="w-full">
      {/* Resume the one saved game, if any — only renders client-side when one exists. */}
      <ContinueBanner />

      <div
        // Lets e2e scope card assertions to the grid. `ContinueBanner` above renders a link whose
        // label comes from `formatDailyKey`, which for retired keys reads "keisan expert" /
        // "killer 6×6 medium" — a page-wide `getByRole('link', {name: /keisan/i})` would then match
        // two elements and fail Playwright's strict mode instead of asserting anything.
        data-testid="hub-card-grid"
        className="grid gap-4 w-full max-w-[640px] mx-auto"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <GroupHeading>Play</GroupHeading>
        <PuzzleCard href="/play" emoji="🧩" title="Sudoku" desc="The classic — 4×4 to 9×9" tilt="tilt-a" />
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
          desc="Math cages — + − × ÷ are the clue"
          tilt="tilt-c"
          sticker={
            <Sticker color="lime" rotate={10} className="absolute -top-3 -right-2 z-10">
              new!
            </Sticker>
          }
        />

        <GroupHeading>Compete</GroupHeading>
        <PuzzleCard href="/daily" emoji="🗓️" title="Daily" desc="One shared puzzle a day" tilt="tilt-d" />
        <PuzzleCard href="/leaderboard" emoji="🏆" title="Leaderboard" desc="Daily speed ranks" tilt="tilt-a" />
        <PuzzleCard href="/archive" emoji="📅" title="Archive" desc="Past dailies & boards" tilt="tilt-c" />

        <GroupHeading>Print</GroupHeading>
        <PuzzleCard href="/generate" emoji="🖨️" title="Print packs" desc="PDF puzzle books" tilt="tilt-b" />
      </div>
    </div>
  );
}
