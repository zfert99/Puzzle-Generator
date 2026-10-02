# Daily Page (`/daily`)

The route for the shared daily puzzle.

## Why it stays a Server Component

**Why:** Like `/play`, this page is routing/layout only — it renders static chrome (title,
nav links) and delegates all interactivity plus the puzzle fetch to the client
`DailyExperience` leaf. Nothing puzzle-related runs during SSR, so the `Math.random()`
server/client hydration mismatch never arises (AGENTS.md §1). The page prerenders as static
content; `DailyExperience` hydrates and fetches on the client.

```text
Render the page shell:
  "Daily Puzzles" heading (the shell renders no nav links of its own — see note below).
  <DailyExperience /> — the client board orchestrator.
```

> Nav, theme toggle, and account controls live in the global [AppHeader](../../features/chrome/AppHeader.md) (5.2); this shell just renders its title + content in a `flex-1` main.

Exports `metadata.title: 'Daily puzzles'` (QA F8) — composed with the layout's `%s · Puzzle Lab` template.

**Per-route `description` (October 2026):** the page also exports `metadata.description` (today's shared puzzles, one per type, and that signing in ranks you).
It feeds both the `<meta name="description">` and, via the root layout's `openGraph`, the social
card — a shared link used to unfurl with no description at all. Its `<main>` carries `id="main"`,
the target of the layout's skip link.

**Heading "Daily Puzzles" (October 2026):** it said "Daily Sudoku" long after the daily became
one board per puzzle type.
