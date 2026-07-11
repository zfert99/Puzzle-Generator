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
driver are Node-native and crash on the Edge runtime. The OAuth redirect URI Google must be
given is `<BETTER_AUTH_URL>/api/auth/callback/google`.
