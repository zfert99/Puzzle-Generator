# Archive Page (`/archive`)

Route shell for the puzzle archive. A **Server Component** (routing/layout only) — the
calendar, past leaderboard, and unranked replay all live in the client `ArchiveExperience`
leaf, so nothing puzzle-related runs during SSR (AGENTS.md §1), exactly like `/daily`.

Nav lives in the global `AppHeader`; the hub links here via an Archive card.
