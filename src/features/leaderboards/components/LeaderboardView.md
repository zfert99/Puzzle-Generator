# Leaderboard View (`LeaderboardView.tsx`)

Client view for the leaderboard: difficulty tabs, a day's board, and (signed in) the caller's
own rank + streak.

## Today vs. a past day (the archive)

Pass `date` (YYYY-MM-DD) to show a **past** day's board (the archive reuses this component);
omit it for today. For a past board the today-relative panels (streak + personal bests) are
hidden — that effect gates on `!date` — while the caller's own historical rank still shows.
Difficulty can also be **controlled** externally (`difficulty` + `onDifficultyChange`) so the
archive drives one selector for both the board and its "Play (practice)" button; uncontrolled
(internal state) by default. `initialDifficulty` (July 2026) only seeds that internal state's
starting value — for deep-linking straight to a specific board (e.g. `/leaderboard` from the
daily's post-solve "Leaderboard" link) without going fully controlled; the tabs stay clickable
afterward exactly like the plain uncontrolled case.

## Why fetch effects avoid synchronous setState

**Why:** The `react-hooks/set-state-in-effect` rule (and cascading-render performance) means
setState must not run synchronously in an effect body. So the fetch effects set state only
inside async callbacks, and the loading flash on tab-switch is driven from the click handler
(`selectDifficulty`) instead. The streak render gates on `session`, so signing out needs no
synchronous reset. All ranking/ownership is decided server-side; this is a pure view over
`/api/leaderboard` and `/api/me/streak`.

```text
effect [difficulty] -> GET /api/leaderboard -> setEntries/setMe (async)
effect [session]    -> if signed in, GET /api/me/streak + /api/me/bests -> setStreak/setBests (async)
tab click           -> setLoading(true) + setDifficulty (event handler)
render              -> tabs · (streak · your rank) · personal bests · table (caller's row highlighted)
```

## "Sudoku Bot" badge (July 2026)

**Why not color alone:** Any entry whose `userId` matches `BOT_USER_ID`
(`features/leaderboards/bot-identity.ts`) gets a 🤖 emoji plus explicit
`" (bot — beat it!)"` text next to its name — not just a different background or text color.
Styling-only distinction would fail WCAG 1.4.1 (Use of Color) for anyone who can't perceive
the color difference; the emoji + text label reads the same for everyone.

**Why the split-out `bot-identity.ts` import:** This component only needs the bot's id to
compare against — importing it from `bot.ts` directly would pull that file's live Drizzle
`user` table and `db.insert` calls into the client bundle. `bot-identity.ts` has zero
imports, so it's safe to reference from client code (see `bot.md`'s bundling note, and
AGENTS.md's App Router Purity rule).
