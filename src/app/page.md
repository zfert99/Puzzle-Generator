# Home Page (`/`) — Puzzle Hub

The app's front door (5.4). A Server Component: a title + the presentational
[`PuzzleHub`](../features/hub/PuzzleHub.md) bento grid + a footer.

```text
title "Puzzle Lab" (Fredoka) + a Caveat "pick your poison" tagline
<PuzzleHub />   -> compact bento cards, grouped under <h2> headings:
                     Play    -> Sudoku · Killer · Keisan   (ordered by difficulty to learn)
                     Compete -> Daily · Leaderboard · Archive
                     Print   -> Print packs
footer          -> RetroBadges strip (chaos §8 flavor) + copyright
```

There is deliberately **no "Free play" card** — the three Play cards deep-link into `/play`
with their variant preselected, so they *are* free play. See
[`PuzzleHub`](../features/hub/PuzzleHub.md) for why the grouping and the ordering look the way
they do.

The PDF generator that used to live here moved to [`/generate`](generate/page.md) (the
"Print packs" card). Nav/theme/account live in the global `AppHeader`.
