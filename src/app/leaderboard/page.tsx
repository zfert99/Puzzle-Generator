import { LeaderboardView } from '@/features/leaderboards/components/LeaderboardView';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';

/**
 * /leaderboard — today's daily boards. Server Component shell; the interactive table and
 * self-rank/streak live in the client `LeaderboardView`. Viewable signed out (public
 * board); signed-in extras come from the client session. Nav/account live in `AppHeader`.
 */
export default function LeaderboardPage() {
  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8 mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Daily Leaderboard</h1>
      </div>

      <UsernamePrompt />
      <LeaderboardView />
    </main>
  );
}
