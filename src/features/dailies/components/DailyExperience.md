# DailyExperience Component (`DailyExperience.tsx`)

The client orchestrator for `/daily`. Fetches today's shared puzzle and plays it on the
same Phase 3 board, so the entire interactive board (grid, numpad, header, hints, undo,
timer, mistakes) is reused rather than reimplemented.

## Why it owns a local `phase` instead of reading the store's status

**Why:** The board store is a single, localStorage-persisted source of truth shared with
`/play`. If `/daily` gated its screens on `store.status`, a game left in progress on
`/play` would flash straight onto the daily board on load. Keeping a local
`'select' | 'playing'` phase means the player always explicitly picks a difficulty first;
only after a successful fetch does `startNewGame(puzzle, 'daily')` overwrite the board and
switch to `'playing'`. The persisted store still powers the actual gameplay once started.
Passing the `'daily'` mode tags the game as owned by this surface — the mirror of the local
phase gate — so the completed daily can't leak the *other* way onto `/play` (see
`useBoardStore.md`).

## Why fetch, not generate

**Why:** A daily must be identical for everyone, so the puzzle comes from `/api/daily`
(the stored, cron-generated board) via `useDaily` — never from the client generator. This
also keeps generation off the main thread and out of SSR (AGENTS.md §1).

> **basePath:** the three direct `fetch()` calls here — `/api/me/today`, `/api/solve`,
> `/api/daily/start` — go through `apiPath()` (`src/lib/base-path.ts`) to prepend the
> `/puzzles` basePath. Next does not apply basePath to `fetch()`, so bare `/api/...` paths
> 404 under the multi-zone rewrite (the bug that broke the daily after cutover).

```text
Until hydrated: render a neutral placeholder (avoids reading persisted state during SSR).

Phase 'select':
  Show the daily difficulties and a Play button.
  If a daily-shaped board is parked (saved.mode === 'daily'): a "Continue {difficulty} · M:SS"
    button → handleContinue (restore difficulty/date from the store, resume() if paused,
    phase 'playing'; no re-fetch). Captioned with the day it came from when that is not
    today, so the picker never implies a practice board counts for today.
  On Play: if any game is parked (one slot), open the <ConfirmModal> warning first; on
    confirm — or when nothing is parked — fetch the daily, startNewGame(puzzle, 'daily', date),
    phase 'playing'.

Phase 'playing':
  Render the shared board surface (header, board/paused, numpad, keyboard hints).
  Run a 1s timer only while actively playing (frozen on the picker / when away).
  On solved: show a modal with time + mistakes and the ranked result; return to the picker.
```

## Ranked flow (4.4 UI)

**Why:** For a signed-in player the daily is competitive, so the component drives the ranked
endpoints around the reused board:

- On **Play**, it POSTs `/api/daily/start` **unconditionally** (not gated on the client
  `session`, which may still be loading — the auth cookie is what matters; a signed-out
  caller just gets a harmless 401). This records the attempt (the one-per-day lock).
- On **solved**, a one-shot guard (`submittedRef`) POSTs `/api/solve` once with the completed
  grid + mistakes + the **client timer** (`timeMs = elapsedTime * 1000`), and the returned
  rank is shown. Ranking by the client timer is what makes leaving/continuing a daily fair
  (see `solve.service.md`); only **today's** daily is submitted — a daily left over the UTC
  rollover (`dailyDate ≠ today`) is finished for fun but shown as expired, not ranked.
- The "submitting…" and signed-out states are **derived in render** from `session` + the
  submit result, so the effect never calls setState synchronously
  (`react-hooks/set-state-in-effect`).

The solved modal shows the rank (or a "sign in to be ranked" prompt when signed out) plus a
link to the leaderboard. The header carries the `AccountBadge`, a leaderboard link, and the
first-time `UsernamePrompt`.

## One attempt per day

**Why:** A daily is ranked, so it's one attempt per difficulty per day. On load (signed in)
the component fetches `/api/me/today` for the day's completed difficulties, and updates that
set locally the moment a solve succeeds. In the picker, a completed difficulty shows a ✓ and,
when selected, a "✓ Solved in m:ss · come back tomorrow" panel with a leaderboard link
**instead of** the Play button — so the board can't be replayed for a second (rejected) rank.

## Hints off

**Why:** The game view renders `<Numpad showHint={false} />` — hints are disabled for the
competitive daily (they'd hand out answers), while free play keeps them.

> The solved modal now renders the Motion [SolvedStamp](../../juice/SolvedStamp.md) (chunky
> stamp badge + confetti + screen-flash, reduced-motion-safe) in place of the old
> emoji/`celebrate` CSS (5.3a). Chaos layer (5.5): the select screen also adds a
> MarqueeTicker, a corner Sticker ("play me!"), and a Tape strip on the card — chrome
> decoration only; the board itself stays clean.

## Sectioned picker (July 2026)

The single chip row became sections rendered from the day's boards. Selection state holds the board
KEY.

**Type-as-slot rework (daily restructure Step 3b).** The picker used to render the static
`DAILY_BOARDS` registry grouped into four sections (Classic 9×9 / Killer 9×9 / Minis / Keisan) — a
30-pill wall. It now fetches **`GET /api/daily/slots`** and renders that day's real boards in two
sections, **Standard** and **Minis** (6 pills today). The fetch is required, not a nicety: the type
is rolled per day and stored, so the client cannot derive today's line-up from any static table.

Pills are labelled via `slotLabel` ("Hard · Killer") rather than `formatDailyKey`, since a bare rung
key is ambiguous once the type varies by day. `formatDailyKey` remains the fallback for the header
and Play button before the slot list resolves (and for the Continue banner, which restores a saved
key with no variant context).

## Two labels, because the picker and the board can disagree

**Why:** there are two questions here, and one variable was answering both.

- `selectedLabel` — looks the selected key up in **today's** slots. Correct for the picker and Play
  button, which only ever offer today's boards.
- `playingLabel` — composed from the **board actually loaded** (`variant`/`gridSize` straight out of
  the board store, with `difficultyForKey` stripping any `mini-` prefix and `gridSize < 9` deciding
  the mini/standard split, the same rule `/api/daily/slots` uses).

They diverge whenever `dailyDate` isn't today — an archive replay or a daily left running past the
UTC rollover. **A slot key is not an identity:** `hard` held Killer on 3 August and Keisan on
6 August, so the playing header labelled a 3-August Killer board "Hard · Keisan" purely because that
is what `hard` happens to mean today. The board's own variant cannot drift like that. The header
also appends **· practice** when `isExpiredDaily`, and the picker's Continue button says which day
the parked board is from rather than implying it counts for today (the submit is dropped for any
non-today board regardless — this only stops the UI from claiming otherwise).

## Desktop width (July 2026)

The config panel is `max-w-md md:max-w-2xl` — the three chip sections fit without page
scroll on desktop while the mobile layout is unchanged.

## Full-board review (July 2026)

Dailies give no live error feedback, so completion is judged on **fullness**, not correctness.
When every cell is filled:

- correct → the existing "Daily solved!" (won) modal + ranked submit; otherwise
- incorrect → a **"Not quite!"** modal reporting how many cells are wrong (`wrongCount`) —
  *not which* — with a "Keep looking" dismiss. The dismissal resets whenever the board drops
  below full (adjust-state-during-render keyed on previous fullness), so each re-fill reports a
  fresh count. `status === 'solved'` suppresses the review modal, so the two never overlap.

### Opt-in error reveal (July 2026)

The "Not quite!" modal also offers a **"Show me what's wrong"** button (hidden once already
used) alongside "Keep looking". It calls the board store's `revealErrors()`, which flips
`errorsRevealed` to `true` — a one-way, per-attempt override that `Cell`/`BoardAnnouncer` read
to highlight (and announce) wrong cells on this daily for the rest of the attempt, same as the
free-play `errorHighlight` setting would. This is a deliberate ask from the modal, not a
passive default: the board otherwise stays hand-holding-free per the rule above, and
`errorsRevealed` resets to `false` on the next `startNewGame` (see `useBoardStore.md`).
