# Phase 5: Visual Redesign — "Biscuit Lab"

## Context

Phases 1–4 built the *substance* (engine, board, dailies, accounts, leaderboards) on a
placeholder **indigo / glassmorphism** skin. Phase 5 gives the app its *identity*: the
**[Biscuit Lab design system](design/design-system.md)** — a warm biscuit/butterscotch
palette with a bold grape "lab" accent, chunky Flash-portal-era UI (thick ink outlines,
hard offset "pressable" shadows, squash-and-stretch), a **mono** puzzle-grid voice, and a
calibrated **"juice"** interaction language — all on an accessible (WCAG 2.2 AA) Next.js +
Tailwind foundation. It's grounded in [web-design-and-game-juice.md](research/web-design-and-game-juice.md)
and rendered concretely in the [visual mockup](design/design-system-mockup.html).

This is a **frontend-only, presentational** phase: no API, DB, or engine changes. That
makes it lower-risk than Phase 4 and verifiable primarily by eye + accessibility checks —
but it touches nearly every component, so the discipline is in sequencing (tokens first,
then surfaces) and not regressing INP or accessibility.

## Scope & Delivery Order

Ship in independently-mergeable slices, each shippable on its own:

1. **5.1 Token & theming foundation** — colors/type/space/radius/shadow as Tailwind v4
   `@theme` tokens; fonts; the `[data-theme]` light/dark toggle. Nothing visually "done"
   yet, but the vocabulary exists.
2. **5.2 Component restyle** — migrate the shared surfaces and every route to the new
   tokens/components; retire `glass-panel`/indigo. Route-by-route so each merge is reviewable.
3. **5.3 The juice layer** — the signature interactions (pressable buttons, cell states,
   correct/wrong feedback, solved stamp + confetti, streak, transitions) at **medium**
   intensity, reduced-motion-safe.
4. **5.4 Polish & QA** — accessibility pass, INP budget, cross-route visual QA, Playwright
   smoke under the new theme.

## Decisions to Confirm (recommendations, your call)

| Decision | Recommended | Notes |
| --- | --- | --- |
| **Token home** | **Tailwind v4 `@theme` in `globals.css`** — NOT `tailwind.config.ts`. | This project is Tailwind v4 (CSS-first, `@import "tailwindcss"`); there is no JS config. The design-system doc's "map into tailwind.config.ts" line predates that — we adapt it to `@theme` so classes like `bg-paper`, `border-ink`, `text-butterscotch` are generated. |
| **Dark mode** | **Add a `[data-theme]` toggle** (system default, persisted), replacing the current `prefers-color-scheme`-only approach. | The design system + mockup key off `[data-theme="dark"]`. Needs a **hydration-safe** pre-paint script to avoid a theme flash (see pitfalls). Recommend a tiny inline script in `layout.tsx` + a cookie/localStorage, rather than a heavy dependency. |
| **Animation** | **CSS-first, Motion only where springs earn it.** | The pressable shadow, squash, cell fills, and shakes are pure CSS transitions/keyframes (cheap, GPU-friendly, no bundle). Reserve **Motion** (`motion` pkg) for the solved-stamp `AnimatePresence` sequence, and **`canvas-confetti`** (lazy-loaded) for the win burst only. Keeps INP + bundle in check. |
| **Fonts** | **Self-host via `next/font/google`**: Fredoka (display), Manrope (body/UI), Space Mono (grid/stats). | Avoids layout shift + external requests; exposes CSS vars (`--font-display`, `--font-sans`, `--font-mono`) consumed by `@theme`. Replaces the current Inter setup. |
| **Migration style** | **Route-by-route**, keeping old utilities alive until each surface is migrated. | Lets 5.2 land in reviewable pieces; delete `glass-panel`/`.btn-primary`(old)/indigo only once nothing references them. |
| **PDF output** | **Out of scope** — the generated PDF keeps its current look. | The design system is a *screen* identity; re-skinning `pdf.service.ts` is separate optional work. |

## Architecture

Frontend-only. Where things live:

```text
src/app/globals.css              # @theme tokens, base element styles, keyframes, utilities
src/app/layout.tsx               # next/font setup (3 families) + data-theme pre-paint script
src/features/theme/              # ThemeToggle (client) + tiny theme helper (get/set/persist)
src/features/juice/              # reusable juice primitives:
  PressableButton.tsx            #   the chunky offset-shadow button (primary/secondary/ghost)
  SolvedStamp.tsx                #   Motion stamp sequence for a completed puzzle
  confetti.ts                    #   lazy canvas-confetti wrapper (crumb particles)
  useReducedMotion.ts            #   single source of truth for the motion switch
# Restyled in place (no moves): PuzzleForm, PlayExperience, DailyExperience,
# LeaderboardView, AuthPanel, AccountBadge, UsernamePrompt, Board/Cell, Numpad,
# GameHeader, and every src/app/**/page.tsx shell.
```

Keep the domain boundaries from AGENTS.md §1: presentational primitives (`features/juice`,
`features/theme`) are leaf client components; page shells stay Server Components.

### 5.1 — Token & theming foundation

- **Tokens in `@theme`** (`globals.css`): define the Biscuit + Lab palettes, radii
  (`--r-sm/md/lg`), the pressable-shadow value, and the type scale as Tailwind v4 theme
  variables so utilities (`bg-paper`, `text-ink`, `border-ink`, `bg-butterscotch`,
  `shadow-chunky`, `rounded-md`) are generated. Light values on `:root`; dark values under
  `:root[data-theme="dark"]`.
- **Fonts**: `next/font/google` for Fredoka / Manrope / Space Mono in `layout.tsx`, exposed
  as `--font-display / --font-sans / --font-mono`; wire into `@theme`.
- **Theme toggle**: a `[data-theme]` attribute on `<html>`, defaulting to system, persisted
  to `localStorage` (+ a cookie so SSR can set it), with a small `ThemeToggle` in the header.
- **Signature utilities**: a `.chunky` / `shadow-chunky` utility for the `4px 4px 0 0`
  offset shadow + the `:active` translate-and-collapse, and button variants (primary /
  secondary / ghost) per the spec.

### 5.2 — Component restyle

Migrate to the tokens/components, **route by route** (each a small PR):

- **Chrome**: header/nav (grape bar, Fredoka wordmark, ghost links, `ThemeToggle`,
  `AccountBadge`), page shells, footer.
- **Home** (`/`) — PDF generator: `PuzzleForm`, difficulty/grid selectors, the cross-nav.
- **Play** (`/play`) — the board + numpad + header (shared with daily).
- **Daily** (`/daily`) — `DailyExperience` picker + solved modal + `UsernamePrompt`.
- **Leaderboard** (`/leaderboard`) — table, self-rank, streak/bests cards (flat stat style).
- **Auth** (`/signin`) — `AuthPanel`, `AccountBadge` inline editor.
- **Board internals**: `Cell` (3px ink border, `--r-sm`, mono digit, dashed cage-divider
  convention ready for Killer later; correct/wrong/selected states pair color **with an
  icon/shape**, never color-only), `Numpad`, `GameHeader` (mono timer/stats).

Retire `glass-panel`, the old `.btn-primary`, and indigo utilities once unreferenced.

### 5.3 — The juice layer

Implement the [juice table](design/design-system.md) at **medium** intensity (Kao's
research: medium beats none *and* extreme). All effects gate on `useReducedMotion`
(instant/opacity-only fallback). Notable ones:

- **Pressable button**: 90ms squash + offset-shadow collapse on `:active` (CSS only).
- **Cell states**: selected (butterscotch fill + 1.03 pop), correct (mint flash + scale
  pop), wrong (cherry flash + **cell-local** 4px shake — never viewport shake).
- **Solved**: a chunky "stamp" badge scales in with squash (Motion `AnimatePresence`) +
  a capped (~40-particle) confetti burst (lazy `canvas-confetti`) + a single opacity
  screen-flash. Reserved for genuine completions only — replaces today's `celebrate`/
  `rank-reveal` CSS.
- **Streak**: flame micro-bounce + count-up roll. **Route transition**: 150ms fade + 8px slide.

### 5.4 — Polish & QA

- **Accessibility**: verify every token pair ≥4.5:1 / ≥3:1; visible focus rings (2px,
  offset outside the chunky border); tap targets ≥24px (cells ≥40px on mobile); reduced-
  motion path; color-independent game states. Re-check with axe/Lighthouse.
- **Performance (AGENTS.md §3)**: keep interaction handlers cheap; confirm INP ≤200ms on
  the board under the new effects (the juice must not recompute whole-board state per
  keystroke); confetti/Motion lazy-loaded so non-game routes don't pay for them.
- **Visual QA** across all routes in light + dark, mobile + desktop.

## Anti-pitfalls (AGENTS.md-aligned)

- **Tailwind v4, not v3**: tokens go in `@theme` (CSS), not `tailwind.config.ts`. Read the
  installed Tailwind docs before writing config; don't reintroduce a JS config out of habit.
- **Theme-flash / hydration**: setting `data-theme` after mount causes a flash and can
  mismatch SSR. Set it **before paint** via a tiny inline script reading the cookie/storage,
  and render the toggle hydration-safely (don't read `localStorage` during render).
- **INP regression**: springs and per-cell effects must stay local and cheap; keep narrow
  Zustand selectors, don't recompute derived board state on every keystroke.
- **Bundle**: Motion + confetti are the only new runtime deps — lazy-load confetti and keep
  Motion usage to the few components that need springs; the rest is CSS.
- **Reduced motion is one switch**, not per-component overrides (a single `useReducedMotion`).

## Testing & Verification

- **Vitest**: light coverage for the theme helper (get/set/persist, system default) and any
  pure juice util (e.g. confetti param builder, count-up math). UI logic is thin here.
- **Playwright (E2E)**: smoke the key flows under the new theme — theme toggle persists
  across reload with no flash; sign-in → daily → solve shows the new solved stamp;
  leaderboard renders. Reuse the Phase 4 headless-solve harness.
- **Accessibility**: axe pass (0 serious/critical) on each route in both themes; manual
  keyboard-focus and reduced-motion checks.
- **Visual**: before/after screenshots per route (optionally a Playwright screenshot set).
- **Build/CI**: `next build` clean; `tsc`/`eslint`/`markdownlint` clean; existing 122 tests
  stay green (no logic changes expected).
- **Docs**: mirror any new component with its `.md` (AGENTS.md §2); update the design-system
  doc if a token/value changes during implementation.

## Open Questions

- **Theme default**: follow system on first visit (recommended), or default light ("the
  lab") with an opt-in dark?
- **Motion dependency**: adopt `motion` for the stamp sequence (recommended), or keep it
  100% CSS to avoid the dep (slightly less springy)?
- **Scope of "juice" now**: ship the full table in 5.3, or land the stamp/confetti + button
  press first and fast-follow the finer cell micro-interactions?
- **Landing page**: restyle the existing PDF-generator home only, or also add the bento
  "puzzle hub" the design system sketches (which anticipates Killer/other types)?

## Not in Scope (defer)

- Re-skinning the **generated PDF** (`pdf.service.ts`) — separate optional work.
- The **bento puzzle-hub** as a full new page (belongs with the Killer Sudoku phase, when
  there's more than one puzzle type to hub).
- Any **engine/API/DB** change — this phase is presentational only.
