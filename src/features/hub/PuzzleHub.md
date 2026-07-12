# Puzzle Hub (`PuzzleHub.tsx`)

The app's front door (5.4) — a compact, aligned bento grid of puzzle types.

## Why compact + aligned

**Why:** The hub is browsed quickly, so the updated design uses a **compact** grid
(`minmax(150px, 1fr)`) on a **fixed, aligned** layout (not a scattered "desk") — more
puzzles visible at once. Chaos decoration (stickers, per-card tilt) sits *on top* of the
orderly grid, never scattering it. A Server Component: just links + presentational cards.

Cards: Daily · Free play · Leaderboard · Print packs (the PDF generator, moved to
`/generate`), plus a dimmed **"Killer — coming soon"** card so the layout visibly accepts
future puzzle types (Phase 6+).
