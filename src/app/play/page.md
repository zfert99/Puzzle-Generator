# /play Route: Plain English Pseudocode

The interactive board route. A **Server Component** — routing and layout only.

```text
Render a page shell (the "Play" heading only — nav lives in the global AppHeader).
Render the client <PlayExperience>, which owns all interactivity.
```

Keeping the route server-only, with a single client boundary in `PlayExperience`,
follows the Server-vs-Client component rule (AGENTS.md Section 1) and ensures no puzzle
is generated during SSR (hydration-safe).

Exports `metadata.title: 'Play'` (QA F8) — composed with the layout's `%s · Puzzle Lab` template.

**Per-route `description` (October 2026):** the page also exports `metadata.description` (five types, five sizes, five difficulties, hints and pencil marks).
It feeds both the `<meta name="description">` and, via the root layout's `openGraph`, the social
card — a shared link used to unfurl with no description at all. Its `<main>` carries `id="main"`,
the target of the layout's skip link.

**Heading "Play" (October 2026):** the `<h1>` used to read "Play Sudoku" while the route hosts
all five puzzle types; it now reads just "Play" (the type picker below names the type).
