import { Suspense } from 'react';
import PlayExperience from '@/features/interactive-board/components/PlayExperience';

/**
 * /play — the interactive board route.
 *
 * This stays a Server Component (routing/layout only); all interactivity lives in the
 * client `PlayExperience` leaf. Puzzle generation happens via `/api/puzzle` after the
 * page mounts, so nothing puzzle-related is computed during SSR — sidestepping the
 * hydration-mismatch pitfall (AGENTS.md Section 1). Nav lives in the global `AppHeader`.
 *
 * The Suspense boundary is required by `useSearchParams` in `PlayExperience` (the hub's
 * Killer card deep-links `/play?variant=killer`) — it keeps the route statically
 * prerenderable, with only the boundary deferring to the client. The fallback matches the
 * component's own pre-mount placeholder, so there's no layout shift either way.
 */
export default function PlayPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Play Sudoku</h1>
      </div>

      <Suspense fallback={<div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />}>
        <PlayExperience />
      </Suspense>
    </main>
  );
}
