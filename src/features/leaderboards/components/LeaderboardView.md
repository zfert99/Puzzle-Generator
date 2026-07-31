# Leaderboard View (`LeaderboardView.tsx`)

Client view for the leaderboard: difficulty tabs, a day's board, and (signed in) the caller's
own rank + streak.

## Today vs. a past day (the archive)

Pass `date` (YYYY-MM-DD) to show a **past** day's board (the archive reuses this component);
omit it for today. For a past board the today-relative panels (streak + personal best) are
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

All three endpoints are requested through `apiPath()` (`src/lib/base-path.ts`), which
prepends the `/puzzles` basePath — Next does not apply basePath to `fetch()`, so bare
`/api/...` paths 404 under the multi-zone rewrite.

```text
effect [difficulty] -> GET /api/leaderboard -> setEntries/setMe (async)
effect [date]       -> GET /api/daily/slots -> setSlots (the day's real boards; drives the tabs)
effect [session]    -> if signed in, GET /api/me/streak + /api/me/bests -> setStreak/setBests (async)
tab click           -> setLoading(true) + setDifficulty (event handler)
render              -> tabs · (streak · your rank) · personal best (this tab only) · table (caller's row highlighted)
```

## Tabs come from the day's boards (type-as-slot, Step 3b)

**Why:** tabs used to be rendered from the static `DAILY_BOARDS` registry, grouped into four
sections. Under type-as-slot the boards are **rolled per day and stored**, so no static table
describes a given day — the component fetches `GET /api/daily/slots` (honouring `date`, so an
archived day shows the boards it actually had) and renders two sections, **Standard** and **Minis**.
Labels use `slotLabel` ("Hard · Killer"), shared with the `/daily` picker so the same board reads
identically on both surfaces.

## Personal best is scoped to the current tab (July 2026)

**Why:** `/api/me/bests` returns the caller's best time for *every* board they've ever completed.
The component used to render all of them as a wrapping row of pills on every tab, regardless of
which board was actually being viewed — cluttered, and mostly showing bests for boards you weren't
even looking at. Only the entry matching the currently-selected tab renders. Deliberately kept as a
filter over one fetch-everything call (not a per-tab refetch) — the payload is small and this avoids
a network round-trip on every tab click.

**Matched on `(key, variant)`, not key alone.** Bests are now grouped by both server-side (see
`attempts.service.md`), because a rung key holds a different type on different days — so
`hard`+Classic and `hard`+Killer are genuinely different bests. The current tab's variant comes from
the fetched slot list; before it resolves the match falls back to key-only, which may briefly show
another type's best for that rung.

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
