# Leaderboard Page (`/leaderboard`)

Today's daily boards.

## Why a Server shell

**Why:** Routing/layout only; the interactive table and self-rank/streak live in the client
`LeaderboardView`. Viewable signed out (the board is public); signed-in extras come from the
client session. The header has a **"← Back to the daily"** link and the `AccountBadge`; the
first-time `UsernamePrompt` renders above the table.

> Nav, theme toggle, and account controls live in the global [AppHeader](../../features/chrome/AppHeader.md) (5.2); this shell just renders its title + content in a `flex-1` main.
