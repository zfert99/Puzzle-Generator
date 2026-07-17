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
