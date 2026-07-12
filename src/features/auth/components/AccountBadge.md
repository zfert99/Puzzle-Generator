# Account Badge (`AccountBadge.tsx`)

A small session-aware header control.

## Why

**Why:** Shows the signed-in user's name with sign-out + "add passkey", or a "Sign in" link
when signed out. Uses better-auth's reactive `useSession`, so it updates without a page
reload after sign-in/out. "Add passkey" lives here (post-sign-in) because a passkey must be
registered against an existing account — passkeys-first means the passkey is the primary
*returning* login, set up once from a signed-in session.

```text
isPending -> "…"
no session -> "Sign in" link (/signin)
session    -> username||name · Set/Change username · Add passkey · Sign out
editing    -> inline input -> updateUser({ username }) (3–20 [a-zA-Z0-9_-]; "Taken" on conflict)
```

Username editing is inline here so a handle can be changed any time; the first-time prompt
lives in [UsernamePrompt](./UsernamePrompt.md).
