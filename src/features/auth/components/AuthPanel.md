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

## Accessible form fields (October 2026)

**Why real labels:** every input used to rely on its placeholder alone. A placeholder vanishes
as soon as the field has a value and is not a label to assistive tech (WCAG 1.3.1 / 3.3.2), so
each field now has a visually hidden `<label htmlFor>`. The password label says "8+ characters"
only in sign-up mode, where the rule is relevant.

**Why the `autocomplete` tokens (WCAG 1.3.5):** they let password managers fill the right field.
`nickname` for the display name, `current-password` vs `new-password` by mode (so a manager
offers a stored password on sign-in and a generated one on sign-up), and **`username webauthn`**
on the email field — the `webauthn` token enables passkey *conditional UI*, where the browser
offers a stored passkey straight from the email field's autofill dropdown. That is the
passkeys-first rule reaching the email form, not just the top button.

**Why `role="alert"`:** the error paragraph used to appear silently. It is now an alert (read
out the moment it renders) and is linked to the form with `aria-describedby` while present.

```text
display name (signup only) -> label "Display name", autocomplete=nickname
email                      -> label "Email",        autocomplete="username webauthn"
password                   -> label by mode,        autocomplete=current-password | new-password
error                      -> <p id="auth-error" role="alert">; form aria-describedby=auth-error
```

**Focus rings on grape (October 2026):** inputs used to ring in leftover pre-redesign colours
(Tailwind `indigo-500`, or butterscotch, which is near-invisible on the cream paper). They now use
`ring-grape`, the design system's interactive colour, so every focus ring on the site matches.
The "or email" divider lines use `bg-ink-soft/40` instead of a hard-coded grey that ignored the
dark theme.

## Google button busy reset (October 2026)

**Why:** `handleGoogle` sets `busy` (disabling every button) and, on success, the browser
navigates away to Google, so nothing ever needed to reset it. But on a failure — the provider
returns `{ error }`, or the call throws — the panel stayed disabled with no message, and the
user had to reload. The call is now wrapped: an `{ error }` result or a thrown exception
surfaces the message and clears `busy`. Success still never resets it, because the page is
leaving.
