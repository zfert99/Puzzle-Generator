# Home Page (`/`) — Puzzle Hub

The app's front door (5.4). A Server Component: a title + the presentational
[`PuzzleHub`](../../features/hub/PuzzleHub.md) bento grid + a footer.

```text
title "Puzzle Lab" (Fredoka) + a Caveat "pick your poison" tagline
<PuzzleHub />   -> compact bento cards: Daily · Free play · Leaderboard · Print packs · Killer(soon)
footer          -> RetroBadges strip (chaos §8 flavor) + copyright
```

The PDF generator that used to live here moved to [`/generate`](generate/page.md) (the
"Print packs" card). Nav/theme/account live in the global `AppHeader`.
