# Leaderboard Page (`/leaderboard`)

Today's daily boards.

## Why a Server shell

**Why:** Routing/layout only; the interactive table and self-rank/streak live in the client
`LeaderboardView`. Viewable signed out (the board is public); signed-in extras come from the
client session. Includes the `AccountBadge` in the header for sign-in/out.
