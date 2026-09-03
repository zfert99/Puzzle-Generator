# Calendar (`Calendar.tsx`)

A small dependency-free month calendar for picking a past daily in the archive.

## Why UTC, not local time

The daily rolls over at 00:00 **UTC**, so the calendar must reason in UTC too — otherwise the
highlighted "today" and the set of disabled future days would drift by the viewer's timezone
offset (off-by-one near midnight). Every date is built with explicit `Date.UTC(...)` and
compared as an ISO `YYYY-MM-DD` string (string comparison is correct for that format), never
via the local-timezone `Date` constructor.

## Bounds

- **Future dates are disabled** (`date > maxDate`), and the next-month arrow is disabled once
  the view reaches the current month.
- **Dates before the archive's first board are disabled** (`date < minDate`), and the previous-month
  arrow is disabled once the view reaches that month.
- **Days with no boards are disabled** even inside the range (`availableDays`).

Controlled component: `value` (selected ISO), `onChange`, `maxDate` (today), plus the optional
`minDate` / `availableDays` / `loadedMonths` availability set. Month navigation is local view state;
picking a day calls `onChange`.

### Why empty days are disabled, not just unhelpful (September 2026)

**Why:** the only bound used to be `maxDate`, so every day back to year zero was clickable and each
one dead-ended on "No daily puzzle for …". The fix is deliberately **data-driven rather than a
hardcoded launch date**, for a reason the live data makes concrete: boards begin `2026-07-11`, but
`2026-07-24` holds none (the cron missed it). A "nothing before July" rule would have left a
clickable hole mid-month. `minDate` handles the floor; `availableDays` handles the holes. Both come
from `GET /api/daily/days` — see [that route's doc](../../../app/api/daily/days/route.md).

### Why an absent `minDate` still pages freely

`minDate` absent means **genuinely unbounded** — the component's original behaviour, which its own
paging test relies on. A caller whose bound is still loading must not simply omit it: that leaves
"‹" live during the fetch, and a fast double-click can land on a month the response then greys out
entirely *and* locks, leaving "›" as the only escape. `ArchiveExperience` passes the visible month's
first day as a **provisional floor** until the real one arrives, so "‹" waits for the bound it needs
rather than the component inventing a "bound unknown" state.

### Why `loadedMonths` exists

Availability arrives asynchronously, so an empty `availableDays` is ambiguous — it means either
"this month genuinely has no boards" or "the fetch hasn't landed". Treating unknown as unavailable
would grey out the whole month on first paint and then un-grey it a moment later. A day is
disabled only once **its own month** is in `loadedMonths`; until then it renders normally.

### Why the greyed state is in the accessible name

A disabled day's only visual cue is opacity, and `disabled` alone doesn't distinguish "no puzzles
that day" from "in the future". Days with no boards carry `"<day> <month> <year> — no puzzles"` as
their `aria-label`, so the reason survives without colour (WCAG 1.4.1).

## Completion markers (`tallies`, optional)

Each day can carry a small dot showing how much of that day's daily set the viewer finished —
filled when all done, faded when partly done, hollow when none. `tallies` maps an ISO date to
`{ done, total }` **combined across both sets**; the archive keeps Standard and Minis apart in
its own line beneath the calendar, since one dot per cell can't carry two fractions.

- **A day with no tally is left plain.** No stored dailies means no denominator — showing `0/0`
  would read as a missed day rather than a day that never existed.
- **The count goes in the day's `aria-label`** ("4 August 2026 — 2 of 6 completed"). The dot alone
  says nothing about the numbers, and colour/fill must not be the only channel carrying the
  distinction (WCAG 1.4.1).
- **The dot's space is reserved on every cell** (`opacity-0` when unmarked) so day numbers don't
  shift between marked and unmarked days.

## Why month paging is reported (`onMonthChange`)

The parent fetches tallies a month at a time, so it must know which month is on screen. Paging is
the *only* event that can change that — picking a day cannot, because only in-month days are
clickable — so the callback fires from the prev/next handlers rather than an effect watching the
view state. Without it, one month's markers would sit on another month's grid.
