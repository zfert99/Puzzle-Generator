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
              Escape or Cancel -> leave edit mode, clear the error
```

Username editing is inline here so a handle can be changed any time; the first-time prompt
lives in [UsernamePrompt](./UsernamePrompt.md).

The pattern check is a **local hint only** — it comes from [username.ts](../username.md), and
the server enforces the same rule (see [auth.md](../auth.md)), so bypassing this input still
gets a 400.

## Inline-edit accessibility (October 2026)

- **Escape cancels.** The inline edit had a Cancel button but no keyboard exit; Escape anywhere
  in the form now does what Cancel does (leave edit mode, clear the error).
- **A real label.** A visually hidden "Username" `<label>` names the input (placeholder text is
  not a label), and `autocomplete="off"` keeps the browser from suggesting saved logins for a
  public handle.
- **The error is `role="alert"`**, so a "taken" or pattern failure is announced.
- **Focus ring on grape**, replacing the butterscotch ring that barely showed on the grape bar's
  paper input, and "Sign out" is `text-paper/90` rather than `/70` so it clears contrast on grape.
