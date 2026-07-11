# Auth Panel (`AuthPanel.tsx`)

The sign-in / sign-up form.

## Why passkeys-first, and inline errors

**Why:** AGENTS.md §6 mandates passkeys as the primary method, so the passkey button is on
top, with Google and email/password as bootstraps below. better-auth client calls return
`{ error }` rather than throwing, so errors are surfaced inline and the form stays usable.
On success it navigates to `callbackURL` (Google redirects the browser itself).

```text
passkey button   -> signIn.passkey()        -> navigate on success
Google button    -> signIn.social(google)   -> browser redirects to Google
email form       -> signUp.email | signIn.email (by mode) -> navigate on success
mode toggle       flips sign in <-> create account
```
