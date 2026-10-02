# Generate Page (`/generate`)

The print-ready PDF puzzle-book generator — formerly the home page, moved here in 5.4 so the
puzzle hub can be the front door. Reached via the hub's "Print packs" card. Server Component
shell; the interactive `PuzzleForm` is the client leaf. Nav lives in the global `AppHeader`.

Exports `metadata.title: 'Print packs'` (QA F8) — composed with the layout's `%s · Puzzle Lab` template.

**Per-route `description` (October 2026):** the page also exports `metadata.description` (print-ready PDF books for all five types, with answer keys).
It feeds both the `<meta name="description">` and, via the root layout's `openGraph`, the social
card — a shared link used to unfurl with no description at all. Its `<main>` carries `id="main"`,
the target of the layout's skip link.
