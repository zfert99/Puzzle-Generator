import type { Metadata } from 'next';
import { SKYSCRAPERS_FIXTURES } from '@/features/engine/skyscrapers/skyscrapers-fixtures';
import { SkyscrapersBoard } from '@/features/interactive-board/components/SkyscrapersBoard/SkyscrapersBoard';

// A build workbench, not a product page: kept out of search results and the sitemap until
// Skyscrapers is playable for real.
export const metadata: Metadata = { title: 'Skyscrapers', robots: { index: false } };

/**
 * The role each fixture size plays under the plan's decision D4 (planned at the research
 * recommendation while E3 measures). Not a product size list — `PlayExperience`'s per-type
 * table is, from V2.
 */
const ROLE: Record<number, string> = { 5: 'mini', 6: 'standard', 7: 'large' };

/**
 * /skyscrapers — the Skyscrapers workbench route (plan slices V0–V1).
 *
 * Shows every hand-baked fixture as a static board, so the visual design — the four-sided clue
 * gutter, the clue digits and the framed play area — can be judged at each size before the
 * board is interactive. A Server Component with no client boundary at all: nothing here is
 * interactive and the fixtures are static data. When the board becomes playable (V2) it moves to
 * `/play?variant=skyscrapers` and this route goes away.
 */
export default function SkyscrapersPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Skyscrapers</h1>
        <p className="text-ink-soft">Towers</p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-10">
        {SKYSCRAPERS_FIXTURES.map((puzzle) => {
          const present = Object.values(puzzle.clues).flat().filter((clue) => clue > 0).length;
          return (
            <section key={puzzle.gridSize} className="flex flex-col items-center gap-3">
              <h2 className="text-xl font-bold text-ink">
                {puzzle.gridSize}×{puzzle.gridSize}{' '}
                <span className="text-ink-soft font-normal">
                  · {ROLE[puzzle.gridSize] ?? 'extra'} · {present} of {4 * puzzle.gridSize} clues
                </span>
              </h2>
              <SkyscrapersBoard puzzle={puzzle} />
            </section>
          );
        })}
      </div>
    </main>
  );
}
