import PuzzleForm from '@/features/puzzle-configuration/components/PuzzleForm';
import type { Metadata } from 'next';

// Per-page title (QA F8) — composed with the root layout's `%s · Puzzle Lab` template.
export const metadata: Metadata = { title: 'Print packs' };

/**
 * /generate — the print-ready PDF puzzle-book generator (formerly the home page). Moved to
 * its own route in 5.4 so the puzzle hub can be the front door; reached via the hub's
 * "Print packs" card. Nav lives in the global `AppHeader`.
 */
export default function GeneratePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-ink">Print packs</h1>
        <p className="text-lg text-ink-soft max-w-xl mx-auto">
          Create customized, print-ready Sudoku puzzle books with interactive answer keys in seconds.
        </p>
      </div>

      <PuzzleForm />
    </main>
  );
}
