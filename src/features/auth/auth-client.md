# Auth Client (`auth-client.ts`)

The browser-side better-auth client — the client counterpart to the server `auth` instance.

## Why

**Why:** Client Components can't call the server `auth` instance directly, so they use this
client, which talks to `/api/auth/*` on the same origin (no `baseURL` needed). It carries
the passkey plugin so `signIn.passkey()` / `passkey.addPasskey()` exist. It holds no secrets
— those stay server-side; this only calls the endpoints. Import from Client Components only.

```text
exports: authClient, and destructured signIn / signUp / signOut / useSession / passkey
```
