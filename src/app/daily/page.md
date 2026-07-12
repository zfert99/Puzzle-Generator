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
  "Daily Sudoku" heading + links to Free play and the PDF generator.
  <DailyExperience /> — the client board orchestrator.
```

> Nav, theme toggle, and account controls live in the global [AppHeader](../../features/chrome/AppHeader.md) (5.2); this shell just renders its title + content in a `flex-1` main.
