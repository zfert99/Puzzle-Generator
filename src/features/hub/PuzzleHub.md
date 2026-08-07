# Puzzle Hub (`PuzzleHub.tsx`)

The app's front door (5.4) — a compact bento grid, **grouped** into Play / Compete / Print.

## Why compact + aligned

The hub is browsed quickly, so the design uses a **compact** grid (`minmax(150px, 1fr)`) on a
**fixed, aligned** layout (not a scattered "desk") — more puzzles visible at once. Chaos
decoration (stickers, per-card tilt) sits *on top* of the orderly grid, never scattering it.
A Server Component: just links + presentational cards.

## Why the cards are grouped (August 2026)

Before this change the hub was a flat 7-card grid that **interleaved puzzle types with modes** —
Killer and Keisan (types) sat alongside Daily, Free play, Leaderboard, Archive and Print packs
(modes). The asymmetry that prompted the rework: there was **no plain Sudoku card at all**, even
though the other two types had one, so a player looking for ordinary Sudoku had to infer that
"Free play" meant it.

Three groups now, each introduced by a real `<h2>`:

| Group | Cards |
|---|---|
| **Play** | Sudoku · Killer · Keisan |
| **Compete** | Daily · Leaderboard · Archive |
| **Print** | Print packs |

Plan of record: `Docs/qa-remediation-plan.md` → Step 4.

### Why there is no "Free play" card

The type cards *are* free play — each deep-links into `/play` with its variant preselected
(`/play`, `/play?variant=killer`, `/play?variant=calc`), so a separate card would be a fourth
door into the same room. `/play` stays reachable from the global header.

### Why the Play group is in that order

Ordered by **difficulty to learn**, not by generator cost:

1. **Sudoku** — rules everyone already knows.
2. **Killer** — those rules, plus cage sums.
3. **Keisan** — a different constraint model (Latin square, *no boxes*), four arithmetic
   operators, and the optional mystery/no-op mode.

This also matches the order the `/play` picker already uses (`classic, killer, calc`), so the hub
and the picker do not disagree about which type comes first.

### Why one grid rather than one grid per group

A grid per group would size its cards independently, so the one-card **Print** group would
stretch that card across the whole row. Instead every card lives in a **single** grid and the
headings span it (`col-span-full`), which forces the row break between groups while keeping every
card the same size in every group.

The grid is capped at `max-w-[640px]` so `auto-fit` with `minmax(150px, 1fr)` settles on exactly
**3 columns** on desktop — the width at which each three-card group fills its row exactly. Above
that width `auto-fit` would pack 4 tracks and the groups would break raggedly. It still collapses
to 2 columns and then 1 on narrow screens, so the mobile reflow is unchanged.

## Headings are `<h2>`, deliberately

The group labels are real headings, not styled `<div>`s: they form the page's document outline
under the `<h1>`, so a screen-reader user can jump between groups the same way a sighted user
scans them. (WCAG 1.3.1 — the same reasoning as the `role="grid"` work tracked in the plan's
Step 6.)

## The "new!" sticker

Follows whatever shipped last — currently **Keisan**. Move it when the next puzzle type lands;
do not leave two.
