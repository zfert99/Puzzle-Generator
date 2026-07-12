# puzzles.biscuitlab.net — Design System

**Concept:** *Puzzle Lab* — a mad-scientist biscuit workshop. Warm, tactile, hand-baked colors (cream, butterscotch, chocolate) collide with a bold grape "lab" accent. Chunky, pressable, Flash-portal-era UI — thick outlines, hard offset shadows, squash-and-stretch — built on a modern, accessible, performance-conscious foundation (Next.js + Tailwind + Motion). This deliberately avoids the generic "warm cream + terracotta serif" AI-default look: the accent pairing is butterscotch-gold + deep grape, not muted terracotta, and the display face is a chunky rounded arcade face, not a high-contrast serif.

Two references define the target: **NYT Games** for structural discipline (design tokens, calm typography, consistent component reuse across puzzle types) and **Flash-era portals** (Newgrounds, Kongregate, Armor Games, Nitrome) for tactile joy (chunky buttons, squash-stretch, confetti, hit-pause). This system fuses both — restrained where it needs to be trusted, juicy where it needs to be fun.

---

## 1. Color tokens

Two named families: **Biscuit** (warm neutrals) and **Lab** (accents). Every accent is used with intent, never decoratively — see usage column.

### Light mode

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#FBF3E3` | Page background (biscuit dough cream) |
| `--paper-2` | `#F5E7C8` | Card / raised surface background |
| `--ink` | `#2B1B12` | Primary text, chunky outlines (espresso brown-black) |
| `--ink-soft` | `#6B5544` | Secondary/muted text |
| `--butterscotch` | `#E8A33D` | Primary accent — primary CTAs, active/selected cell, streak flame |
| `--butterscotch-dark` | `#C97F1E` | Button shadow/pressed state for butterscotch |
| `--grape` | `#5A3E96` | Secondary accent — "lab" branding, links, secondary buttons, nav |
| `--grape-dark` | `#3E2A69` | Button shadow/pressed state for grape |
| `--mint` | `#2FAE86` | Success — correct answer, solved state |
| `--cherry` | `#D8453F` | Danger — wrong answer, rule violation |

### Dark mode ("lab at night")

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#1B1224` | Page background (deep aubergine-black) |
| `--paper-2` | `#241833` | Card background |
| `--ink` | `#F5E9CE` | Primary text |
| `--ink-soft` | `#C9B8A0` | Secondary text |
| `--butterscotch` | `#F2B65A` | Primary accent (brightened for contrast) |
| `--grape` | `#9B7FD4` | Secondary accent (brightened) |
| `--mint` | `#4FCBA0` | Success |
| `--cherry` | `#F06B65` | Danger |

**Rule:** one primary accent (butterscotch) per view for the single most important action; grape is reserved for navigation/branding and secondary actions; mint/cherry are exclusively game-feedback colors and never used decoratively. All text-on-color pairs are checked at ≥4.5:1 (body) / ≥3:1 (large text, UI components) per WCAG 2.2 AA.

---

## 2. Typography

Three roles, paired deliberately — not the Inter-everywhere default:

- **Display — "Fredoka"** (Google Fonts, variable, rounded geometric sans). This is the Flash-portal chunk: logo, hero headline, big win moments, puzzle-type card titles. Used with restraint — never body copy.
- **Body/UI — "Manrope"** (Google Fonts). Clean modern grotesk for everything functional: nav, buttons, settings, paragraph copy. Carries the "trustworthy modern app" half of the brief.
- **Mono — "Space Mono"** (Google Fonts). Puzzle-grid digits, cage-sum labels, timers, stats. A typewriter/puzzle-booklet character that reads as precise and game-like without being a generic code font.

### Scale (rem, 1rem = 16px)

| Role | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| Display XL | 3.5rem | 600 | 1.05 | Hero / landing headline |
| Display L | 2.25rem | 600 | 1.1 | Section headers, "Solved!" banner |
| Display M | 1.5rem | 600 | 1.2 | Card titles, modal titles |
| Body L | 1.125rem | 500 | 1.5 | Intro copy, empty states |
| Body M | 1rem | 400 | 1.6 | Default body |
| Body S | 0.875rem | 500 | 1.4 | Labels, captions, meta |
| Mono L | 1.75rem | 700 | 1 | Puzzle cell digits |
| Mono S | 0.75rem | 500 | 1 | Cage-sum labels, timer |

Sentence case everywhere in UI copy (buttons, nav, headings) — no Title Case, no ALL CAPS except single-letter cage-sum badges where space is tight.

---

## 3. Layout, radius, shadow tokens

- **Radius:** `--r-sm: 8px` (inputs, chips), `--r-md: 14px` (buttons, puzzle cells), `--r-lg: 20px` (cards, modals). Rounded but not pill-shaped — keeps the chunky-cartoon feel without drifting into neumorphism.
- **Border:** chunky outlines are a signature, not a decoration — `border: 3px solid var(--ink)` on interactive elements (buttons, cards, cells), `border: 1.5px solid var(--ink-soft)` on passive dividers.
- **Shadow — "pressable" offset shadow** (the core signature element, not a CSS drop-shadow blur): `box-shadow: 4px 4px 0 0 var(--ink)` at rest; on `:active`, the element translates `(4px, 4px)` and the shadow collapses to `0 0 0 0` — a physical "push the button in" effect. This single mechanic is the thread connecting Flash-portal chunkiness to modern tactile feedback, and it's cheap (no blur, GPU-friendly, one transform).
- **Grid:** compact bento-style card grid for the puzzle hub (`grid-template-columns: repeat(auto-fit, minmax(128px, 1fr))`, ~14-20px gaps) — settled on smaller, tightly aligned tiles over an earlier scattered/oversized "desk" layout exploration, since the hub is browsed quickly and needs more puzzles visible at once. Standard 8pt spacing scale (`4/8/12/16/24/32/48px`) elsewhere.

---

## 4. The juice system (signature interaction language)

Grounded in Vlambeer/grapefrukt juice principles and Kao's finding that **medium** juice outperforms both none and extreme — every effect below is deliberately calibrated, not maximal. All respect `prefers-reduced-motion` (fall back to instant state changes, no shake/bounce, opacity-only feedback).

| Moment | Effect | Timing/values |
|---|---|---|
| Button press | Squash + offset-shadow collapse | 90ms, `ease-out`, translate 4px |
| Cell selected | Butterscotch fill fade-in + 1.03x scale pop | 120ms spring (Motion `stiffness: 400, damping: 25`) |
| Correct digit entered | Mint flash (150ms) + scale 1→1.08→1 | 220ms total, spring |
| Wrong digit entered | Cherry flash + 4px horizontal shake, 2 cycles | 180ms, `ease-in-out` — **no screen shake**, cell-local only |
| Row/cage completed | Brief hit-pause (~90ms freeze) then mint pulse across cage | 90ms pause + 300ms pulse |
| Puzzle solved | "Stamp" — a chunky rounded badge scales in 0→1.1→1 with squash, confetti burst (crumb-shaped particles in butterscotch/grape/mint), single soft screen-flash (opacity, not shake) | 600ms sequence, confetti via `canvas-confetti` or custom particles, capped at ~40 particles for performance |
| Streak increment | Flame icon micro-bounce + count-up digit roll | 300ms |
| Page/route transition | Simple fade + 8px slide, no bounce | 150ms `ease-out` |

**Explicitly avoided:** camera/viewport screen-shake (disorienting in a puzzle context), looping ambient animation (battery/distraction cost), and juice on every single interaction — reserve the stamp/confetti moment for genuine completions, not intermediate steps, so it stays meaningful.

---

## 5. Core components

- **Puzzle cell:** `--r-sm` radius, 3px ink border, mono digit, cage membership shown via a *dashed inner divider* (1.5px, `--ink-soft`) rather than a full border between same-cage cells — matches print-puzzle convention and keeps the grid legible at small sizes. Cage-sum label: Mono S, top-left corner of the cage's anchor cell.
- **Buttons:** `primary` (butterscotch fill, ink border+shadow, ink text) for the single most important action per screen; `secondary` (paper-2 fill, grape border+shadow, grape text) for alternate actions; `ghost` (no fill, no shadow, ink-soft text, underline on hover) for tertiary/low-emphasis actions. Never more than one `primary` visible at once.
- **Puzzle-type cards (hub grid):** compact — `--r-md` (not `--r-lg`, too heavy at this size), paper-2 background, chunky border+shadow scaled down (2–2.5px border, 4px shadow offset), ~62px thumbnail, Fredoka title at Body L size (not Display M — full display size overwhelms a small card), Body S description, small difficulty badge. Aligned to a fixed grid, not freely scattered — a few of the chaos-layer techniques (fixed per-card rotation, a sticker, occasional tape) still apply per section 8, but the grid structure itself stays orderly so the hub scans quickly.
- **Streak/stats card:** metric-style — Body S muted label above, Mono L number below, inside a flat `--paper-2` panel (no chunky border here — reserve the heavy signature border for actionable/interactive elements, not passive readouts).
- **Nav:** grape background bar (dark mode: same grape, brightened), cream wordmark in Fredoka, ghost-style nav links in cream.
- **Logo marginalia:** a small Marker-font aside sits next to the wordmark (e.g. "est. today, mostly stable") — a permanent, low-key personality touch rather than a UI badge or version flag. Content can rotate (build date, a streak-related quip, a pun) but the slot itself is a stable part of the header, not a temporary label.

---

## 6. Accessibility (WCAG 2.2 AA — non-negotiable given research findings)

- **Contrast:** all text ≥4.5:1 (body) / ≥3:1 (large/UI). Verified per token pair above; re-verify anytime a new color combination is introduced.
- **Focus:** every interactive element gets a visible focus ring — 2px, 3:1 contrast against background, offset outside the chunky border (not just relying on the border itself, since border color may not shift on focus).
- **Target size:** all tappable targets (including puzzle cells) ≥24×24 CSS px; on mobile, puzzle cells should target ≥40px.
- **Dragging alternative:** if any puzzle mode uses drag interactions (e.g., a Pips-style domino placement), provide a tap-to-select + tap-to-place alternative — WCAG 2.2's 2.5.7 requirement.
- **Reduced motion:** `prefers-reduced-motion: reduce` strips all spring/bounce/confetti to instant or opacity-only transitions — implement this as a single Motion config switch, not per-component overrides.
- **Color independence:** correct/wrong/selected states are never color-only — pair mint/cherry with an icon (check/x) and shape change, since colorblind players must be able to read game state.

---

## 7. Implementation notes (Next.js + Tailwind)

```css
/* globals.css — token layer, mirrors the tables above */
:root {
  --paper: #FBF3E3; --paper-2: #F5E7C8;
  --ink: #2B1B12; --ink-soft: #6B5544;
  --butterscotch: #E8A33D; --butterscotch-dark: #C97F1E;
  --grape: #5A3E96; --grape-dark: #3E2A69;
  --mint: #2FAE86; --cherry: #D8453F;
  --r-sm: 8px; --r-md: 14px; --r-lg: 20px;
}
[data-theme="dark"] {
  --paper: #1B1224; --paper-2: #241833;
  --ink: #F5E9CE; --ink-soft: #C9B8A0;
  --butterscotch: #F2B65A; --grape: #9B7FD4;
  --mint: #4FCBA0; --cherry: #F06B65;
}
```

Map these into `tailwind.config.ts` under `theme.extend.colors` (e.g. `paper`, `ink`, `butterscotch`, `grape`, `mint`, `cherry`) so components use `bg-paper`, `text-ink`, `border-ink`, `bg-butterscotch` etc. rather than raw hex. Use `next/font/google` to self-host Fredoka, Manrope, and Space Mono (avoids layout shift and external request). Build the "pressable" shadow as a reusable Tailwind utility or a `.chunky` class rather than repeating box-shadow declarations. Implement the juice interactions with **Motion** (spring physics, `AnimatePresence` for the solved-stamp sequence); reach for a lightweight canvas confetti library only for the win moment, lazy-loaded so it doesn't cost bundle size on every page.

---

## 8. The chaos layer (corkboard / scrapbook energy)

The clean chunky system in sections 1–7 is the *skeleton*. This layer is the mess on top of it — the difference between "well-made Flash-inspired app" and "actually feels like it fell out of a 2006 browser tab." Concept: a mad scientist's cluttered lab corkboard — taped-on stickers, doodled marginalia, torn paper, pushpins, halftone photocopy texture.

**The one hard rule: chaos lives in chrome, never in the solve surface.** The puzzle grid itself — cells, digits, cage borders — stays exactly as clean and high-contrast as sections 1–7 specify. Every technique below applies to hub screens, nav, cards, marketing, empty states, and celebration moments. A player mid-puzzle should never have to parse clutter; a player browsing the puzzle hub should feel like they walked into a fun, slightly unhinged workshop.

### New tokens

| Token | Hex | Use |
|---|---|---|
| `--sticker-pink` | `#FF5FA2` | Decorative badges/stickers only |
| `--sticker-lime` | `#B4E23C` | Decorative badges/stickers only |
| `--sticker-sky` | `#4FC3E8` | Decorative badges/stickers only |

These "wildcard" colors are never used for text, buttons, or functional UI — only for stickers, tape, pushpins, and marginalia. Keeping them quarantined is what lets the core palette stay disciplined while the decoration goes loud.

**Fourth type role — handwritten marginalia, two weights:** `Permanent Marker` (Google Fonts) for bold scrawled labels and doodle callouts ("start here," logo asides); `Caveat` (Google Fonts) for lighter cursive notes — corrections, notebook asides, polaroid captions. Both are decorative only — never body copy, never anything a screen reader needs to convey information on its own (pair with real text, don't rely on the marker label alone).

### Techniques

- **Off-grid rotation:** bento cards and stickers get small fixed rotations (alternate `-2deg / 1.5deg / -1deg / 2.5deg` by nth-child) so nothing lines up in a tidy row — but the rotation values are a fixed, reusable set, not literally randomized per render, so the layout stays implementable and consistent across visits.
- **Stickers:** small rotated jagged/pill badges ("new!", "hot streak", difficulty flames) absolutely positioned overlapping a card's corner, in a wildcard color, rotated 8–15deg.
- **Tape strips & pushpins:** semi-transparent rotated rectangles (tape) or small shadowed circles (pins) at card corners, simulating things held to a corkboard — mix the two across a grid rather than using the same one everywhere.
- **Halftone/dot texture:** a very low-opacity repeating dot pattern on page background (photocopier texture) — subtle enough not to fight text contrast.
- **Hand-inked wobble frame:** an SVG `feTurbulence` + `feDisplacementMap` filter applied to a decorative outline (card frames, the solved stamp, circled doodles) instead of a crisp CSS border — this is the single technique that reads most as "actually hand-drawn" versus merely rotated. Apply it to an SVG shape layered behind/around content, never as a CSS `filter` on the content element itself, so text inside doesn't warp too.
- **Doodle arrows, underlines & circles:** inline hand-drawn SVG marks (run through the same wobble filter) pointing at or circling the primary CTA, labeled in Caveat ("click this one!!").
- **Torn-paper edges:** a jagged `clip-path: polygon(...)` top/bottom edge on an aside panel (e.g. a "lab notebook" quote block) to simulate a torn page.
- **Stains & marginalia:** a low-opacity wobble-filtered coffee-ring doodle, a crossed-out-and-corrected word (`text-decoration: line-through` in the old copy + a Caveat replacement word beside it) — small human-error touches that read as a real person editing the page.
- **Hover wobble:** on hover, chrome elements (cards, stickers) get a small extra rotation on top of their base tilt — a "nudged" feel, not a full spin. Buttons keep the press-shadow mechanic from section 3 underneath.
- **Marquee ticker:** an old-portal-style scrolling news strip for streak/stats ("new puzzle daily ★ 3-day streak ★ 128 solved ★"), paused on hover and instant/static under `prefers-reduced-motion`, with a static screen-reader-only duplicate of the content.
- **Retro webring / badge strip:** a nav-adjacent strip of tiny faux-nostalgia badges (site meta jokes, "best viewed at any size") and a footer row of GeoCities-style 88×31 badges — pure flavor, no functional links required.
- **Asymmetric corners:** decorative badges use uneven `border-radius` (e.g. `16px 6px 16px 6px`) so they read as hand-cut stickers rather than uniform pills — reserved for decoration, never for primary buttons.
- **Subtle idle wobble:** one or two small decorative elements (a flame icon, a couple of logo letters) get a slow, low-amplitude idle animation — used sparingly (one or two per screen, not everywhere) and always paired with a `prefers-reduced-motion` off-switch.

### Accessibility carve-out

None of the above changes section 6's requirements. Rotation, tape, and stickers are decorative and must not carry meaning on their own (a "hard" badge needs the word "hard," not just a color); marquee content must be duplicated in a static, non-scrolling form for screen readers and must pause under `prefers-reduced-motion`; halftone texture must stay light enough that text contrast ratios are unaffected. Chaos is a skin, not a replacement for the accessible structure underneath.

## 9. Parody ad module (optional easter egg, not core chrome)

A dedicated, quarantined component that recreates the tacky banner ads that used to flank Flash portals — two "skyscraper" ads in the side margins (visible only on wide viewports, ~1500px+, so they sit outside the content column rather than crowding it) and a "leaderboard" strip at the very bottom of the page.

**This is the one place the system deliberately breaks its own rules** — garish repeating-stripe gradients, comic blink text, caution-stripe borders — on purpose, because the joke *is* the contrast with the disciplined system around it. Keep that contrast intentional and contained:

- **Content is always self-labeled fake:** every unit carries a small disclaimer ("definitely not a real ad" / "100% fake — we just think old banner ads were funny"). No real brand names, no real prizes, no functioning tracking or links — these are jokes, not dark patterns.
- **Dismissible:** each unit has a working close control; once dismissed it should stay dismissed for the session (persist in local component state, not global storage, since it's a low-stakes cosmetic preference).
- **Blink/spin effects respect `prefers-reduced-motion`** exactly like every other animation in the system — reduce to a static state.
- **Production recommendation:** don't ship this as permanent, always-on chrome — the fixed side units cost layout space and the "loading 14%" bar/blink text add ongoing animation cost for no functional benefit. Better as a toggleable "old internet mode" easter egg (settings option, or a one-time April-Fools-style appearance) than a persistent element competing with real content for attention and performance budget.

## 10. Quick do/don't

**Do:** one accent per screen · chunky offset-shadow on every interactive element · medium-intensity juice on real milestones (correct answer, solved) · dashed cage dividers · mono digits in the grid · let hub/chrome screens get messy with stickers, tape, wobble frames, and off-grid rotation · keep the hub grid compact and aligned even while the decoration on top of it gets loud.

**Don't:** mix butterscotch and grape as competing primary actions on one screen · use screen-shake · animate every keystroke at full intensity · use terracotta/warm-cream-serif combo (the generic AI look this system is deliberately avoiding) · let the chunky border/shadow appear on passive/read-only surfaces · let any chaos technique touch the actual puzzle-solving grid · let the parody-ad module's rule-breaking (gradients, blink, clashing color) leak into any other component · ship the parody ads as permanent always-on chrome.
