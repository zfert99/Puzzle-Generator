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

The **sticker tokens** (`--sticker-pink/lime/sky`) are also defined but **quarantined —
decoration only** (the 5.5 chaos layer: stickers, tape, pins, marginalia), never text/
buttons/functional UI, and they do **not** flip by theme.

## 2. `dark:` follows the toggle

**Why:** `@custom-variant dark (&:where([data-theme="dark"], …))` overrides Tailwind's default
`dark:` (which keys off the OS media query) to key off our `[data-theme]` attribute instead,
so any remaining `dark:` utilities respond to the in-app switch. (New markup prefers semantic
tokens like `bg-paper`/`text-ink` that flip on their own and need no `dark:` at all.)

## 3. Shared component classes (5.2)

**Why:** Redefining the shared classes here restyles every panel/button/input **at once** —
the class names are kept so existing markup cascades without per-file edits:

- `.glass-panel` → a chunky card: `--paper-2` fill, 3px ink border, `--r-lg`, offset shadow.
- `.btn-primary` (butterscotch) / `.btn-secondary` (grape) / `.btn-ghost` — all share the
  **pressable** mechanic (border + offset shadow that collapses on `:active`); ghost is
  fill-less.
- `.input-field` → paper fill, 2px ink border, butterscotch focus ring.

`body` is now paper/ink with the Manrope sans; `h1`/`h2` default to the Fredoka display face.

## 4. Signature utility

**Why:** `.pressable` / `shadow-chunky` encode the core mechanic — a 3px ink border + a hard
`4px 4px 0 0` offset shadow (no blur, GPU-cheap) that **collapses on `:active`** (the element
translates into its own shadow). Both respect `prefers-reduced-motion`.

## 5. Board cells

The board (`Board.module.css`) derives its cell colors from the same global tokens
(`color-mix` with `--paper` for tints), so cells flip with `[data-theme]` — mono digits,
ink givens, grape user entries, butterscotch selection, grape same-number, cherry errors.

## 4. Keyframes

The Phase 3/4 celebration keyframes (`pop-in`, `bounce-soft`, `rank-reveal`, `celebrate`)
remain until 5.3 replaces the solved moment with the Motion "stamp" sequence. All disabled
under `prefers-reduced-motion`.
