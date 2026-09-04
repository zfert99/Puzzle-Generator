# /play Route: Plain English Pseudocode

The interactive board route. A **Server Component** — routing and layout only.

```text
Render a page shell (title only — nav lives in the global AppHeader).
Render the client <PlayExperience>, which owns all interactivity.
```

Keeping the route server-only, with a single client boundary in `PlayExperience`,
follows the Server-vs-Client component rule (AGENTS.md Section 1) and ensures no puzzle
is generated during SSR (hydration-safe).

Exports `metadata.title: 'Play'` (QA F8) — composed with the layout's `%s · Puzzle Lab` template.
