# Auth Panel (`AuthPanel.tsx`)

The sign-in / sign-up form.

## Why passkeys-first, and inline errors

**Why:** AGENTS.md §6 mandates passkeys as the primary method, so the passkey button is on
top, with Google and email/password as bootstraps below. better-auth client calls return
`{ error }` rather than throwing, so errors are surfaced inline and the form stays usable.
On success it navigates to `callbackURL` (Google redirects the browser itself).

```text
passkey button   -> signIn.passkey()        -> router.push(callbackURL) on success
Google button    -> signIn.social(google)   -> browser redirects to Google
email form       -> signUp.email | signIn.email (by mode) -> router.push(callbackURL)
mode toggle       flips sign in <-> create account
```

## Why the Google `callbackURL` is basePath-prefixed but the others aren't

**Why:** `callbackURL` is passed in as an in-app, root-relative path (default `/daily`). The
passkey and email flows navigate with `router.push(callbackURL)`, and Next's router prepends
the app's `basePath` (`/puzzles`) automatically — they get `/puzzles/daily`. But
`signIn.social` hands the string to **better-auth**, which resolves it against the auth
*origin* (`https://biscuitlab.net`), **not** Next's router — so it does **not** prepend
`basePath`. A bare `/daily` therefore sent the user to `biscuitlab.net/daily` (no `/puzzles`
→ 404). `handleGoogle` prefixes `basePath` explicitly (guarded against double-prefixing) so
the post-login redirect lands on the real page. This is the client-side mirror of the
server-side "origin-only baseURL loses `/puzzles`" issue documented in
[`auth.md`](../auth.md) and the hub's `Docs/multi-zone-cutover-log.md`.
