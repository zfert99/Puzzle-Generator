import ArchiveExperience from '@/features/dailies/components/ArchiveExperience';

/**
 * /archive — browse and replay past daily puzzles and view their final leaderboards.
 *
 * Server Component shell (routing/layout only); the calendar, leaderboard, and unranked
 * replay live in the client `ArchiveExperience` leaf, so nothing puzzle-related runs during
 * SSR (AGENTS.md §1), exactly like /daily. Nav lives in the global `AppHeader`.
 */
export default function ArchivePage() {
  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8 mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Puzzle Archive</h1>
      </div>

      <ArchiveExperience />
    </main>
  );
}
