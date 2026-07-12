# Puzzle Card (`PuzzleCard.tsx`)

One compact bento tile in the hub.

**Why:** Chunky but scaled down (`--r-md`, 2px border, small offset shadow) per the updated
design so tiles stay small; a fixed `tilt-*` + `wobble-hover` gives the corkboard feel
(chaos §8) while the grid stays aligned. A `href` renders an interactive tile; omit it for a
dimmed, non-interactive "coming soon" placeholder. Optional decorative `sticker` overlay.

```text
emoji thumbnail · Fredoka title (Body L) · Body S desc · optional corner sticker
```
