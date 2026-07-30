# Puzzle-Zone Sitemap (`app/sitemap.ts`)

Emits the puzzle zone's sitemap at `biscuitlab.net/puzzles/sitemap.xml`.

## Why this shape

**Why:** the multi-zone cutover needs search engines to discover both the hub's pages and
the puzzle zone's. The chosen model (Fork 1 = **Option B** in
`Docs/research/sitemap-architecture-multi-zone.md`) is **two independent sitemaps, both
listed in the hub's `robots.txt`** — not a hand-rolled root sitemap *index*. At well under
100 URLs an index buys nothing a second `Sitemap:` line doesn't, and a hand-rolled
`app/sitemap.xml/route.ts` would collide with Next's `app/sitemap.ts` special file (Next
issues #45947 / #78609). So each zone owns its own framework-generated `sitemap.ts`.

```text
ORIGIN + BASE_PATH  ->  https://biscuitlab.net/puzzles      # absolute; basePath is NOT
                                                            # auto-prepended to these strings
IN:  /  /daily  /leaderboard  /archive  /play  /generate    # curated, indexable landing set
OUT: /signin  /account                                      # excluded + robots noindex
```

## Gotchas encoded here

- **Absolute URLs only.** Next auto-prepends `basePath` to `<Link>`/`router`/`next/image`,
  but **not** to strings you build in `sitemap.ts`; Google also rejects relative sitemap
  URLs. So `BASE = ORIGIN + BASE_PATH` is composed explicitly. `BASE_PATH` is the shared
  source of truth (see [`base-path.md`](../lib/base-path.md)); `ORIGIN` mirrors the layout's
  `metadataBase`.
- **No `<lastmod>`.** Google's lastmod trust is binary; a build-time `new Date()` on static
  pages manufactures false freshness and can poison the signal site-wide. Omit it unless a
  URL has a verifiable modification timestamp.
- **Served through the rewrite.** The hub proxies `/puzzles/:path*`, which covers
  `/puzzles/sitemap.xml`. `basePath` puts the special-file route at that path.
- **Page selection is curated, not exhaustive** — being in a sitemap is a hint, not a
  directive; the real indexation levers are internal linking, render quality, and noindex
  hygiene. `/play` and `/generate` are included as high-intent landing surfaces (they must
  render real server-side content to avoid soft-404s); `/signin` and `/account` are excluded
  and carry `noindex`.
