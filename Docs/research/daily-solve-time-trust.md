# Daily Solve-Time Trust — why the plausibility floor guards nothing, and what does

**Status:** 📋 Analysis, unimplemented. Written 2026-08-05 during the
`fix/solve-and-username-hardening` review pass. **Gates Phase 9's crumbs economy** — see
[roadmap.md](../roadmap.md) Phase 9 and
[social-progression-economy-plan.md](../social-progression-economy-plan.md).

This is not a report of a bug in shipped code. `/api/solve` behaves exactly as designed. It is a
record of *how much the design actually buys*, written down because the number is smaller than the
code comments imply and because Phase 9 is about to depend on it.

## The posture, as designed

[solve-rules.ts](../../src/features/leaderboards/solve-rules.ts) states the tradeoff plainly, and
the reasoning is sound:

> we keep serving the solution to the board (so hints/mistake-highlighting work) and rely on these
> server-side checks — grid equality, a plausibility floor, one attempt per user — rather than
> hiding the solution. A sudoku is externally solvable anyway, so hiding it buys little for real
> cost.

Ranking uses the **client's** in-game timer so that save-and-continue is fair: a player who parks a
daily and resumes hours later shouldn't have the away-time counted. Three guards compensate:

| Guard | Where | Attacker-controlled? |
|---|---|---|
| Grid verified against stored solution | `recordSolve` | No |
| One ranked attempt per user per puzzle | conditional UPDATE (Aug 2026) | No |
| Plausibility floor (`minSolveMs`) | `isImplausiblyFast` | **Yes — see below** |

## The finding: the floor is compared against a number the attacker supplies

`isImplausiblyFast(variant, size, difficulty, timeMs)` returns `timeMs < floor`, where `timeMs`
is the client's `timeMs` field. Nothing else constrains it.

**Raising the floor therefore accomplishes nothing against a deliberate attacker.** Move
`classic-4-easy` from 3 s to 20 s and the scripted submission becomes `20001`. The attacker's cost
is editing one integer. This is the part that is easy to get wrong when reading the code: the floor
*looks* like input validation, and it is — it excludes accidental garbage and a mis-wired client.
It is not, and cannot be at any value, a defense against someone choosing what to send.

### The concrete path, four requests

1. `GET /api/daily/slots?date=<today>` — the day's keys. Public, unauthenticated.
2. `GET /api/daily?difficulty=mini-easy` — returns `grid` **and `solution`**. Public,
   unauthenticated, by design (the board needs it for hints and mistake highlighting).
3. `POST /api/daily/start {difficulty: 'mini-easy'}` — needs a real signed-in account.
4. `POST /api/solve {difficulty: 'mini-easy', grid: <the solution from step 2>, timeMs: 3001}`.

No puzzle is solved at any point. The only real cost is one registered account.

### The numbers that make minis the soft target

`mini-easy` and `mini-medium` are **always 4×4** (`rollDailyAssignment` rolls size only for the
`mini-hard` slot), and 4×4 floors are the lowest in the table:

| Board | `minSolveMs` | Puzzle Bot posts | Scripted submit ranks |
|---|---|---|---|
| `classic-4-easy` | 3 000 ms | 40 000 ms | **1st, at 3.001 s** |
| `calc-4-easy` | 4 000 ms | 55 000 ms | 1st |
| `killer-4-easy` | 4 000 ms | 60 000 ms | 1st |
| `classic-9-extreme` | 45 000 ms | 1 500 000 ms | 1st |

The 9×9 rungs are no safer in kind — only in the wall-clock an honest player expects. Every row is
first-placeable by a submission that never renders a board.

## What is available and unused: a second clock

`/api/daily/start` already stamps `solve_attempts.created_at` from the app clock, and
`getUserAttemptForPuzzle` selects the whole row — so `recordSolve` **already holds
`attempt.createdAt`** and ignores it. Server elapsed (`now − created_at`) is an upper bound on how
long the player could possibly have been on the board, and it is not attacker-controlled.

Two checks follow:

```text
serverElapsed = now − attempt.created_at
A.  clientTimeMs <= serverElapsed + skewTolerance   # can't claim more play than wall-clock
B.  serverElapsed >= floor                          # can't submit N seconds after starting
```

**B is the one that matters.** It converts the floor from a number the attacker picks into
wall-clock the attacker must burn. A is nearly free but catches little on its own.

**Neither breaks save-and-continue** — which is the reason server timing was rejected originally,
so it is worth being explicit about why. Save-and-continue needs client time to be *smaller* than
wall-clock. A and B only constrain client time from *above* and require wall-clock to be *large*. A
player with 8 h of wall-clock and 12 min of in-game time passes both trivially. The original
rejection was of *server-measured ranking*; this is server-measured *bounding*, which is a
different thing and costs nothing the design cares about.

## Why this was not shipped with the August 2026 hardening PR

Two reasons, one of them a genuine cost.

**1 — It has a false-rejection edge on exactly the boards it targets.**
[DailyExperience.tsx](../../src/features/dailies/components/DailyExperience.tsx) fires
`/api/daily/start` **fire-and-forget** (`.catch(() => {})`), not awaited, concurrently with
`startNewGame`. If that request lands late on a slow connection, `created_at` is stamped late and
`serverElapsed` reads *smaller* than the truth. On a 9×9 (floors 15–90 s) that is noise. On
`classic-4-easy` (3 s), a 3-second-late stamp plus a genuine 5-second solve is a **rejected honest
solve** — and telling a real player their legitimate solve was "implausibly fast" is a worse
outcome than a scripter topping a flavor leaderboard.

Any implementation must therefore fix the stamp first: await `/api/daily/start` before starting the
timer, or have it return the server timestamp for the client to anchor to. That is a real change to
the daily flow, not a service-layer tweak.

**2 — It is a speed bump, not a solution.** The attacker sleeps 3 seconds. B makes casual scripting
annoying and makes the floor numbers mean something for the first time; it does not make the
leaderboard trustworthy. Against a determined attacker with a real account, nothing short of not
serving the solution helps — and that costs hints and mistake highlighting, for a puzzle that is
externally solvable anyway. The original reasoning holds.

## Options considered

| Option | Cost | Verdict |
|---|---|---|
| **Raise the floors** | Free | ❌ **Buys nothing.** Attacker submits `floor + 1`. Also risks rejecting fast honest players. |
| **A + B (server-elapsed bounds)** | ~10 lines in `recordSolve`, **plus** making the start-stamp reliable | ✅ **Recommended, gated on Phase 9.** Preserves save-and-continue fully. |
| **Rank by server-measured time** | Breaks save-and-continue | ❌ Rejected in the original design; still rejected. |
| **Stop serving `solution`** | Loses hints + mistake highlighting; attacker runs their own solver on the served `grid` anyway | ❌ Poor trade, as the original doc says. |
| **Rate-limit `/api/solve`** | Small | ➖ Orthogonal. Caps volume, not the first-place submission. |
| **Accept as-is** | Free | ✅ **Correct while the leaderboard is flavor.** |

## Why Phase 9 is the gate

While the leaderboard is cosmetic, "accept as-is" is the right call: the mitigation's false-rejection
risk outweighs the threat, and Puzzle Bot's presence already signals the board is for company rather
than competition.

**Phase 9 inverts this.** Crumbs are minted by server-validated completions, and
`social-progression-economy-plan.md` states the premise as *"The server is the only mint."* That
premise is true for **completion** and false for **duration**:

- ✅ Minting a flat amount per completion is safe — the grid check is not attacker-controlled, and
  the conditional UPDATE makes it once-per-puzzle.
- ⚠️ Minting **in proportion to speed** inherits the client timer's trust level exactly. A
  speed-scaled payout on `mini-easy` is mintable at 3.001 s, every day, by four HTTP requests.
- ⚠️ Async battles (S6) decided on time inherit the same. A head-to-head is a *comparison* of two
  client-supplied numbers.

So the gate is not "harden before Phase 9" in general — it is specific: **any Phase 9 rule that
reads the clock, rather than merely the fact of completion, requires A + B to land first.** A
flat-rate crumbs payout needs nothing from this document.

## Open questions for whoever picks this up

1. **Skew tolerance for check A.** `created_at` is stamped by one serverless instance and compared
   against `Date.now()` on another. What is the realistic Vercel inter-instance clock skew, and is a
   fixed tolerance (60 s?) sufficient, or should the start response carry the server timestamp so
   the client anchors to a single clock?
2. **Reliable start-stamp.** Await `/api/daily/start` before the timer starts (adds a round-trip to
   perceived start latency), or return the server time and have the board anchor to it (keeps the
   flow, more client work)? The second is probably better but needs a look at
   `DailyExperience`/`useBoardStore`.
3. **Does check B need its own constant?** Reusing `minSolveMs` couples the anti-cheat floor to the
   must-wait duration. They may want to diverge — a generous floor with a stricter wait, or vice
   versa.
4. **Retroactive rows.** If A/B land, historical `solve_attempts` were written under the old rules.
   Leaderboards are per-puzzle-per-day, so old rows age out of relevance naturally — but if crumbs
   are ever backfilled from history, that backfill inherits the untrusted clock.

## See also

- [solve-rules.md](../../src/features/leaderboards/solve-rules.md) — the posture, as stated in code
- [solve.service.md](../../src/features/leaderboards/solve.service.md) — the guards that *are*
  server-authoritative, and why the conditional UPDATE replaced a read-then-write
- [social-progression-economy-plan.md](../social-progression-economy-plan.md) — the mint premise
  this document qualifies
- [pre-merge-log.md](../pre-merge-log.md) — the 2026-08-05 entry, which fixed the three defects
  found alongside this observation
