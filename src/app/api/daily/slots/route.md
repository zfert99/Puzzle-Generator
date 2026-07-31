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
Validate `date` (ISO YYYY-MM-DD; not in the future) -> 400 otherwise.
Select every daily_puzzles row for that date: key, variant, grid.
Shape each into { key, variant, difficulty, gridSize, section }:
  difficulty = the rung (mini keys have their `mini-` prefix stripped)
  gridSize   = derived from the stored grid's length (no grid_size column needed)
  section    = 'mini' if the key starts with `mini-`, else 'standard'
Sort: standard slots in ladder order, then minis easy -> hard.
Return 200 { date, slots }.
```

## What it deliberately does not return

**No `grid` and no `solution`.** This is picker metadata only — the playable board (and the
solution the interactive board needs locally) comes from `GET /api/daily`, which is the single place
that anti-cheat posture is reasoned about. Keeping this endpoint solution-free means it can stay
public and uncached-but-cheap without widening the surface that serves answers.

## Archive behaviour

For a past date this returns whatever boards that day actually had — including retired keys from
the pre-restructure 30-board registry (`killer-hard`, `calc9-easy`, …). That is intentional: an
archived day should render the boards it really contained. The one transitional oddity is the
**cutover date itself**, which holds both old-registry rows and the first rolled slots; it
self-heals the next day, when the cron produces only the 6 rolled boards.
