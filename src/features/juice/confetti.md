# Confetti (`confetti.ts`)

The win-moment confetti burst.

## Why lazy + capped

**Why:** `canvas-confetti` is **dynamically imported** so it costs **zero bundle** on every
route except the solve moment that actually fires it. Capped at ~40 small "crumb" particles
in the brand accents (butterscotch/grape/mint, which read in both themes) — the design
system reserves the big effect for genuine completions and keeps it cheap.

```text
fireConfetti():
  no-op on the server
  lazy-import canvas-confetti
  burst: 40 particles, spread 72, accent colors, small scalar, disableForReducedMotion
```

Callers also gate on `useReducedMotion` before calling — `disableForReducedMotion` is a
belt-and-suspenders backstop.
