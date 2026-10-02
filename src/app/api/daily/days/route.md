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
-> 200 { month, first, days }, with Cache-Control: PAST_DAY_CACHE_CONTROL only when
   month < the current UTC month
```

`first` is returned even when `days` is empty, so a visitor who has paged into a month before the
archive began still gets the bound needed to stop paging further back.

`?month=` (present but empty) is a malformed value and 400s — `searchParams.get` yields `''`, which
`?? today` does not replace. Omitting the param entirely is what defaults to the current month.

## Public caching of finished months (October 2026)

A month strictly before the current UTC month gains no more days, and `first` only moves if history
is deleted — so its `200` carries `Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400`
(`PAST_DAY_CACHE_CONTROL`, in [`dailies.service.md`](../../../../features/dailies/dailies.service.md))
and pages of the archive calendar come from the CDN. The **current** month (explicit or defaulted)
still grows daily and carries no public header. `YYYY-MM` strings compare chronologically, so the
check is a plain string comparison against `isIsoMonth`-validated input. Covered in `route.test.ts`
with the clock pinned.

Node runtime (DB), `force-dynamic` — kept: it controls Next's own cache, not the CDN header, and the
handler still recomputes the current month on every request.
