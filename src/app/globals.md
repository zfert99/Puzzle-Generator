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

**Why light-theme `--cherry` is `#BB2822`, not the more vibrant `#D8453F` it started as
(July 2026):** `text-cherry` is the app-wide error-text color (auth errors, form errors,
"no daily puzzle" messages, etc. — every `text-cherry` usage across the app reads this same
token). The original light-theme value measured 3.93:1 against `--paper` and 3.54:1 against
`--paper-2`, both below WCAG AA's 4.5:1 minimum for normal text — a real, live violation
that stayed undetected because the axe e2e suite (`e2e/a11y.spec.ts`) only ever exercised
pages in states that don't render an error message, until a genuinely-empty "no daily
puzzle for {date} yet" state surfaced it. `#BB2822` is the same hue, darkened just enough to
clear 4.5:1 against both light-theme backgrounds with margin (4.99:1 / 5.53:1) — the
dark-theme cherry (`#F06B65`, 6.04:1 against dark `--paper`) already passed and is
untouched.

**Why the "on-fill" ink tokens exist (October 2026):** `--ink` flips to cream in the dark
theme, but `--butterscotch` stays a mid-light fill in both — so `text-ink` on
`bg-butterscotch` (every primary button and selected pill) measured **1.5:1** in dark mode.
`--on-butterscotch` (`#2B1B12` in both themes) is the ink for anything sitting on butterscotch,
and `--on-sticker` the same for the never-flipping sticker fills (cream on lime was 1.25:1).
Two text-grade tones joined them: `--mint-text` and `--warn-text`, because the fill-grade
`--mint` (2.3:1) and `--butterscotch-dark` (2.6:1) fail WCAG 1.4.3 as small text on paper.
The light `--mint-text` first shipped as `#1B7A5B`, which measured 4.31:1 on the *panel*
paper (`--paper-2`, the darker of the two) once the post-landing look checked it in the
browser; `#15684E` clears both papers (6.1:1 / 5.5:1).
`color-scheme` is declared per theme so native controls and scrollbars follow the toggle.
The first dark-mode axe run in `e2e/a11y.spec.ts` is what caught all of these.

The **sticker tokens** (`--sticker-pink/lime/sky`) are also defined but **quarantined —
decoration only** (the 5.5 chaos layer: stickers, tape, pins, marginalia), never text/
buttons/functional UI, and they do **not** flip by theme. The chaos layer also adds
`--font-marker`/`--font-caveat` and CSS helpers — `.tilt-a…d` (a fixed set of rotations),
`.wobble-hover`, `.idle-wobble`, `.marquee*` — all disabled under `prefers-reduced-motion`
and all for chrome only (never the solve grid).

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
- `.input-field` → paper fill, 2px ink border, **grape** focus ring (butterscotch measured
  1.95:1 against paper, under the 3:1 a focus indicator needs — WCAG 1.4.11; October 2026).
- `.skip-link` → the "Skip to content" link the root layout renders first in `<body>`
  (WCAG 2.4.1): off-screen via `translateY(-200%)` until `:focus-visible`, then a chunky
  butterscotch pill over the header. Every page's `<main>` carries `id="main"` for it.

`body` is now paper/ink with the Manrope sans; `h1`/`h2` default to the Fredoka display face.

`html, body` also carry `overflow-x: hidden` (July 2026) — a defensive baseline against any
single component's stray overflow (rotated chaos-layer decoration with negative offsets, a
mispositioned anchored panel, etc.) turning into page-wide horizontal scroll on mobile. Not
a fix for one specific component; catches the whole class of bug.

## 4. Signature utility

**Why:** `.pressable` / `shadow-chunky` encode the core mechanic — a 3px ink border + a hard
`4px 4px 0 0` offset shadow (no blur, GPU-cheap) that **collapses on `:active`** (the element
translates into its own shadow). Both respect `prefers-reduced-motion`.

## 5. Board cells

The board (`Board.module.css`) derives its cell colors from the same global tokens
(`color-mix` with `--paper` for tints), so cells flip with `[data-theme]` — mono digits,
ink givens, grape user entries, butterscotch selection, grape same-number, cherry errors.
It also carries the 5.3b cell micro-interactions: `.selected` pops (`cell-pop`) when the
selection lands, and `.error` shakes once (`cell-shake`, cell-local — never a viewport
shake) atop its persistent tint. Both are disabled under `prefers-reduced-motion`.

## 6. Keyframes

- `rank-reveal` — the "Ranked #N" text pop.
- `page-enter` — the route transition (`.page-enter` on `template.tsx`'s wrapper): opacity
  0→1 + 8 px slide, 150 ms. CSS rather than the `motion` library since October 2026, because
  the library version server-rendered `opacity:0` and held every page invisible until
  hydration — see [template.md](template.md).
- `stamp-pop` / `stamp-flash` — the solved badge's scale 0 → 1.15 → 1 squash and the single
  opacity screen-flash, formerly Motion animations in
  [SolvedStamp](../features/juice/SolvedStamp.md). The last consumer of `motion`, so the
  dependency is gone.

All are switched off under `[data-motion="reduce"]`.

## 7. Reduced motion has a CSS fallback (October 2026)

**Why:** every motion rule above keys off `data-motion`, which only the pre-paint script and
`applySettings` set — and the script's single `try` also wraps its `localStorage` read, so a
browser that blocks site data never applied the OS preference at all: the backdrop drift,
marquee and wobbles kept running for a user who had asked for none. The closing block
mirrors every `data-motion="reduce"` rule under `@media (prefers-reduced-motion: reduce)`,
scoped to `:root:not([data-motion="full"])` so an explicit in-app **Full** choice (which now
sets `data-motion="full"`, see `settings.md`) still wins over the OS.
