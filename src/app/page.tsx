import { PuzzleHub } from '@/features/hub/PuzzleHub';
import { RetroBadges } from '@/features/chaos/RetroBadges';

/**
 * Home Page (/) — the puzzle hub, the app's front door (5.4).
 *
 * A Server Component: a title + the presentational `<PuzzleHub />` bento grid + a footer.
 * The PDF generator moved to `/generate` (reached via the "Print packs" card). Nav lives in
 * the global `AppHeader`.
 */
export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold tracking-tight mb-2 text-ink">Puzzle Lab</h1>
        <p
          className="text-lg text-grape -rotate-1 inline-block"
          style={{ fontFamily: 'var(--font-caveat, cursive)' }}
        >
          pick your poison →
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <PuzzleHub />
      </div>

      <footer className="mt-14 flex flex-col items-center gap-3">
        <RetroBadges />
        <span className="text-xs text-ink-soft">Puzzle Lab &copy; 2026</span>
      </footer>
    </main>
  );
}
