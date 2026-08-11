# ArchiveExperience (`ArchiveExperience.tsx`)

Client orchestrator for `/archive` — browse a past day, see its final leaderboard, and replay
its puzzle as **unranked practice**.

## Why today is browsable but not playable here (August 2026)

The calendar reaches today, so today's leaderboard stays visible beside it — but today's button reads
**"Daily {slot} (ranked)"** and **hands off to `/daily`** rather than starting a board.

It used to start an *unranked practice* run of the very board you still had to play ranked. Worse,
a replay calls `startNewGame`, which overwrites the single saved slot, so it could erase an
in-progress *ranked* attempt at that same board. Nothing on screen said either thing.

Rankability stays entirely in `DailyExperience` — it posts `/api/daily/start` on begin and submits
only when `dailyDate === today`. This surface still has **no `/api/solve` caller**, and
`· practice` remains unconditionally true for everything it does start.

The hand-off carries the chosen slot as `/daily?slot=<key>` so the player does not pick twice.
`DailyExperience` applies that key **inside** its slots effect, where it can be checked against the
boards today actually rolled — see [`DailyExperience`](DailyExperience.md).

**The link is held back until this page's own slots arrive.** `difficulty` starts at the hardcoded
`'easy'` and is only reconciled by `handleSlotsLoaded`, and the standard rungs *roll* — 2026-08-03
rolled `hard`/`expert`/`extreme` with no `easy` at all. An ungated link would read one board and
navigate to another, with `/daily` silently correcting the bogus key to its first slot.

**Three states, not two.** Holding the link back on `slots.length === 0` is wrong, because zero
boards is a real answer rather than a pending one — 2026-07-24 has none (a cron outage), and a
day's boards do not exist until the roller runs. `LeaderboardView` now reports an empty day too, and
this page tracks `slotsLoadedFor` (the date the answer applies to, so a date change invalidates it
without a reset effect):

| State | Rendered |
|---|---|
| not answered yet | disabled "Loading…" |
| answered, no boards | "Today's boards haven't been generated yet" |
| answered, boards exist | the "Daily {slot} (ranked)" hand-off |

## Why replays are unranked

That day's leaderboard is closed; letting late solves post to it would let players pad old
boards. So the archive **never** calls `/api/solve` — its solved modal just shows the time and
says "practice replay — not ranked". Replays reuse the shared board via
`startNewGame(puzzle, 'daily', date)`, and the timer runs only while actively replaying
(`view === 'playing'`), same as the other surfaces.

## Why difficulty is lifted here

The browse view shows one `LeaderboardView` (its difficulty tabs) AND a "Play {difficulty}
(practice)" button. To keep them in sync from a single selector, difficulty is owned here and
passed to `LeaderboardView` as a controlled prop (`difficulty` + `onDifficultyChange`); the
Play button reads the same value. `Calendar` picks the date, which drives both the leaderboard
(`date` prop) and the puzzle fetch (`useDaily(difficulty, date)`).

## Why the selected board is reconciled against the date

**Why:** the difficulty owned here started as a hardcoded `'easy'` and was never checked against the
day being viewed. Under type-as-slot only **3 of the 5** standard rungs are drawn per day, so on any
day easy didn't roll the archive opened straight onto `No daily puzzle for <date> (easy)` — and the
same happened when a key was carried across a date change.

`LeaderboardView` already fetches the day's boards for its tabs, so rather than fetching the same
endpoint twice it reports them up through `onSlotsLoaded`; this component applies the shared
`reconcileSelectedKey` (see `slot-display.md`) — keep the current key if that day has it, otherwise
fall back to the day's first board. The slot list is also kept in state so the Play button and the
replay header can show the composed **"Hard · Killer"** label instead of a bare key.

## Completion counts (X/N)

Under the date sits **"Standard 2/3 · Minis 1/3"** for the day being viewed, and each calendar day
carries a dot for its combined progress (see `Calendar.md`). Source: `GET /api/me/progress`.

- **Signed-in only.** The counts are personal, so a signed-out visitor sees the archive exactly as
  before rather than a calendar of "0/3". The session gate is applied when **reading** the map for
  render, not by clearing it in an effect — signing out must drop the previous user's counts on the
  same pass (the tab is shared), and effect-body `setState` is a render late and lint-banned
  (`react-hooks/set-state-in-effect`).
- **Fetched a month at a time,** keyed off the calendar's visible month (`onMonthChange`) rather
  than the selected date — the calendar can page months without the selection moving. Responses
  accumulate into one ISO-date-keyed map, so paging back and forth doesn't blank out months already
  loaded (dates can't collide across months).
- **A set with no boards that day is omitted from the line,** not shown as `0/0` — the denominator
  is per-date, so early dates (or a future day with more types) need not hold both sets.
- **Read-only.** No badge, star, or economy state is written; this is the X/N slice of the daily
  restructure (Step 5), with the rest deferred to Phase 9.
- **The response type is imported from the route,** not redeclared here — a local copy would let
  the two drift silently, so a server-side rename would still compile and then throw on the first
  render that read the missing set.

## Shared-slot note

The board store holds one game, so starting a replay erases any parked game — hence the same
`ConfirmModal` warning as the other surfaces. A parked archive replay (mode `daily`, a past
date) resumes via the normal daily continue path and is shown as expired there (unranked),
which is consistent with it being practice.

```text
view 'browse':
  Calendar(value=date, maxDate=today, tallies, onMonthChange) → date
  "Standard X/N · Minis X/N" for the selected date        # signed in only
  LeaderboardView(date, difficulty, onDifficultyChange)   # that day's final board
  "Play {difficulty} (practice)" → warn if a game is parked, else fetch + startNewGame + play

view 'playing':
  reused board (GameHeader / Board / Numpad / KeyboardHints); hints allowed (it's practice)
  solved → unranked modal (time + mistakes + "not ranked") → back to browse
```

## Browse layout (July 2026)

Desktop is two columns — calendar + practice button on the left, the board picker /
leaderboard panel on the right (`md:grid-cols-2`, `max-w-4xl`) — so the page needs no
scroll. Mobile stacks in the order calendar → practice button → types (the button moved
between them deliberately). Archive also joined the header nav (`sm+`; mobile reaches it
via the hub card).
