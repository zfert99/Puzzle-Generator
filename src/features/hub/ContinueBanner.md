# ContinueBanner (`ContinueBanner.tsx`)

The front-door "continue" affordance, shown above the hub's bento grid.

## What it does

Reads **both** saved-game slots (`useSavedSlots` in `saved-slots.ts` — a parked daily and a
parked free-play game live under separate localStorage keys since October 2026) and renders one
bar per slot that holds a game, daily first, each linking to the surface that owns it
(`/daily?resume=1` or `/play?resume=1`), where the game resumes. It renders **nothing** when
neither slot holds a game, which is also the SSR/pre-mount default (the slots read `null` until
mounted), so there's no hydration flash.

**Why storage, not the store:** the board store holds only the active slot's game, and the hub
activates none. Reading the keys directly is the only way to show both — and a hub mount is a
safe moment to do it once (nothing on the hub can change a slot).

## Why it links to the surface rather than deep-linking into the board

Continue is offered in three places (hub + each config screen). The hub banner routes to the
owning surface's menu, where the same Continue button resumes play. Keeping the actual resume
on the surface avoids threading a "resume now" signal through the URL (and the Suspense/render
caveats that `useSearchParams` would add), at the cost of one extra click from the hub.

## The label names the type (R1 review)

A saved board reads **"Hard 6×6 · Kakuro"** / **"Medium · Killer"** — the same difficulty · size ·
type composition the daily picker uses (`slotLabel`, from the saved board's own `variant` and
`gridSize`), prefixed "Daily ·" or "Practice ·" for a daily-shaped board. The first version named
only Killer and labelled every other type by size alone ("6×6 · hard"), which four types made
ambiguous — a parked Kakuro mini read like a Sudoku. An unregistered variant (none today) falls
back to the bare key label, visible rather than invented.

## "Daily" vs "Practice" — `mode` alone cannot tell them apart

**Why:** `mode: 'daily'` means "a daily-shaped board", **not** "today's ranked daily". Two things
land in that mode carrying an older `dailyDate`:

- an **archive replay** — `ArchiveExperience` starts boards as `startNewGame(puzzle, 'daily', thatDate)`;
- a **daily left running past 00:00 UTC**, which `DailyExperience` already treats as expired and
  unrankable (`isExpiredDaily`).

Branching on `mode` alone labelled both of them "Daily", so the hub's front door told a player their
parked *practice* board was the ranked daily they still owed. The date is the only thing that
separates them, so the label compares `dailyDate` against today (UTC) and says **"Practice · &lt;rung&gt;"**
when they differ.

The link is unchanged (`/daily?resume=1`): `/daily` is the correct home for any daily-shaped board
whose date isn't today — it already handles the expired case, drops the submit, and now marks the
board "practice" in its own header. `ContinueBanner.test.tsx` pins the distinction.

## Section by key (Skyscrapers R1 — D5)

The saved board's section comes from `sectionForKey(saved.difficulty, saved.gridSize)`, not from
"smaller than 9×9": a saved `hard` Skyscrapers is a 6×6 **standard** and labels as
"Hard 6×6 · Skyscrapers".

## Clock leaf and contrast (October 2026)

- **The elapsed time is `<SavedElapsed />`**, not `formatElapsed(saved.elapsedTime)`.
  `useSavedGame` dropped `elapsedTime` so its callers stop re-rendering once a second; the one
  leaf that draws the clock subscribes to it instead (see
  [`SavedElapsed`](../interactive-board/components/SavedElapsed.md)).
- **The "▶" glyph is `aria-hidden`**, so the link's accessible name starts "Continue your
  puzzle" rather than "black right-pointing triangle".
- **`text-on-butterscotch`** replaces `text-ink` on the butterscotch bar: `--ink` flips to cream
  in the dark theme, about 1.5:1 against butterscotch.
