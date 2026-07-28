# Leaderboard Service (`leaderboard.service.ts`)

Reads for a single daily puzzle's board.

## Why public reads, but self-rank stays scoped

**Why:** The board is shared, so the top-N read has no ownership filter. But a caller's *own*
rank is still derived from their session id by the route (never a client-supplied id), so
"my rank" can't be spoofed to peek at someone else's placement. Ordering is served by the
`(puzzle_id, time_ms)` index; only completed attempts count.

## `getLeaderboard(db, puzzleId, limit=20)`

**Why join `user`:** Entries need a display name, so it joins the better-auth `user` table.
The name is `coalesce(username, name)` — the chosen public handle, falling back to the account
name if none is set. Ascending by time; rank is the row position.

```text
SELECT userId, user.name, time_ms, mistakes
  FROM solve_attempts JOIN user
  WHERE puzzle_id = puzzleId AND completed
  ORDER BY time_ms ASC LIMIT limit
-> attach rank = index + 1
```

## `getUserRank(db, puzzleId, userId)`

**Why a COUNT, not a scan:** Rank = `1 + (completed attempts strictly faster)`, computed with
a single COUNT so it stays cheap as the board grows. Ties share a rank. Returns null if the
user hasn't completed the puzzle.

## `getUserRanksForPuzzles(db, userId, puzzleIds)`

**Why:** the batched form of `getUserRank` — same `1 + (strictly-faster count)` rank and tie
semantics, but for many puzzles in **one** query instead of two-per-puzzle. It self-joins
`solve_attempts` (the caller's own row per puzzle) against a `faster` alias (completed attempts with
a smaller time), `LEFT JOIN` so rank-1 puzzles survive, and `GROUP BY puzzle_id`. Returns a
`Map<puzzleId, rank>`; a puzzle the user hasn't completed is absent. Kills the N+1 in
`/api/me/today` (up to ~11 dailies × 2 queries → a single grouped query).

```text
SELECT me.puzzle_id, count(faster.id) AS faster
  FROM solve_attempts me
  LEFT JOIN solve_attempts faster
    ON faster.puzzle_id = me.puzzle_id AND faster.completed AND faster.time_ms < me.time_ms
  WHERE me.user_id = userId AND me.completed AND me.puzzle_id IN (puzzleIds)
  GROUP BY me.puzzle_id
-> Map(puzzle_id -> faster + 1)
```
