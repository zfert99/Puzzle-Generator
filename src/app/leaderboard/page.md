# Leaderboard Page (`/leaderboard`)

Today's daily boards.

## Why a Server shell

**Why:** Routing/layout only; the interactive table and self-rank/streak live in the client
`LeaderboardView`. Viewable signed out (the board is public); signed-in extras come from the
client session. The header has a **"← Back to the daily"** link and the `AccountBadge`; the
first-time `UsernamePrompt` renders above the table.
