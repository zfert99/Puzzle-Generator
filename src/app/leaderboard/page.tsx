import Link from 'next/link';
import { LeaderboardView } from '@/features/leaderboards/components/LeaderboardView';
import { AccountBadge } from '@/features/auth/components/AccountBadge';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';

/**
 * /leaderboard — today's daily boards. Server Component shell; the interactive table and
 * self-rank/streak live in the client `LeaderboardView`. Viewable signed out (public
 * board); signed-in extras come from the client session.
 */
export default function LeaderboardPage() {
  return (
    <main className="flex flex-col items-center min-h-screen p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="w-full max-w-lg flex justify-between items-center mb-4">
        <Link
          href="/daily"
          className="text-sm text-grape hover:underline inline-flex items-center gap-1"
        >
          ← Back to the daily
        </Link>
        <AccountBadge />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">
          Daily Leaderboard
        </h1>
      </div>

      <UsernamePrompt />
      <LeaderboardView />
    </main>
  );
}
