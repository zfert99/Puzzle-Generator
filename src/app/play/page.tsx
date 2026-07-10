import Link from 'next/link';
import PlayExperience from '@/features/interactive-board/components/PlayExperience';

/**
 * /play — the interactive board route.
 *
 * This stays a Server Component (routing/layout only); all interactivity lives in the
 * client `PlayExperience` leaf. Puzzle generation happens via `/api/puzzle` after the
 * page mounts, so nothing puzzle-related is computed during SSR — sidestepping the
 * hydration-mismatch pitfall (AGENTS.md Section 1).
 */
export default function PlayPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
          Play Sudoku
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          <Link href="/" className="hover:underline">
            ← Back to PDF generator
          </Link>
        </p>
      </div>

      <PlayExperience />
    </main>
  );
}
