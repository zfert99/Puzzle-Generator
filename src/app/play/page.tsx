import PlayExperience from '@/features/interactive-board/components/PlayExperience';

/**
 * /play — the interactive board route.
 *
 * This stays a Server Component (routing/layout only); all interactivity lives in the
 * client `PlayExperience` leaf. Puzzle generation happens via `/api/puzzle` after the
 * page mounts, so nothing puzzle-related is computed during SSR — sidestepping the
 * hydration-mismatch pitfall (AGENTS.md Section 1). Nav lives in the global `AppHeader`.
 */
export default function PlayPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Play Sudoku</h1>
      </div>

      <PlayExperience />
    </main>
  );
}
