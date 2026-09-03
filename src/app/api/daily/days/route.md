# Archive Days Route (`/api/daily/days`)

`GET /api/daily/days?month=YYYY-MM` — which days of a month hold daily boards, plus the archive's
first date overall. Dates only; never board contents.

## Why this endpoint exists (September 2026)

**Why:** the archive calendar disabled only *future* days. Every day before the project existed was
clickable, and clicking one dead-ended on "No daily puzzle for …" — an invitation to explore a
range that is mostly empty.

A lower bound alone would not have been enough, which is the part worth remembering: **the archive
is not a contiguous range.** Boards begin `2026-07-11`, and `2026-07-24` holds none — the cron did
not produce that day. A "nothing before July" rule would still leave a clickable hole in the middle
of the month. So the calendar needs the days that *actually exist*, holes included, and they have
to be queried rather than inferred.

## Why it is public, and separate from `/api/me/progress`

`/api/me/progress` returns the caller's X/N completion counts — personal, sign-in required, and it
returns nothing when signed out. Whether a day *exists* is not personal, and a signed-out visitor
needs exactly the same greying. Reusing the progress endpoint would have made empty-day greying a
logged-in-only feature; this returns distinct dates and nothing else.

```text
month = ?month or the current UTC month; isIsoMonth(month)    # 400 otherwise (incl. year 0000)
{ days, first } = getArchiveMonth(month)   # see dailies.service.md
-> 200 { month, first, days }
```

`first` is returned even when `days` is empty, so a visitor who has paged into a month before the
archive began still gets the bound needed to stop paging further back.

`?month=` (present but empty) is a malformed value and 400s — `searchParams.get` yields `''`, which
`?? today` does not replace. Omitting the param entirely is what defaults to the current month.

Node runtime (DB), `force-dynamic`.
