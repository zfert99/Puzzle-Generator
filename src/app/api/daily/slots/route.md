# Daily Slots Route (`/api/daily/slots`)

`GET /api/daily/slots?date=YYYY-MM-DD` — lists the daily boards for a day (default today, UTC) as
lightweight metadata. `date` is optional; a past date backs the archive, and a future date is
rejected.

## Why this endpoint exists

Under the **type-as-slot** model the puzzle TYPE is rolled at cron time and stored per row, so the
client **cannot derive** which boards exist today or what type each holds — it used to iterate the
static `DAILY_BOARDS` registry, which no longer describes a given day. The picker and the
leaderboard tabs both need "what are today's boards, and what is each one?", so that answer is
served from the stored rows.

```text
Validate `date` (a REAL YYYY-MM-DD date via `isIsoDate`; not in the future) -> 400 otherwise.
rows = getDailySlotRows(isoDate)   # dailies.service: key, variant, gridSize = jsonb_array_length(grid)
Shape each into { key, variant, difficulty, gridSize, section }:
  difficulty = the rung the key refers to (difficultyForKey — handles active AND retired keys)
  gridSize   = the stored grid's row count, computed in Postgres (no grid_size column needed)
  section    = sectionForKey(key, gridSize): a rung key -> standard, mini-* -> mini,
               a retired key -> by size (< 9 is a mini)
Sort: standard slots in ladder order, then minis easy -> hard.
Return 200 { date, slots }, with Cache-Control: PAST_DAY_CACHE_CONTROL only when
  isoDate < today (UTC) AND slots is non-empty.
```

## Why the query lives in the service, and never reads `grid` (October 2026)

**Why:** the route used to run its own Drizzle `select` (AGENTS.md §1 says routes are controllers;
every sibling daily read already lived in `dailies.service.ts`) and selected the whole `grid` jsonb
per row only to read `.length`. That shipped every cell of every board — up to 81 × 11 per call —
from Postgres on each picker load, to compute one integer. `getDailySlotRows` now asks Postgres for
`jsonb_array_length(grid)` instead (a parameter-free `sql` fragment over a column reference, so no
injection surface). The response shape is unchanged; a route test asserts the query selects only
`key`, `variant` and the computed `gridSize`.

## Public caching of past dates (October 2026)

A finished day's board list never changes, so a past date's `200` carries
`Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400` (`PAST_DAY_CACHE_CONTROL`) and
is served from Vercel's CDN. Two exceptions: **today** (it is only today until midnight UTC) and a
past day with **no** slots — that is a cron miss (2026-07-24 is a real one), and caching the empty
list for a day would hide a `workflow_dispatch` backfill. `force-dynamic` stays: it controls Next's
own cache, not the CDN header, and the handler still recomputes "today" on every request. Covered in
`route.test.ts` with the clock pinned.

## Why the date must be a real date, not just a well-formed one

**Why:** The old check was a shape regex, so `2026-02-31` reached the `where date = …` query and
the driver rejected it — a 500 from input the route had accepted. `isIsoDate` (see
[daily-row.md](../../../../lib/db/daily-row.md)) answers the existence question instead. Note this
route's future-date comparison masked *part* of the problem (`9999-99-99` was caught as "future"),
which is exactly why the fix belongs in the shared guard rather than in each route's own regex.

## What it deliberately does not return

**No `grid` and no `solution`.** This is picker metadata only — the playable board (and the
solution the interactive board needs locally) comes from `GET /api/daily`, which is the single place
that anti-cheat posture is reasoned about. Keeping this endpoint solution-free means it can stay
public and cheap without widening the surface that serves answers.

**Why `section` comes from the key first and the grid size only for retired keys.** For active
boards the key is the truth — a bare rung is a standard slot *whatever its size*, which matters since
Skyscrapers' standard is the 6×6 (Skyscrapers plan D5, the first non-9×9 standard; "smaller than
9×9 ⇒ mini" would have filed a `hard` Skyscrapers under the minis). For **retired** keys the prefix
lies (`mini4-medium`, `killer6-hard`, `calc4-easy` carry no `mini-` prefix) but every retired
standard was 9×9, so size decides there — filing them under Standard once rendered several
indistinguishable "Medium · Classic" pills on an archived day. One rule, `sectionForKey` in
`daily-row.ts`, shared with the playing label, the continue banner and the progress aggregate;
both cases are route tests.

## Archive behaviour

For a past date this returns whatever boards that day actually had — including retired keys from
the pre-restructure 30-board registry (`killer-hard`, `calc9-easy`, …). That is intentional: an
archived day should render the boards it really contained. The one transitional oddity is the
**cutover date itself**, which holds both old-registry rows and the first rolled slots; it
self-heals the next day, when the cron produces only the 6 rolled boards.

## Ordering

`sortIndex` puts the standard rungs first (in ladder order), then the three mini tiers, then anything
else — retired keys, which only appear on archived dates and have no meaningful order among
themselves. It is written as explicit early returns rather than a chain of `??`: `??` binds looser
than `+`, so the compact form grouped as `rung ?? (100 + mini)`, which happened to be equivalent but
read like a precedence bug.
