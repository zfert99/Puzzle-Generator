# Root Layout (`layout.tsx`)

The foundational wrapper for every page.

## Fonts (why these three, self-hosted)

**Why:** The Biscuit Lab type system pairs three roles deliberately (not Inter-everywhere).
Each is loaded via `next/font/google` — self-hosted, so **no layout shift and no external
request** — and exposed as a CSS var that `@theme` maps to a Tailwind font family:

```text
Fredoka          -> font-display   (chunky arcade display: logo, headlines, wins)
Manrope          -> font-sans      (body/UI default)
Space Mono       -> font-mono      (grid digits, timers, stats)
Permanent Marker -> font-marker    (chaos §8 marginalia — DECORATIVE only)
Caveat           -> font-caveat    (chaos §8 cursive notes — DECORATIVE only)
```

Space Mono + Permanent Marker are not variable, so their weights are pinned. The two marker
fonts are decorative only (never body copy). The layout also renders `<WobbleDefs/>` once —
the SVG filter for the hand-inked wobble (chaos §8).

**Why `preload: false` on the two marker fonts (July 2026):** `next/font` preloads every
font declared at the root on every route by default, but the decorative marker/cursive
fonts aren't guaranteed to render above the fold on every page — on `/daily` this tripped
Firefox's "preloaded but not used within a few seconds" console warning. Disabling preload
for those two only (Fredoka/Manrope/Space Mono still preload — they're used near-universally
on first paint) drops the noise without touching the self-hosted, no-layout-shift loading
this section already covers.

## Pre-paint theme script (why it must run first)

**Why:** The theme is a `data-theme` attribute on `<html>`. If it were set after React
mounts, the page would flash the wrong theme and risk a hydration mismatch. So an inline
`<script>` (the first thing in `<body>`) runs **before paint**: it reads the saved choice
from `localStorage`, else the system preference, and sets `data-theme` immediately. The
string lives in `@/features/theme/theme` (`THEME_PRE_PAINT_SCRIPT`).

```text
<html class="{font vars} antialiased">
  <body>
    <script> apply data-theme before paint </script>
    <AppHeader/>          # global grape nav bar (5.2) — nav, theme toggle, account
    {children}            # each page renders a flex-1 main below the header
```

## `metadataBase` + per-page canonical (Phase 3 multi-zone)

**Why:** Under `basePath: '/puzzles'` the app is public at `biscuitlab.net/puzzles`, but the
deployment also answers on its origin host. `metadataBase = https://biscuitlab.net/puzzles`
makes canonicals and OG URLs resolve to the public path, not the origin host. Per-page
self-referencing canonicals are the **primary** defense against the origin URL being indexed —
NOT a Host-based `noindex`, which would also fire on the proxied response and deindex the
public URLs (see `Docs/multi-zone-migration-plan.md` / validation doc §1, §9).

**How (one line, all routes):** `alternates: { canonical: './' }` in the root metadata. Next
resolves a `'./'` canonical against the **current route's** pathname
(`path.posix.resolve(pathname, './')`) and then composes it with `metadataBase` — so every
page emits a canonical at its own `/puzzles/*` URL with **no** per-page code. The `basePath`
does not double up: the pathname Next feeds the resolver is basePath-stripped, so `metadataBase`
adds `/puzzles` exactly once. Verified live in dev under `basePath`:

```text
/signin       -> https://biscuitlab.net/puzzles/signin
/ (home)      -> https://biscuitlab.net/puzzles/
/leaderboard  -> https://biscuitlab.net/puzzles/leaderboard
/books        -> https://biscuitlab.net/puzzles/books
```

No page sets its own `alternates`, so none shadows the inherited canonical. (If one ever needs
a custom `alternates`, it must re-include `canonical: './'` — Next replaces the whole
`alternates` object, it does not deep-merge it.)

## `--bg-pattern` — the one place a CSS asset URL is composed (September 2026, QA F2)

Next prepends `basePath` to `<Link>`/`next/image`/router URLs and `/_next/*` assets — **not** to
CSS `url()`. Every page used to carry `bg-[url('/bg-pattern.svg')]`, which resolved outside the
`/puzzles` zone and 404'd, so the background texture never rendered anywhere, in dev or prod,
since the multi-zone move. The layout now sets `--bg-pattern` on `<body>` as an inline style
composed from the shared `BASE_PATH` constant, and pages consume `bg-[image:var(--bg-pattern)]` —
the URL lives in exactly one place, next to the constant it must stay in sync with, instead of
seven Tailwind class strings that each look correct in isolation. Same gap class as `fetch()`
needing `apiPath` (see `base-path.md`).

## Per-page titles + brand (September 2026, QA F8)

Six of eight routes used to share the single document title "Puzzle Generator" — a WCAG 2.4.2
failure (titles must distinguish pages) and duplicate titles for SEO — and the brand itself had
drifted: the UI has said **Puzzle Lab** since the Phase 5 redesign while the `<title>` still said
"Puzzle Generator". `metadata.title` is now `{ default: 'Puzzle Lab', template: '%s · Puzzle Lab' }`;
each route exports a short `metadata.title` string and the template appends the brand. The hub
(`/`) uses the bare default. Deliberately untouched: the passkey `rpName` in `auth.ts` also says
"Puzzle Generator", but that string is stored auth config shown in credential pickers — renaming
it is a separate, auth-scoped change, not a document-title fix.
