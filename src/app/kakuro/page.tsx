import type { Metadata } from 'next';
import { KakuroBoard } from '@/features/interactive-board/components/KakuroBoard/KakuroBoard';
import { KAKURO_SAMPLE_7X7 } from '@/features/interactive-board/components/KakuroBoard/sample-layout';

// A build workbench, not a product page: kept out of search results and the sitemap until
// Kakuro is playable for real.
export const metadata: Metadata = { title: 'Kakuro', robots: { index: false } };

/**
 * /kakuro — the Kakuro workbench route (plan slice V0).
 *
 * Shows a static, looks-only board so the visual design can be settled before any puzzle logic
 * exists. A Server Component with no client boundary at all: nothing here is interactive, and
 * the layout is static data. When the board becomes playable (V2) it moves to
 * `/play?variant=kakuro` and this route goes away.
 */
export default function KakuroPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Kakuro</h1>
        <p className="text-ink-soft">Cross Sums</p>
      </div>

      <KakuroBoard layout={KAKURO_SAMPLE_7X7} />
    </main>
  );
}
