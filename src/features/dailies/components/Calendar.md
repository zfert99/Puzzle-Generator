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
- **No hard lower bound** — a past date with no stored daily simply 404s on fetch, surfaced by
  the caller. Keeping the calendar unbounded avoids hardcoding a launch date here.

Controlled component: `value` (selected ISO), `onChange`, and `maxDate` (today). Month
navigation is local view state; picking a day calls `onChange`.

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
