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
session    -> name · Add passkey (passkey.addPasskey) · Sign out (signOut + refresh)
```
