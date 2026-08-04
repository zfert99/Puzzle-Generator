# Auth Catch-all Route (`/api/auth/[...all]`)

Mounts every better-auth endpoint under `/api/auth/*`.

## Why a catch-all and why so thin

**Why:** better-auth exposes many endpoints — sign-up, sign-in, sign-out, session, OAuth
callbacks, passkey register/authenticate. Rather than hand-writing each, the `[...all]`
catch-all hands the entire surface to better-auth's `toNextJsHandler`. The file stays a thin
adapter (AGENTS.md §1) — all logic lives in the `auth` instance.

```text
export runtime = "nodejs"        # Argon2 native binding + DB driver are Node-only, not Edge
export { GET, POST } = toNextJsHandler(auth)
```

## Note

`runtime = "nodejs"` is required: the Argon2id hasher (`@node-rs/argon2`) and the Neon DB
driver are Node-native and crash on the Edge runtime.

Under the multi-zone `basePath: '/puzzles'`, Next strips `/puzzles` before this handler
runs, so it receives requests at `/api/auth/*` (verified live — see the hub's
`Docs/multi-zone-cutover-log.md`). The OAuth redirect URI Google must be given is the
**public**, `/puzzles`-prefixed URL the browser uses —
`https://biscuitlab.net/puzzles/api/auth/callback/google` — which the hub rewrites to the
origin and Next strips back off before reaching here. It is pinned via the Google
provider's `redirectURI` in [`auth.ts`](../../../../features/auth/auth.md), not derived from
`baseURL` (which is origin-only).
