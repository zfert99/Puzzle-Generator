# My Progress Route (`/api/me/progress`)

`GET /api/me/progress?month=YYYY-MM` — how many of each day's dailies the caller has completed,
for one calendar month. Backs the archive's **X/N** counts.

## Why

**Why:** Sign-in required and scoped to the session user (BOLA) — no `?userId=`. The counts are
personal, so a signed-out visitor gets no markers at all rather than a calendar full of "0/3".

```text
requireUserId()                                  # 401 if signed out
month = ?month ?? current UTC month              # 400 unless /^\d{4}-(0[1-9]|1[0-2])$/
rows  = getDailyProgress(userId, month-01, last day of month)
fold each row into its set: grid < 9x9 -> mini, else standard
-> 200 { month, days: { "2026-08-01": { standard: {done,total}, mini: {done,total} } } }
```

**Why a month per request.** The archive calendar shows a month at a time; fetching per day would
fire a request on every click, and the aggregate is one grouped query either way.

**Why the denominator is counted, never assumed.** `N` is a property of the *date*:

- Only **3 of the 5** standard rungs are drawn on a given day.
- That count grows to 5 per set as the next two puzzle types land.
- Archived dates predating the restructure hold their own historical counts (a pre-cutover day
  held 30 boards).

So `total` comes from the rows the day actually has. A day with no stored dailies is simply absent
from `days`, and the client shows no marker instead of a misleading `0/0`.

**Why the set split is by grid size.** A board is a mini iff its grid is smaller than 9×9 — the
same rule `/api/daily/slots` uses for `section`. Retired mini keys (`mini4-*`, `killer6-*`,
`calc4-*`) carry prefixes that lie, and archived dates are full of them, so size is the only
classifier that stays correct backwards. See `attempts.service.md` for why the ownership filter
sits in the query's JOIN rather than its WHERE.

Node runtime (DB + session), `force-dynamic` — per-user, never cached.

## Why the BOLA tests clear the mock

Two assertions guard the ownership rule: the signed-out case must **never reach the data layer**,
and the signed-in case must hand it the *session* id, never a request parameter. Both are call-history
assertions, so they only mean anything with a `mockClear` between tests — the first version of the
401 test used `toHaveBeenLastCalledWith` against an uncleared mock and therefore inspected a call
made by an *earlier* test, passing unconditionally. Verified by injecting the exact regression
(`searchParams.get('userId') ?? await requireUserId()`): both tests fail on it.

`DayProgress` is exported from this file and imported **type-only** by `ArchiveExperience.tsx`, so
the client renders against the endpoint's own declared shape. Redeclaring it there let the two drift
silently — a server-side rename would still compile and then throw on the first render that reads
the missing set.
