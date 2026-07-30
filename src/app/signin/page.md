# Sign-in Page (`/signin`)

The authentication route.

## Why a Server shell

**Why:** Like the other routes, this is routing/layout only — the interactive form lives in
the client `AuthPanel` leaf. No session logic here; the client handles sign-in and navigates
on success. Keeps the page a static shell (AGENTS.md §1).

> Nav, theme toggle, and account controls live in the global [AppHeader](../../features/chrome/AppHeader.md) (5.2); this shell just renders its title + content in a `flex-1` main.

## Why `robots: { index: false }`

**Why:** generic login pages carry no search value and Google tends to fold them together as
duplicate representatives, wasting crawl/index budget. The page is kept **crawlable** with a
`noindex` (not a robots.txt `Disallow`) — a disallowed URL can still be indexed from external
links because Googlebot never fetches it to see the tag. It's also excluded from
`app/sitemap.ts` (a sitemap should list only pages you want indexed). See
`Docs/research/sitemap-architecture-multi-zone.md` (Fork 2).
