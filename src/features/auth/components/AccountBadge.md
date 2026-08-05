# Account Badge (`AccountBadge.tsx`)

A small session-aware header control.

## Why

**Why:** Shows the signed-in user's name with username editing and sign-out, or a "Sign in"
link when signed out. Uses better-auth's reactive `useSession`, so it updates without a page
reload after sign-in/out.

"Add passkey" was **removed from the banner** (deliberate declutter, July 2026). Passkey
sign-in/up lives on `/signin`, and managing passkeys (add/remove) lives on the `/account`
surface — reached by clicking the handle here — rather than squeezed into the header. See
[PasskeyManager](./PasskeyManager.md).

```text
isPending -> "…"
no session -> "Sign in" link (/signin)
session    -> handle (links to /account) · Set/Change username · Sign out
editing    -> inline input -> updateUser({ username }) (USERNAME_PATTERN; "Taken" on conflict)
```

Username editing is inline here so a handle can be changed any time; the first-time prompt
lives in [UsernamePrompt](./UsernamePrompt.md).

The pattern check is a **local hint only** — it comes from [username.ts](../username.md), and
the server enforces the same rule (see [auth.md](../auth.md)), so bypassing this input still
gets a 400.
