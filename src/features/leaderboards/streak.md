# Streak Logic (`streak.ts`)

Pure computation of a user's current daily streak from the set of UTC dates they completed.

## Why separated from the query

**Why:** Consecutive-day arithmetic (with month/year boundaries and a grace day) is fiddly
and easy to get wrong, so it lives here — pure, with no DB or clock — and is unit-tested
across the tricky cases. The service just fetches the dates and calls this.

## `currentStreak(completedDates, today)`

**Why the "yesterday" grace:** A streak that ends *yesterday* still counts as active —
today's puzzle may simply not be done yet — so the streak doesn't look broken every morning.
A gap before today/yesterday ends it.

```text
Anchor at today if completed, else yesterday (grace), else return 0.
Walk backwards one UTC day at a time while each day is in the completed set; count the run.
(Input may be unsorted / contain duplicates — handled via a Set.)
```
