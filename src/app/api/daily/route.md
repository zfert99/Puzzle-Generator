# Daily Read Route (`/api/daily`)

`GET /api/daily?difficulty=…&date=YYYY-MM-DD` — returns a shared daily puzzle for one
difficulty, shaped so the board consumes it directly. `date` defaults to today (00:00-UTC); a
past date serves that day's puzzle for the **archive** (unranked replay). Future dates → 400.

## Why it is a thin controller

**Why:** The route only validates input and delegates to `getDailyPuzzle` in the dailies
service (AGENTS.md §1 — routes are controllers, DB access lives in services). It computes
"today" from the server clock in UTC and forces dynamic rendering so a day-stale response
is never cached.

```text
Read `difficulty` + optional `date` from the query string.
If difficulty is not a daily difficulty -> 400.
isoDate = date ?? today's UTC date; if not a real date (isIsoDate) -> 400; if in the future -> 400.
Ask the service for that day's puzzle.
If none exists yet (cron hasn't run / no puzzle for that day) -> 404 with a clear message.
Otherwise -> 200 { date, difficulty, gridSize: 9, grid, solution, clueCount }.
On any thrown error -> log server-side, return a generic 500 (no stack on the wire).
```

## Why "malformed" means "not a real date"

**Why:** The check was `/^\d{4}-\d{2}-\d{2}$/` — shape only — so `2026-02-31` and `0000-01-01`
passed, reached the Postgres `date` comparison, and 500'd at the driver. `isIsoDate` (see
[daily-row.md](../../../lib/db/daily-row.md)) is the shared guard all three date-taking routes now
use. A real date the archive simply doesn't hold still returns 404, not 400.

## Why `solution` is included (for now)

**Why:** In 4.2 play is anonymous and **unranked**, and the interactive board needs the
solution locally for mistake highlighting and hints. There is no leaderboard to protect
yet, so serving it is acceptable. **This changes in 4.4:** once solves are ranked, the
solution must no longer be served for an unranked/unsolved daily, and completion is
validated server-side against the stored solution instead (see
`Docs/archive/phase4-implementation-plan.md`, anti-cheat).

Runs on the Node.js runtime (DB driver is Node-only).

## Killer dailies

When the fetched row has cages, the response additionally includes its **stored** `variant`
(`'killer'` or `'calc'`) and `cages`, which is all `startNewGame` needs to start it as a caged
board. Everything else — validation, anti-cheat posture, archive dates — is unchanged.

**Why the variant is read, not inferred (daily restructure Step 3b).** It used to be looked up from
the board registry by key (`getDailyBoard(key).variant`). Under type-as-slot a rung key like `hard`
holds a different type each day, so that inference would mislabel the row — and a duck-type on
`cages` can't help either, since Killer *and* Keisan both carry cages (sum vs. operator+target).
The row's `variant` column (migration `0004`) is now the single source of truth.

Accepts any daily-board key (plus legacy `'killer'`); `gridSize` in the response derives from
the stored grid's length, so mini boards need no schema change.
