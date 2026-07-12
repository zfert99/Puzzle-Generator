# useReducedMotion (`useReducedMotion.ts`)

The single source of truth for the motion switch (design system §4/§6).

## Why one hook

**Why:** Every juice effect must respect `prefers-reduced-motion`, and the design system is
explicit that this is **one switch**, not per-component overrides. Centralizing it means the
stamp, confetti, and future micro-interactions all read the same value.

Read via `useSyncExternalStore` — `getServerSnapshot` returns `false` so server and first
client render agree (no hydration mismatch), then it reflects the real `matchMedia` value
after hydration and updates live if the user changes the OS setting.

```text
useReducedMotion() -> boolean (true = animations off)
```
