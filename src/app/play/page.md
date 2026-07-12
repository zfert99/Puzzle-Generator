# /play Route: Plain English Pseudocode

The interactive board route. A **Server Component** — routing and layout only.

```text
Render a page shell (title + cross-links to Daily, Leaderboard, and the PDF generator).
Render the client <PlayExperience>, which owns all interactivity.
```

Keeping the route server-only, with a single client boundary in `PlayExperience`,
follows the Server-vs-Client component rule (AGENTS.md Section 1) and ensures no puzzle
is generated during SSR (hydration-safe).
