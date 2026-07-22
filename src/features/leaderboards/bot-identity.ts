/**
 * "Sudoku Bot"'s identity constants — split from `bot.ts` (which does real DB writes and
 * imports the Drizzle `user` table) so client components can reference `BOT_USER_ID` for
 * display purposes (e.g., `LeaderboardView`'s 🤖 badge) without pulling Drizzle/DB code
 * into the client bundle (AGENTS.md App Router Purity; see `Docs/performance-audit.md`).
 */
export const BOT_USER_ID = 'bot-sudoku';
export const BOT_NAME = 'Sudoku Bot';
