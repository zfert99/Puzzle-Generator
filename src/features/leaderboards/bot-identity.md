# Bot Identity (`bot-identity.ts`)

The "Sudoku Bot" pseudo-user's **identity constants only** — its stable id and display name.

## Why this is split from `bot.ts`

`bot.ts` does real DB writes (seeding the bot's baseline leaderboard attempts) and imports the
Drizzle `user` table, so importing it pulls DB/server code with it. Client components only need the
bot's **id** and **name** — e.g. `LeaderboardView` renders a 🤖 badge next to the bot's rows. Keeping
the constants in this tiny dependency-free module lets the client reference `BOT_USER_ID` /`BOT_NAME`
without dragging Drizzle into the client bundle (AGENTS.md App Router Purity; see
`Docs/performance-audit.md`).

## Contents

| Export | Value | Used for |
|---|---|---|
| `BOT_USER_ID` | `'bot-sudoku'` | The bot's reserved user id — matched server-side and referenced client-side for badge rendering. |
| `BOT_NAME` | `'Sudoku Bot'` | Display name on the leaderboard. |
