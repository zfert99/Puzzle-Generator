/**
 * "Puzzle Bot"'s identity constants — split from `bot.ts` (which does real DB writes and
 * imports the Drizzle `user` table) so client components can reference `BOT_USER_ID` for
 * display purposes (e.g., `LeaderboardView`'s 🤖 badge) without pulling Drizzle/DB code
 * into the client bundle (AGENTS.md App Router Purity; see `Docs/performance-audit.md`).
 */

/**
 * **Never change this.** It is the `user.id` primary key that every historical bot
 * `solve_attempts` row references by foreign key; renaming it would orphan the bot's entire
 * leaderboard history. It keeps its original `bot-sudoku` spelling even though the bot is now
 * displayed as "Puzzle Bot" — the id is an internal handle, not a label.
 */
export const BOT_USER_ID = 'bot-sudoku';

/** The bot's DISPLAY name. Renamed from "Sudoku Bot" once the app covered more than Sudoku. */
export const BOT_NAME = 'Puzzle Bot';
