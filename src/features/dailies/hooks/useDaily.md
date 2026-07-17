# useDaily Hook (`useDaily.ts`)

Client hook that fetches today's daily puzzle from `GET /api/daily?difficulty=…` and
tracks the async lifecycle (`loading`, `error`).

## Why it is separate from `usePuzzle`

**Why:** `usePuzzle` **POSTs** to generate a fresh throwaway puzzle; a daily is instead
**fetched** so every player gets the identical stored board. Different verb, different
endpoint, different meaning — so it is its own hook rather than an overload of `usePuzzle`.

Like `usePuzzle`, it only ever runs client-side on a user action, so no puzzle logic
executes during SSR — sidestepping the hydration-mismatch pitfall (AGENTS.md §1).

```text
fetchDaily(difficulty, date?):
  GET /api/daily?difficulty=<difficulty>[&date=<YYYY-MM-DD>]
  date omitted -> today's daily; date given -> that past day's daily (archive replay).
  On non-2xx: surface the server's error message (or a friendly 404 "not ready yet").
  On success: return the puzzle payload { grid, solution, difficulty, gridSize, date }.
  Always clear the loading flag when done.
```
