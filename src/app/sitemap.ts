import type { MetadataRoute } from 'next';
import { BASE_PATH } from '@/lib/base-path';

/**
 * The puzzle zone's sitemap — served at `biscuitlab.net/puzzles/sitemap.xml` (Next's
 * `basePath` prefixes this special-file route, and the hub's `/puzzles/:path*` rewrite
 * proxies it through).
 *
 * Design (see Docs/research/sitemap-architecture-multi-zone.md):
 * - **Absolute URLs, `/puzzles`-prefixed.** Next does NOT auto-prepend `basePath` to the
 *   strings built here (unlike `<Link>`/`router`/`next/image`), and Google rejects
 *   relative sitemap URLs — so the origin + `BASE_PATH` are composed explicitly. `ORIGIN`
 *   mirrors the layout's `metadataBase`; `BASE_PATH` is the single source of truth shared
 *   with `next.config.ts` and the auth/data-fetch paths.
 * - **No `<lastmod>`.** These are static landing surfaces with no verifiable per-URL
 *   modification time, and Google treats lastmod trust as binary — a build-time
 *   `new Date()` would manufacture false freshness and can poison the signal site-wide.
 * - **Cross-zone model is Option B**, not a hand-rolled index: this sitemap plus the
 *   hub's own are both advertised in the hub's `robots.txt`. A hand-rolled
 *   `app/sitemap.xml/route.ts` would collide with this special file (a known Next trap).
 * - **Curated, indexable set only.** Auth pages (`/signin`, `/account`) are excluded and
 *   additionally carry `robots: { index: false }`.
 */
const ORIGIN = 'https://biscuitlab.net';
const BASE = `${ORIGIN}${BASE_PATH}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE },
    { url: `${BASE}/daily` },
    { url: `${BASE}/leaderboard` },
    { url: `${BASE}/archive` },
    { url: `${BASE}/play` },
    { url: `${BASE}/generate` },
  ];
}
