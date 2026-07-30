/**
 * Single source of truth for the app's Next.js `basePath`.
 *
 * The app is served under `/puzzles` via the Biscuit Lab hub's multi-zone rewrite
 * (see `next.config.ts` and `Docs/multi-zone-migration-plan.md`). `basePath` is set
 * unconditionally in `next.config.ts`, so it also applies in local dev — every route
 * and route handler lives under `/puzzles`, in dev and prod alike.
 *
 * Next auto-prepends `basePath` to `<Link>`, `next/image`, `router.push()`, and
 * `/_next/*` assets — **but NOT to `fetch()`**. A client `fetch('/api/generate')`
 * therefore targets `/api/generate`, which under the hub proxy escapes the puzzles
 * zone and 404s. Every same-origin `fetch()` to one of our own route handlers must
 * go through {@link apiPath} so the `/puzzles` prefix is applied.
 *
 * `basePath` is build-time inlined by Next and is not exposed to client code at
 * runtime, so this constant is a hand-maintained mirror. **It MUST stay in sync with
 * `basePath` in `next.config.ts`** (and with the `/puzzles/api/auth` client basePath
 * in `src/features/auth/auth-client.ts`). If the mount path ever changes, change it
 * in all three places.
 */
export const BASE_PATH = '/puzzles';

/**
 * Prefix a root-relative API path (e.g. `/api/generate`) with the app `basePath`,
 * yielding a URL that resolves to our route handler under the puzzles zone
 * (`/puzzles/api/generate`). Use for every same-origin `fetch()` to our own routes.
 *
 * @param path A root-relative path beginning with `/` (typically `/api/...`).
 * @returns The path with `BASE_PATH` prepended.
 */
export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
