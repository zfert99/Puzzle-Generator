import Link from 'next/link';
import DailyExperience from '@/features/dailies/components/DailyExperience';

/**
 * /daily — the shared daily-puzzle route.
 *
 * Stays a Server Component (routing/layout only); all interactivity and the fetch of
 * today's puzzle live in the client `DailyExperience` leaf, so nothing puzzle-related is
 * computed during SSR — sidestepping the hydration-mismatch pitfall (AGENTS.md §1),
 * exactly like /play.
 */
export default function DailyPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">
          Daily Sudoku
        </h1>
        <p className="text-ink-soft">
          <Link href="/play" className="hover:underline">
            Free play
          </Link>
          {' · '}
          <Link href="/" className="hover:underline">
            PDF generator
          </Link>
        </p>
      </div>

      <DailyExperience />
    </main>
  );
}
