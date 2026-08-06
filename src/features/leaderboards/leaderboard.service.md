# Leaderboard Service (`leaderboard.service.ts`)

Reads for a single daily puzzle's board.

## Why public reads, but self-rank stays scoped

**Why:** The board is shared, so the top-N read has no ownership filter. But a caller's *own*
rank is still derived from their session id by the route (never a client-supplied id), so
"my rank" can't be spoofed to peek at someone else's placement. Ordering is served by the
`(puzzle_id, time_ms)` index; only completed attempts count.

## `getLeaderboard(db, puzzleId, viewerId=null, limit=20)`

**Why join `user`:** Entries need a display name, so it joins the better-auth `user` table.
The name is `coalesce(username, name)` — the chosen public handle, falling back to the account
name if none is set. Ascending by time; rank is the row position.

```text
SELECT user_id, user.name, time_ms, mistakes
  FROM solve_attempts JOIN user
  WHERE puzzle_id = puzzleId AND completed
  ORDER BY time_ms ASC LIMIT limit
-> rank  = index + 1
-> isBot = user_id === BOT_USER_ID
-> isMe  = viewerId !== null && user_id === viewerId
-> DROP user_id; it does not appear in the returned entry
```

**Why the row's `user_id` is read but never returned.** This endpoint is public and
unauthenticated, so everything it returns is world-readable, and `solve_attempts.user_id` is the
better-auth account id that sessions are keyed to. It was being shipped only so the client could
derive two booleans — "is this me?" and "is this the bot?" — which the server can answer without
handing out identifiers. Not exploitable on its own (no route accepts a `userId`; ownership always
comes from the session), but it is the enumeration surface OWASP A01 warns about, and a DTO is the
standard answer. The mapping destructures `user_id` out explicitly rather than spreading the row,
so re-adding it has to be a deliberate act.

**Why `viewerId` is a parameter, not a request field.** It is the caller's **session** id, supplied
by the route. A client-supplied id would let anyone ask "which row is this other person?" — the
same BOLA rule the rest of this feature follows.

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
