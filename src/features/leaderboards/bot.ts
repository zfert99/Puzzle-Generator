import type { Database } from '@/lib/db/connection';
import { user } from '@/lib/db/auth-schema';
import { BOT_USER_ID, BOT_NAME } from './bot-identity';

/**
 * "Puzzle Bot" — a transparent, clearly-labeled system account that posts a good-but-
 * beatable time on every daily board. It exists to give players a visible "time to beat"
 * while the real player base is small, never to impersonate a real solver: the UI always
 * renders it with a 🤖 badge (`LeaderboardView`, from the `isBot` flag the leaderboard service
 * sets using `bot-identity.ts`), and its target
 * times (the profile table's `botTimeMs` in `daily-row.ts`) are tuned to be comfortably above
 * the anti-cheat `minSolveMs` floor — a solid time, not a world record.
 *
 * It is NOT a loginable account: no `account`/`session`/passkey row is ever created for
 * this id, so nothing in the auth flow can authenticate as it. Its only footprint is this
 * `user` row (for the leaderboard's join) and its `solve_attempts` rows.
 *
 * Narrative thread for later phases (not built here): Puzzle Bot as a recurring character —
 * a Clippy-esque tip-giver, and the "teacher" for Phase 7's strategy courses ("the student
 * has become the master" on first beating it). See the roadmap and
 * `Docs/social-progression-economy-plan.md` for where this is expected to resurface.
 */
export { BOT_USER_ID, BOT_NAME };

// Reserved, non-routable — never emailed, just satisfies the NOT NULL UNIQUE column.
const BOT_EMAIL = 'puzzle-bot@puzzlelab.internal';

/**
 * Idempotently ensure the bot's `user` row exists AND that its display fields are current.
 * Cheap; safe to call on every cron run.
 *
 * Upserts rather than `onConflictDoNothing` so a rename actually reaches production: the row is
 * created once and then never touched again, so a plain do-nothing insert would leave the old
 * display name in the database forever while the constant said otherwise. Only the display fields
 * are written — `id` is the FK target for every historical bot solve and never changes.
 */
export async function ensureBotUser(db: Database): Promise<void> {
  await db
    .insert(user)
    .values({ id: BOT_USER_ID, name: BOT_NAME, email: BOT_EMAIL, emailVerified: true })
    .onConflictDoUpdate({
      target: user.id,
      set: { name: BOT_NAME, email: BOT_EMAIL },
    });
}
