import { LeaderboardView } from '@/features/leaderboards/components/LeaderboardView';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';
import { isDailyDifficulty } from '@/lib/db/daily-row';
import type { Metadata } from 'next';

// Per-page title (QA F8) — composed with the root layout's `%s · Puzzle Lab` template.
export const metadata: Metadata = { title: 'Leaderboard' };

/**
 * /leaderboard — today's daily boards. Server Component shell; the interactive table and
 * self-rank/streak live in the client `LeaderboardView`. Viewable signed out (public
 * board); signed-in extras come from the client session. Nav/account live in `AppHeader`.
 *
 * `?difficulty=` seeds the initial tab — e.g. the daily's post-solve "Leaderboard" link
 * deep-links straight to the board just played, instead of always landing on Easy.
 * Validated against `isDailyDifficulty` so a bad/unknown query value can't reach the client.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string }>;
}) {
  const { difficulty } = await searchParams;
  const initialDifficulty = isDailyDifficulty(difficulty) ? difficulty : undefined;

  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="text-center mb-8 mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Daily Leaderboard</h1>
      </div>

      <UsernamePrompt />
      <LeaderboardView initialDifficulty={initialDifficulty} />
    </main>
  );
}
