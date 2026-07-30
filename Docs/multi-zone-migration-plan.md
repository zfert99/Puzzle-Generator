# Multi-Zone Migration — Puzzle Generator side (Phase 3 groundwork)

Draft groundwork for serving Puzzle Lab under **`biscuitlab.net/puzzles`** (a
subfolder of the Biscuit Lab hub) instead of the `puzzles.biscuitlab.net`
subdomain. The hub side and the rationale live in the hub repo
(`Biscuit-Website`): `Docs/BiscuitLab_Hub_Plan.md` Part 7 and
`Docs/multi-zone-migration-runbook.md`. This doc is the Puzzle-Generator-side
changes only.

> **Status: draft / not yet applied.** Nothing here is wired up. Apply in the
> ordered sequence in the runbook, and only after PR #25 (security hardening)
> merges. The rpID step is disruptive to existing passkeys — read §1 first.
>
> **Validated & corrected** against `Docs/research/multi-zone-migration-validation.md`.
> Corrections from the first draft: the Host-based origin `noindex` is removed
> (self-defeating — it fires on the proxied response too; use canonicals), the
> `.biscuitlab.net` cookie is dropped (host-only cookies work — same apex host),
> and `metadataBase` gains the `/puzzles` path. rpID/basePath/301 core confirmed.

---

## 1. The rpID problem (read this first)

`src/features/auth/auth.ts` derives the passkey Relying Party ID from the app URL:

```ts
const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
const rpID = new URL(appUrl).hostname; // -> "puzzles.biscuitlab.net" in prod today
```

A passkey credential is permanently bound to the **rpID** it was created under,
and WebAuthn requires the rpID to be a registrable suffix of the page's origin:

| Serving origin | Valid rpIDs |
| --- | --- |
| `puzzles.biscuitlab.net` | `puzzles.biscuitlab.net` **or** `biscuitlab.net` |
| `biscuitlab.net` (after cutover) | `biscuitlab.net` only |

So two facts collide:

- Today's passkeys are scoped to `rpID = puzzles.biscuitlab.net`.
- After cutover the origin is `biscuitlab.net`, where that rpID is **invalid** —
  auth breaks entirely, and you can't even re-register under the old rpID.

**The fix is to move rpID to the apex (`biscuitlab.net`) *before* cutover**, while
still serving at `puzzles.biscuitlab.net` (allowed, because `biscuitlab.net` is a
valid suffix of that origin). Passkeys re-registered under `biscuitlab.net` then
keep working after the move to `biscuitlab.net/puzzles`.

**Honest caveat:** changing the rpID invalidates every *existing* passkey once —
users re-register (email/password + Google remain as fallback). Do it early, on
its own, so that one-time cost is decoupled from the URL change. Check how many
real passkey credentials exist first; if it's near-zero (likely this early), the
cost is trivial.

---

## 2. Code change — decouple rpID and origin from the app URL

Make the rpID and the WebAuthn origin overridable, and path-safe, so the rpID can
move to the apex independently of `BETTER_AUTH_URL`, and so a future
`BETTER_AUTH_URL` that carries a `/puzzles` path still yields a correct
(path-less) WebAuthn origin.

```diff
 const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
-const rpID = new URL(appUrl).hostname; // e.g. "localhost" in dev, the domain in prod
+// rpID defaults to the app URL's hostname, but can be pinned to the apex ahead of
+// the multi-zone migration so passkeys survive the move. See multi-zone-migration-plan.md.
+const rpID = process.env.PASSKEY_RP_ID ?? new URL(appUrl).hostname;
+// WebAuthn origin is scheme+host only (no path), so derive it — once BETTER_AUTH_URL
+// carries a "/puzzles" path, `appUrl` itself would be the wrong origin value.
+const passkeyOrigin = new URL(appUrl).origin;
```

```diff
-    passkey({ rpID, rpName: 'Puzzle Generator', origin: appUrl }),
+    passkey({ rpID, rpName: 'Puzzle Generator', origin: passkeyOrigin }),
```

Add to `.env.example`:

```bash
# --- Multi-zone migration (Phase 3) ---
# WebAuthn Relying Party ID for passkeys. Defaults to the BETTER_AUTH_URL hostname.
# Set to the apex (biscuitlab.net) BEFORE the migration so passkeys registered now
# survive the move to biscuitlab.net/puzzles. Changing this invalidates existing
# passkeys (users re-register once). See Docs/multi-zone-migration-plan.md.
PASSKEY_RP_ID=
```

This change is backward-compatible: with `PASSKEY_RP_ID` unset, behaviour is
identical to today. It can ship as its own small PR now (after #25).

---

## 3. Code change — basePath + public metadata (cutover PR, not before)

These only make sense once the hub is rewriting `/puzzles` to this deployment and
DNS is in place. Do **not** deploy `basePath` to a bare domain — it changes every
route and asset path immediately.

`next.config.ts`:

```diff
 const nextConfig: NextConfig = {
+  // Served under /puzzles via the hub's multi-zone rewrite. basePath auto-scopes
+  // routes AND /_next/* assets in Next 15+ — no assetPrefix needed (validation
+  // doc §2a).
+  basePath: '/puzzles',
+  // Cross-zone Server Actions (better-auth/form posts) must trust the public origin.
+  experimental: { serverActions: { allowedOrigins: ['biscuitlab.net'] } },
   serverExternalPackages: ['pdfkit'],
```

Root layout — set `metadataBase` to the **public** URL *including the `/puzzles`
path* so canonicals/OG resolve to the public path, not the origin host. Emit a
self-referencing canonical per page; this (not a Host-based origin `noindex`) is
the primary defense against the origin URL being indexed (validation doc §1, §9).

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://biscuitlab.net/puzzles'),
  // ...existing title/description
};
// per page, resolved against metadataBase:
//   alternates: { canonical: '/some-path' }
```

`vercel.json` — the cron path is relative to the deployment; under `basePath` the
route handler moves to `/puzzles/api/cron/daily`:

```diff
   "crons": [
-    { "path": "/api/cron/daily", "schedule": "0 0 * * *" }
+    { "path": "/puzzles/api/cron/daily", "schedule": "0 0 * * *" }
   ]
```

**better-auth under Next basePath (CORRECTED — safety review §3):**

- **`BETTER_AUTH_URL` must be ORIGIN-ONLY: `https://biscuitlab.net`.** A path in it
  makes better-auth's router base `/puzzles` (not `/puzzles/api/auth`) — the exact
  404 bug we hit (`withPath` drops the default basePath once the URL has a path).
- **The SERVER `basePath` is conditional on a basePath-strip test** — run it first
  (log `request.url` in the `[...all]` route on a GET to
  `/puzzles/api/auth/get-session`; see `Docs/multi-zone-cutover-log.md`):
  - **Not stripped** (URL keeps `/puzzles`): set server `basePath: '/puzzles/api/auth'`.
  - **Stripped** (URL is `/api/auth/...`): leave server `basePath` default
    (`/api/auth`) AND set the Google provider **`redirectURI`** explicitly to
    `https://biscuitlab.net/puzzles/api/auth/callback/google` (the stripped base
    would otherwise generate it without `/puzzles`).
- The **client** uses `basePath: '/puzzles/api/auth'` either way. Do NOT pass a
  relative `baseURL` — `new URL(baseURL)` throws `Invalid base URL` at build.
- Cookie `Path` is hard-coded `/` in better-auth, so `get-session` on normal pages
  works regardless. If PG uses better-auth **plugins** with their own routes, test
  each explicitly (#4715 reported a plugin route still 404'd after the workaround).
- `trustedOrigins` includes `https://biscuitlab.net` (already scoped by PR #25's
  env mechanism — add the apex).
- Keep cookies **host-only** — do NOT set `Domain=.biscuitlab.net`. Both zones are
  the same apex host after cutover, so host-only cookies already cover `/puzzles/*`;
  a domain cookie breaks the `__Host-` prefix and widens CSRF surface (validation
  doc §3).
- `passkeyOrigin` from §2 resolves to `https://biscuitlab.net` (path stripped) —
  correct for WebAuthn (origin is scheme+host, no path/trailing slash).
- Update the Google OAuth **Authorized redirect URI** →
  `https://biscuitlab.net/puzzles/api/auth/callback/google` and **JS origins** →
  `https://biscuitlab.net`.
- Set `images.remotePatterns` **and `images.qualities`** (Next 16 requires an
  explicit qualities allowlist — a quality not listed returns 400) for image
  optimization, which rides the `/puzzles/:path*` rewrite at `/puzzles/_next/image`.
- **Emit per-page canonicals** (safety review §7 — top SEO gap): add
  `alternates: { canonical: './' }` in the root layout so every page declares its
  `biscuitlab.net/puzzles/...` URL, resolved against `metadataBase`. The exposed
  origin alias makes this important, not optional.
- Full absolute-URL audit (validation doc §9): OG images, sitemap `loc`, JSON-LD
  URLs, canonical/alternate links, `robots.txt` `Sitemap:`, WebAuthn `origin`,
  OAuth callbacks, transactional email + share links, any hardcoded
  `puzzles.biscuitlab.net`.
- **Same-origin `fetch()` calls need the basePath too (POST-CUTOVER REGRESSION —
  fixed 2026-07-30).** Next does NOT prepend `basePath` to `fetch()` (only to
  `<Link>`/`next/image`/`router`/`/_next/*`), so every client `fetch('/api/...')`
  404s under the `/puzzles` mount. This broke generation, the daily, and PDF export
  after cutover. Fix: `src/lib/base-path.ts` (`apiPath()`), applied to all nine app
  fetch calls. This is the *relative*-URL counterpart to the absolute-URL audit above
  — it looks correct precisely because it's relative. See
  `Docs/research/multi-zone-basepath-fetch-fix.md`. **Guardrail:** any new client
  `fetch('/api/...')` MUST go through `apiPath()`.

---

## 4. Ordered checklist (Puzzle-Generator side)

1. [x] Merge PR #25 (security hardening; scopes `trustedOrigins`). ✅
2. [x] Ship §2 (rpID/origin decoupling) — ✅ merged in #27.
3. [x] **rpID move** — ✅ `PASSKEY_RP_ID=biscuitlab.net` set on Puzzle Lab prod;
       a fresh passkey registered via the new `/account` page (#28) round-trips.
4. [x] Rewrite target = **dedicated custom host `origin-puzzles.biscuitlab.net`**
       on this project (grey-cloud DNS), **Deployment Protection left ON** (safety
       review §1). ✅ live — the generated `*.vercel.app` alias 302s (locked); the
       hub's `PUZZLES_ORIGIN` points at the custom host. Protection was NOT disabled.
5. [x] `metadataBase = https://biscuitlab.net/puzzles` + **per-page canonicals**
       (`alternates: { canonical: './' }` in the root layout) — ✅ shipped in #34;
       verified each route self-canonicalizes to `…/puzzles/*` with no double prefix.
6. [x] Ship §3 (basePath + `serverActions.allowedOrigins` + metadataBase + cron
       path + client `basePath`) — ✅ merged in #29 (deploys at the flip).
7. [x] `BETTER_AUTH_URL` → **`https://biscuitlab.net`** (origin only). ✅ The strip
       test showed Next strips `/puzzles`, so the server derives an origin-only
       `baseURL` (router mounts at `/api/auth`, #32) and the Google `redirectURI` +
       client social `callbackURL` are pinned to the public `/puzzles/...` path
       (#32/#33). Client `basePath` `/puzzles/api/auth` (#29); cookies host-only.
8. [x] After the hub's rewrite + 301 are live: ✅ verified — `biscuitlab.net/puzzles`
       serves with assets + auth intact (passkey + Google OAuth round-trips confirmed
       in the browser); the `puzzles.biscuitlab.net` 301 is folded into the hub
       (host-scoped `redirects()`), pending only the domain attach.
9. [x] **Post-cutover regression fixed (2026-07-30):** client `fetch('/api/...')`
       calls did not carry the `/puzzles` basePath, 404ing generation, the daily,
       and PDF export. Wrapped all nine in `apiPath()` (`src/lib/base-path.ts`);
       verified via dev smoke (`/puzzles/api/puzzle` → 200, bare path → 404) + full
       suite. Write-up: [multi-zone-basepath-fetch-fix.md](research/multi-zone-basepath-fetch-fix.md).
10. [x] **Sitemap + noindex hygiene (2026-07-30):** added `app/sitemap.ts`
       (`/puzzles/sitemap.xml` — 6 curated absolute URLs, no `lastmod`) and
       `robots: { index: false }` on `/signin` + `/account` (excluded from the
       sitemap). Cross-zone discovery uses **Option B** — this sitemap + the hub's
       own, both in the hub `robots.txt`; **no** hand-rolled index (special-file
       collision). Decision record:
       [sitemap-architecture-multi-zone.md](research/sitemap-architecture-multi-zone.md).

## 5. Rollback

Remove `basePath`, revert `BETTER_AUTH_URL`, remove the hub rewrite + 301. Under
ten minutes — *provided the rpID was moved first*, which is the entire reason it
goes first. Leave `PASSKEY_RP_ID=biscuitlab.net` in place through a rollback;
it's valid on the subdomain too.
