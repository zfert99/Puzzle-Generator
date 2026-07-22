# Leaderboard Page (`/leaderboard`)

Today's daily boards.

## Why a Server shell

**Why:** Routing/layout only; the interactive table and self-rank/streak live in the client
`LeaderboardView`. Viewable signed out (the board is public); signed-in extras come from the
client session. The header has a **"← Back to the daily"** link and the `AccountBadge`; the
first-time `UsernamePrompt` renders above the table.

> Nav, theme toggle, and account controls live in the global [AppHeader](../../features/chrome/AppHeader.md) (5.2); this shell just renders its title + content in a `flex-1` main.

## `?difficulty=` deep link (July 2026)

**Why:** `searchParams` (a `Promise<{ difficulty?: string }>` in this Next.js version — see
its `page.md` file convention doc before assuming the training-data shape) is read and
validated against `isDailyDifficulty` before being passed to `LeaderboardView` as
`initialDifficulty`, which only seeds its *uncontrolled* initial tab. Bad/unknown values fall
through to `undefined` (the component's own "easy" default) rather than reaching the client.
This exists so the daily's post-solve "Leaderboard" link
(`DailyExperience.tsx`) can land directly on the board just played instead of always Easy.
