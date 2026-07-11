import Link from 'next/link';
import { LeaderboardView } from '@/features/leaderboards/components/LeaderboardView';
import { AccountBadge } from '@/features/auth/components/AccountBadge';

/**
 * /leaderboard — today's daily boards. Server Component shell; the interactive table and
 * self-rank/streak live in the client `LeaderboardView`. Viewable signed out (public
 * board); signed-in extras come from the client session.
 */
export default function LeaderboardPage() {
  return (
    <main className="flex flex-col items-center min-h-screen p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="w-full max-w-lg flex justify-end mb-4">
        <AccountBadge />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
          Daily Leaderboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          <Link href="/daily" className="hover:underline">
            Play today&apos;s daily
          </Link>
        </p>
      </div>

      <LeaderboardView />
    </main>
  );
}
