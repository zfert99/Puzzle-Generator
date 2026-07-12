# Global Styles (`globals.css`)

The design-token layer + base styles. As of Phase 5.1 this hosts the **Biscuit Lab**
design system's tokens (Tailwind v4, CSS-first).

## 1. How theming works (why `@theme inline` + `[data-theme]`)

**Why:** Colors must switch at *runtime* (a user toggle), but Tailwind's `@theme` normally
bakes values at build time. The solution:

1. Define the real values as plain CSS vars on `:root` (light) and `:root[data-theme="dark"]`
   ("lab at night") — these flip when the `data-theme` attribute changes.
2. In `@theme inline { --color-paper: var(--paper); … }`, map each token to its var. The
   `inline` keyword makes the generated utilities emit `var(--paper)` (not a resolved hex),
   so `bg-paper`, `text-ink`, `border-ink`, `bg-butterscotch`, `rounded-md`, `shadow-chunky`,
   `font-display`, etc. all follow the live theme.

```text
:root                    -> Biscuit Lab light values + legacy tokens
:root[data-theme=dark]   -> the same names, dark values
@theme inline            -> --color-*/--radius-*/--shadow-chunky/--font-* = var(--token)
```

## 2. Why the legacy tokens are still here

**Why:** `--background/--foreground/--accent/--border` (and `.glass-panel`, `.btn-primary`,
`.input-field`) back the not-yet-restyled indigo/glass UI. They're kept — and now *also*
flipped by `[data-theme]` (the old `prefers-color-scheme` block was folded in) — so the
theme toggle works across the whole app *during* the migration. Each is removed in 5.2 once
its surface is restyled.

## 3. Signature utilities

**Why:** The **`.pressable`** class encodes the design system's core mechanic — a 3px ink
border + a hard `4px 4px 0 0` offset shadow (no blur, GPU-cheap) that **collapses on
`:active`** (the element translates into its own shadow). `shadow-chunky` is the same shadow
as a token. Both respect `prefers-reduced-motion`.

## 4. Keyframes

The Phase 3/4 celebration keyframes (`pop-in`, `bounce-soft`, `rank-reveal`, `celebrate`)
remain until 5.3 replaces the solved moment with the Motion "stamp" sequence. All disabled
under `prefers-reduced-motion`.
