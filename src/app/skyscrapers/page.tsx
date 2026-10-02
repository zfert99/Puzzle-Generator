import type { Metadata } from 'next';
import { SkyscrapersBoard } from '@/features/interactive-board/components/SkyscrapersBoard/SkyscrapersBoard';

// A build workbench, not a product page: kept out of search results and the sitemap until
// Skyscrapers is playable for real.
export const metadata: Metadata = { title: 'Skyscrapers', robots: { index: false } };

/**
 * The three candidate sizes from the plan's decision D4 (research recommendation: mini 5×5,
 * standard 6×6, large 7×7), shown side by side so the size question is judged on screen while
 * E3 measures it. Not a product size list — `PlayExperience`'s per-type table is, from V2.
 */
const SIZES = [
  { size: 5, role: 'mini' },
  { size: 6, role: 'standard' },
  { size: 7, role: 'large' },
] as const;

/**
 * /skyscrapers — the Skyscrapers workbench route (plan slice V0).
 *
 * Shows a static, looks-only board at each candidate size so the visual design — the
 * four-sided clue gutter and the framed play area — can be settled before any puzzle logic
 * exists. A Server Component with no client boundary at all: nothing here is interactive and
 * the sizes are static data. When the board becomes playable (V2) it moves to
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
        {SIZES.map(({ size, role }) => (
          <section key={size} className="flex flex-col items-center gap-3">
            <h2 className="text-xl font-bold text-ink">
              {size}×{size} <span className="text-ink-soft font-normal">· {role}</span>
            </h2>
            <SkyscrapersBoard size={size} />
          </section>
        ))}
      </div>
    </main>
  );
}
