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

The design system has two layers. **Sections 1–7 are the clean chunky skeleton** (palette,
type, the pressable mechanic) — that's 5.1–5.4. **Section 8 is a "chaos layer"**: a
corkboard/scrapbook skin (stickers, tape, hand-inked wobble frames, doodle marginalia,
off-grid rotation, a marquee ticker, retro badges) layered *on top* of the skeleton — with
one hard rule: **chaos lives in chrome (hub, nav, empty states, celebrations), never in the
solve grid**, which stays exactly as clean and high-contrast as sections 1–7 specify.
Section 9 is an optional **parody-ad easter egg** (fake Flash-era banner ads) — deliberately
rule-breaking, off by default, deferred.

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
3. **5.3 The juice layer — in two parts** (decision: land it incrementally, not all at once):
   - **5.3a Core moments**: pressable buttons + the solved stamp + confetti (the big,
     meaningful payoff) — the highest-impact juice first.
   - **5.3b Fine moments**: cell select/correct/wrong micro-interactions, streak roll,
     route transitions — the finishing detail, fast-followed after 5.3a.
   All at **medium** intensity, reduced-motion-safe.
4. **5.4 Puzzle hub (bento)** — a landing "puzzle hub" of **compact** bento cards (Sudoku
   today, room for Killer/other types next), replacing the current home page as the front door.
5. **5.5 Chaos layer** — the corkboard/scrapbook skin (section 8) applied to chrome/hub only:
   stickers, tape/pushpins, hand-inked wobble frames, doodle marginalia, off-grid rotation, a
   marquee ticker, retro badges — **never** the solve grid. Decorative-only fonts + sticker
   tokens land here. (Optional stretch: the section-9 parody-ad "old internet mode.")
6. **5.6 Polish & QA** — accessibility pass (incl. the chaos a11y carve-out), INP budget,
   cross-route visual QA, Playwright smoke under the new theme.

## Decisions to Confirm (recommendations, your call)

| Decision | Recommended | Notes |
| --- | --- | --- |
| **Token home** | **Tailwind v4 `@theme` in `globals.css`** — NOT `tailwind.config.ts`. | This project is Tailwind v4 (CSS-first, `@import "tailwindcss"`); there is no JS config. The design-system doc's "map into tailwind.config.ts" line predates that — we adapt it to `@theme` so classes like `bg-paper`, `border-ink`, `text-butterscotch` are generated. |
| **Dark mode** | **Add a `[data-theme]` toggle** (system default, persisted), replacing the current `prefers-color-scheme`-only approach. | The design system + mockup key off `[data-theme="dark"]`. Needs a **hydration-safe** pre-paint script to avoid a theme flash (see pitfalls). Recommend a tiny inline script in `layout.tsx` + a cookie/localStorage, rather than a heavy dependency. |
| **Animation** | **CSS-first, Motion only where springs earn it.** | The pressable shadow, squash, cell fills, and shakes are pure CSS transitions/keyframes (cheap, GPU-friendly, no bundle). Reserve **Motion** (`motion` pkg) for the solved-stamp `AnimatePresence` sequence, and **`canvas-confetti`** (lazy-loaded) for the win burst only. Keeps INP + bundle in check. |
| **Fonts** | **Self-host via `next/font/google`**: Fredoka (display), Manrope (body/UI), Space Mono (grid/stats) in 5.1; **Permanent Marker + Caveat** (decorative marginalia) added in **5.5** when the chaos layer needs them (not loaded before). | Avoids layout shift + external requests; CSS vars consumed by `@theme`. The two marker fonts are decorative-only — never body copy, never sole carriers of meaning. |
| **Chaos hard rule** | **Chaos in chrome, never the solve grid.** | Section 8's techniques apply to hub/nav/empty-states/celebrations only; the board (cells/digits/cage borders) stays clean per §1–7. Non-negotiable. |
| **Parody ads (§9)** | **Optional, off by default, deferred.** | The design doc itself recommends *not* shipping it as permanent chrome (layout + animation cost). Build later as a toggleable "old internet mode" easter egg, or skip. |
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
src/features/chaos/ (5.5)        # decorative-only: Sticker, Tape, WobbleFrame (SVG filter),
                                 #   DoodleMark, MarqueeTicker, halftone bg — chrome/hub only
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
  `:root[data-theme="dark"]`. The **sticker tokens** (`--sticker-pink #FF5FA2`,
  `--sticker-lime #B4E23C`, `--sticker-sky #4FC3E8`) are defined here too but **quarantined
  — decoration only** (stickers/tape/pins/marginalia), never text/buttons/functional UI, and
  they do not flip by theme.
- **Fonts**: `next/font/google` for Fredoka / Manrope / Space Mono in `layout.tsx`, exposed
  as `--font-display / --font-sans / --font-mono`; wire into `@theme`.
- **Theme toggle**: a `[data-theme]` attribute on `<html>`, defaulting to system, persisted
  to `localStorage` (+ a cookie so SSR can set it), with a small `ThemeToggle` in the header.
- **Signature utilities**: a `.chunky` / `shadow-chunky` utility for the `4px 4px 0 0`
  offset shadow + the `:active` translate-and-collapse, and button variants (primary /
  secondary / ghost) per the spec.

### 5.2 — Component restyle

Migrate to the tokens/components, **route by route** (each a small PR):

- **Chrome**: header/nav (grape bar, Fredoka cream wordmark, ghost links, `ThemeToggle`,
  `AccountBadge`), page shells, footer. The header reserves a **logo-marginalia slot** — a
  small Marker-font aside beside the wordmark (e.g. "est. today, mostly stable") as a
  permanent personality touch (content may rotate; the slot is stable). Its font arrives with
  the chaos layer (5.5).
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
research: medium beats none *and* extreme), **in two parts** — the big meaningful payoff
first (5.3a), the finishing micro-interactions fast-followed (5.3b). All effects gate on
`useReducedMotion` (instant/opacity-only fallback).

- **5.3a — Core moments:** the pressable button + the **solved stamp + confetti**
  (replaces today's `celebrate`/`rank-reveal` CSS). This is the emotional peak and the
  clearest before/after, so it lands first.
- **5.3b — Fine moments:** cell select/correct/wrong micro-interactions, the streak
  count-up, and route transitions.

Notable effects across both:

- **Pressable button**: 90ms squash + offset-shadow collapse on `:active` (CSS only).
- **Cell states**: selected (butterscotch fill + 1.03 pop), correct (mint flash + scale
  pop), wrong (cherry flash + **cell-local** 4px shake — never viewport shake).
- **Solved**: a chunky "stamp" badge scales in with squash (Motion `AnimatePresence`) +
  a capped (~40-particle) confetti burst (lazy `canvas-confetti`) + a single opacity
  screen-flash. Reserved for genuine completions only — replaces today's `celebrate`/
  `rank-reveal` CSS.
- **Streak**: flame micro-bounce + count-up roll. **Route transition**: 150ms fade + 8px slide.

### 5.4 — Puzzle hub (bento)

A landing **puzzle hub** — the new front door — using a **compact** bento grid
(`repeat(auto-fit, minmax(128px, 1fr))`, ~14–20px gaps) on a **fixed, aligned** grid (not a
scattered "desk" layout), so the hub scans quickly and shows more puzzles at once. Each card
is a puzzle type: **Sudoku** (Play / Daily / Leaderboard entry points) now, with the layout
built to accept **Killer Sudoku** and future types (Phase 6+) as they arrive.

- **Compact card spec** (per the updated design): `--r-md` (not `--r-lg` — too heavy small),
  paper-2 background, chunky border+shadow scaled down (2–2.5px border, 4px offset), a ~62px
  thumbnail, a Fredoka title at **Body L** size (not Display M), a Body S description, and a
  small difficulty badge.
- The current home page is the PDF generator; the hub becomes the primary landing, with the
  PDF generator reachable as one entry (a "print packs" card/link) rather than the front page.
- Server Component shell (static, fast) — mostly links + presentational cards. The chaos-layer
  decoration (5.5) is applied *on top* of this orderly grid, not by scattering the grid itself.

### 5.5 — Chaos layer (corkboard chrome)

The section-8 scrapbook skin, applied to **chrome/hub/empty-states/celebrations only** —
**never the solve grid** (the one hard rule). Lands the decorative-only fonts (Permanent
Marker, Caveat) and uses the quarantined sticker tokens.

- **Off-grid rotation**: a *fixed* reusable set of small tilts (`-2 / 1.5 / -1 / 2.5 deg` by
  nth-child) on cards/stickers — deterministic, not per-render random, so it stays stable.
- **Stickers, tape strips, pushpins**: small rotated wildcard-color badges + semi-transparent
  tape / shadowed pins at card corners; asymmetric `border-radius` so they read hand-cut.
- **Hand-inked wobble frame**: an SVG `feTurbulence`+`feDisplacementMap` filter on decorative
  *outline* SVGs (card frames, the solved stamp, circled doodles) — applied to a layered SVG,
  **never as a CSS filter on content**, so text never warps.
- **Doodle marks & marginalia**: hand-drawn arrows/underlines/circles (same wobble) labelled
  in Caveat; the logo Marker aside; crossed-out-and-corrected words.
- **Texture**: a very low-opacity halftone dot pattern on page backgrounds (kept light enough
  that text contrast is unaffected).
- **Marquee ticker** (streak/stats) and a **retro webring/badge strip** — flavor only, paused
  on hover, static under `prefers-reduced-motion`, with a screen-reader-only static duplicate.
- **Idle wobble** on one or two decorative elements, sparingly, always with a reduced-motion off.

**A11y carve-out (unchanged from §6):** decoration never carries meaning alone (a "hard" badge
needs the word, not just a color); marquee content is duplicated statically and pauses under
reduced motion; halftone stays contrast-safe. Chaos is a skin over the accessible structure.

*Optional stretch — §9 parody ads:* a quarantined "old internet mode" (fake skyscraper +
leaderboard banners, self-labelled fake, dismissible, reduced-motion-safe). Off by default;
build as a toggleable easter egg or skip. Its rule-breaking (garish gradients, blink) must not
leak into any other component.

### 5.6 — Polish & QA

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

## Resolved Decisions

- **Theme default:** ✅ follow the system preference on first visit, then persist the user's
  explicit choice.
- **Motion dependency:** ✅ adopt `motion` for the solved-stamp sequence; everything else
  stays CSS-first.
- **Juice delivery:** ✅ in two parts — core moments (pressable button + solved stamp/
  confetti) first (**5.3a**), the finer cell/streak/transition micro-interactions fast-
  followed (**5.3b**).
- **Landing page:** ✅ add the bento **puzzle hub** as the new front door (**5.4**); the PDF
  generator becomes one entry on it rather than the home page.

## Not in Scope (defer)

- Re-skinning the **generated PDF** (`pdf.service.ts`) — separate optional work.
- Any **engine/API/DB** change — this phase is presentational only.
- The puzzle hub ships the **Sudoku** card set now; **Killer/other-type cards** come with
  those phases (the hub layout is built to accept them).
- **Chaos in the solve grid** — forbidden, not deferred: the board stays clean per §1–7.
- The **§9 parody-ad module** is an optional stretch/easter egg, not required Phase 5 work;
  if built, it's off by default and toggleable.
