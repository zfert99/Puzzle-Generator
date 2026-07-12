# Wobble (`Wobble.tsx`)

The hand-inked wobble — `feTurbulence` + `feDisplacementMap` (chaos layer §8). This is the
technique that reads most as "hand-drawn."

**Why SVG-outline only:** the filter is applied ONLY to a decorative SVG `rect` outline,
**never as a CSS filter on content**, so text inside a frame never warps.

- `WobbleDefs` renders the filter once (in the root layout).
- `WobbleFrame` overlays a wobbly rounded-rect ink outline behind its children (used on the
  `SolvedStamp` for a hand-drawn stamp edge).
