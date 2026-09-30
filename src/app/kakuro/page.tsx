import type { Metadata } from 'next';
import { KAKURO_FIXTURES } from '@/features/engine/kakuro/kakuro-fixtures';
import { KakuroBoard } from '@/features/interactive-board/components/KakuroBoard/KakuroBoard';

// A build workbench, not a product page: kept out of search results and the sitemap until
// Kakuro is playable for real.
export const metadata: Metadata = { title: 'Kakuro', robots: { index: false } };

/**
 * /kakuro — the Kakuro workbench route (plan slices V0–V1).
 *
 * Shows every hand-baked fixture as a static board, so the visual design can be judged at each
 * size before the board is interactive. A Server Component with no client boundary at all:
 * nothing here is interactive, and the fixtures are static data. When the board becomes
 * playable (V2) it moves to `/play?variant=kakuro` and this route goes away.
 */
export default function KakuroPage() {
  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Kakuro</h1>
        <p className="text-ink-soft">Cross Sums</p>
      </div>

      <div className="flex flex-col items-center gap-10">
        {KAKURO_FIXTURES.map((puzzle) => (
          <section key={puzzle.gridSize} className="flex flex-col items-center gap-3">
            <h2 className="text-xl font-bold text-ink">
              {puzzle.gridSize}×{puzzle.gridSize}
            </h2>
            <KakuroBoard puzzle={puzzle} />
          </section>
        ))}
      </div>
    </main>
  );
}
