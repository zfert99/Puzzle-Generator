# useCountUp (`useCountUp.ts`)

Animates a number from 0 up to `target` when it changes — the streak "roll" (§4).

## Why

**Why:** A small count-up on the streak reads as more alive than a static number appearing.
All `setState` happens inside the `requestAnimationFrame` callback (asynchronous), never
synchronously in the effect body — so it satisfies `react-hooks/set-state-in-effect`. Under
reduced motion the duration is 0, so it snaps to the target on the first frame.

```text
useCountUp(target, ms=500) -> the in-progress value (null until the first frame)
```

Used by `LeaderboardView` for the "🔥 N-day streak" number.
