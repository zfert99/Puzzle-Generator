# Archive Page (`/archive`)

Route shell for the puzzle archive. A **Server Component** (routing/layout only) — the
calendar, past leaderboard, and unranked replay all live in the client `ArchiveExperience`
leaf, so nothing puzzle-related runs during SSR (AGENTS.md §1), exactly like `/daily`.

Nav lives in the global `AppHeader`; the hub links here via an Archive card.

Exports `metadata.title: 'Archive'` (QA F8) — composed with the layout's `%s · Puzzle Lab` template.

**Per-route `description` (October 2026):** the page also exports `metadata.description` (replay any past day as practice and see its final leaderboard).
It feeds both the `<meta name="description">` and, via the root layout's `openGraph`, the social
card — a shared link used to unfurl with no description at all. Its `<main>` carries `id="main"`,
the target of the layout's skip link.
