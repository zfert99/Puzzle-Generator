# Account Badge (`AccountBadge.tsx`)

A small session-aware header control.

## Why

**Why:** Shows the signed-in user's name with username editing and sign-out, or a "Sign in"
link when signed out. Uses better-auth's reactive `useSession`, so it updates without a page
reload after sign-in/out.

"Add passkey" was **removed from the banner** (deliberate declutter, July 2026). Passkey
sign-in/up still lives on `/signin`; registering an *additional* passkey from a signed-in
session currently has no UI — it belongs on a future account/settings surface, not squeezed
into the header. (`better-auth`'s `passkey.addPasskey` remains available client-side when
that surface exists.)

```text
isPending -> "…"
no session -> "Sign in" link (/signin)
session    -> username||name · Set/Change username · Sign out
editing    -> inline input -> updateUser({ username }) (3–20 [a-zA-Z0-9_-]; "Taken" on conflict)
```

Username editing is inline here so a handle can be changed any time; the first-time prompt
lives in [UsernamePrompt](./UsernamePrompt.md).
