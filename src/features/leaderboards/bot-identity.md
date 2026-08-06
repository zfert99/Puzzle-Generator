# Bot Identity (`bot-identity.ts`)

The "Puzzle Bot" pseudo-user's **identity constants only** — its stable id and display name.

## Why this is split from `bot.ts`

`bot.ts` does real DB writes (seeding the bot's baseline leaderboard attempts) and imports the
Drizzle `user` table, so importing it pulls DB/server code with it. Keeping the constants in this
tiny dependency-free module lets a caller reference `BOT_USER_ID` / `BOT_NAME` without dragging
Drizzle along (AGENTS.md App Router Purity; see `Docs/performance-audit.md`).

**The original consumer was the client, and no longer is.** `LeaderboardView` used to import
`BOT_USER_ID` and compare it against each entry's `userId` to draw the 🤖 badge. That required the
public leaderboard endpoint to ship every player's account id, so the DTO now carries a server-set
`isBot` flag instead and no client file imports this module. The split still pays for itself one
step inward: `leaderboard.service.ts` needs the id to set that flag, and should not have to import
the bot *writer* to get it.

## Contents

| Export | Value | Used for |
|---|---|---|
| `BOT_USER_ID` | `'bot-sudoku'` | The bot's reserved user id — matched server-side and referenced client-side for badge rendering. |
| `BOT_NAME` | `'Puzzle Bot'` | Display name on the leaderboard. |
