# Mobile / Accessibility Audit & Plan

> **Status:** 📋 Analysis (nothing implemented) · **Date:** July 2026
> **Triggered by:** two research docs —
> [accessibility-responsive-qa.md](research/accessibility-responsive-qa.md) (WCAG 2.2 AA,
> ARIA grid pattern, color semantics, automated a11y/overflow testing) and
> [responsive-design-pwa.md](research/responsive-design-pwa.md) (mobile-first CSS, viewport
> units, touch targets, PWA) — read against the codebase right after the mobile-width polish
> pass on `feature/ui-polish`.

## Verdict

The app is in **good shape** — the boards already use the WAI-ARIA grid pattern, motion
already respects `prefers-reduced-motion`, chips carry text labels (not color-only), cages
are dashed outlines (not color fills), and the recent pass confirmed zero horizontal overflow
across the five most-common phone widths. The research mostly validates existing choices. The
gaps below are the genuine deltas, prioritized by leverage.

## Already solid (do NOT redo)

| Research recommendation | Status in code |
|---|---|
| WAI-ARIA grid pattern (roving tabindex, arrow keys, `aria-readonly` clues) | ✅ `Board.tsx` / `Cell.tsx` — `role=grid/gridcell`, `aria-label`, `aria-selected`, `aria-readonly`, one `tabindex=0`, Arrow/Home/End nav |
| Cell name conveys position + value + given state | ✅ `ariaLabel` = "Value 5, row 3, column 4" / "Empty, …" / "Given clue …" |
| `prefers-reduced-motion` for non-essential motion | ✅ globals, Backdrop, MarqueeTicker, Board cells, `useReducedMotion` hook |
| Color not the sole channel — difficulty/board chips | ✅ chips are text ("Easy"/"Killer 6×6 Hard"); cages are dashed borders + sum labels |
| Focus ring, no bare `outline:none` (F78) | ✅ both `outline:none` sites paired with `:focus-visible` box-shadow rings |
| No `user-scalable=no` / pinch-zoom blocked | ✅ relies on Next's default `width=device-width, initial-scale=1` |
| Board avoids fixed-px trap | ✅ `width: min(92vw, 520px); aspect-ratio: 1/1` |
| Horizontal overflow across phone widths | ✅ manually verified 360/375/390/412/430 (this pass) |
| `@axe-core/playwright` available | ✅ already a dependency (but unused — see G2) |

## Gaps — prioritized

### Quick wins (high leverage, ~an afternoon total)

- ✅ **G1 — No board-state live region (WCAG 4.1.3 / the doc's #1 a11y gap).** When a digit is
  typed, focus stays on the cell, so a screen reader announces *nothing*. Add one
  visually-hidden `aria-live="polite"` region (the DOM already has live-region infra in
  `GameHeader`/`MarqueeTicker` to copy) and write short messages on change: "5 entered",
  "conflict: 5 already in this row", "cell cleared", "puzzle solved". *~1 file + a store
  subscription.*
- ✅ **G2 — Automate what we just did by hand.** The mobile-width overflow check was manual this
  pass. Codify it as a Playwright test (`documentElement.scrollWidth <= clientWidth + 1`
  looped over 320/360/390/430/768/1024/1440, skipping the intentionally-scrollable board),
  **and** wire up the already-installed `@axe-core/playwright` on the top journeys (hub,
  daily, archive, a board in each variant, sign-in). Near-zero new deps; turns a one-time
  eyeball into a CI guardrail. *Directly closes the loop on this pass.*
- ✅ **G3 — `min-height: 100vh` → `100svh` (the doc's "single most common mobile bug").**
  `globals.css:87` uses `100vh`, which on mobile Safari equals the *largest* viewport, so the
  layout jumps when the address bar retracts. Swap to `100svh` with a `100vh` fallback line.
  *One line; our static screenshots couldn't catch it but real devices will.*
- ✅ **G4 — Conflict cells rely on color + motion only (WCAG 1.4.1).** An error cell shows a red
  tint + one-time shake; under reduced-motion only the red remains — no non-color channel for
  a colorblind sighted player. Add a persistent non-color cue (corner mark / underline /
  bold). G1 covers the screen-reader path; this covers the visual one. *CSS-only.*

### Medium (worth doing, not urgent)

- **G5 — Touch-target audit on `pointer: coarse`.** Numpad digit keys (`py-3 text-lg`) are
  ~48px — fine; the secondary control row (`py-2`) is ~40px — under the 44–48px target
  (though above the 24px WCAG 2.5.8 floor). Bump on coarse pointers via
  `@media (pointer: coarse)`.
- **G6 — Gate hover styles behind `@media (hover: hover)`.** `hover:` utilities apply a sticky
  pressed look after tap on touch. Low-severity polish.
- **G7 — Board "largest square that fits" pattern.** Current `min(92vw, 520px)` caps the board
  at 520px and doesn't use available *height*; the doc's `grid-rows: auto 1fr auto` +
  `margin:auto` makes it the largest square for the viewport with no JS. Improves tablet /
  landscape; not a phone bug.
- **G8 — `jsx-a11y` strictness + CI.** `eslint-config-next` bundles `jsx-a11y` at
  `recommended`; make lint a blocking CI check (it may already be) and consider `strict`.

### Future (a real feature, not a fix)

- **G9 — PWA / installable + offline.** No manifest, service worker, icons, or offline shell.
  The doc's stack is Serwist + `app/manifest.ts` + 192/512/512-maskable icons + iOS
  `apple-touch-icon`/meta + a guided iOS "Add to Home Screen" sheet (no `beforeinstallprompt`
  on Safari). This is **Phase-sized**, best slotted alongside or after Phase 9 (it wants the
  profile surface for the install button), and explicitly *not* durable storage — progress
  already syncs to the backend, which is the correct posture. Flag, don't rush.

## Suggested sequencing

1. **G1–G4 as one small `feature/a11y-polish` branch** — the four quick wins, shippable in a
   day, each with a test. G2 alone means every future mobile change is regression-guarded.
2. **G5–G8 folded into normal work** as those surfaces get touched.
3. **G9 (PWA)** as its own planned phase when the social/profile surfaces (Phase 9) exist to
   host the install affordance.

## Notes / caveats from the research worth remembering

- Automated a11y tools catch only ~30–57% of issues; G1–G4 + axe don't replace a one-time
  manual keyboard-only and VoiceOver/TalkBack pass before any "accessible" claim.
- The board's 2-D layout is a legitimate WCAG 1.4.10 Reflow *exception* ("games"); only the
  surrounding chrome must reflow — which it already does. Don't over-correct the grid.
- US-heavy audience ⇒ Safari/WebKit is the primary mobile target (≈55% US mobile), so the
  `100svh` fix (G3) and a real-Safari pass matter more than raw Chrome numbers suggest.
