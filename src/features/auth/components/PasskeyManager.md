# Passkey Manager (`PasskeyManager.tsx`)

The signed-in passkey management surface: list registered passkeys, add a new one, remove
one. Rendered by the `/account` page.

## Why this is a client leaf

**Why:** `passkey.addPasskey()` runs the browser WebAuthn credential ceremony
(`navigator.credentials.create`), which only exists client-side. So this is a `'use client'`
leaf; the `/account` route file stays a thin Server Component shell (App Router purity).

## Why `useListPasskeys()` and no manual refetch

**Why:** better-auth's passkey plugin exposes a `$listPasskeys` query atom. The
`authClient.useListPasskeys()` hook reads it, and the plugin's atom listeners re-run that
query after `/passkey/verify-registration`, `/passkey/delete-passkey`, and `/sign-out`. So
adding or removing a passkey refreshes the list automatically — the component holds no list
state of its own, only the add-form input and a busy/error flag.

## Behaviour

```text
useSession() pending        -> "…"
no session                  -> "Sign in to manage your passkeys" (link to /signin)
signed in:
  add form (optional name) -> passkey.addPasskey({ name }) ; error -> inline alert
  useListPasskeys():
    isPending              -> "Loading passkeys…"
    error                  -> "Couldn't load your passkeys."
    empty                  -> "No passkeys yet. Add one above."
    list                   -> name + added-date, each with a Remove button
  Remove                   -> passkey.deletePasskey({ id })
```

## Why it exists

The header's "Add passkey" was removed in July 2026 (declutter) with a note that
registration "belongs on a future account/settings surface." This is that surface. It also
makes the passkeys-first flow actually usable (previously there was no UI to register a
passkey at all) and is the prerequisite check for the multi-zone rpID move — register a
fresh passkey here to verify it works under the new `rpID`. See
`Docs/multi-zone-migration-plan.md`.

## Testing

`PasskeyManager.test.tsx` (`jsdom`) mocks the `auth-client` boundary — WebAuthn can't run in
jsdom, so the better-auth client is the external boundary (AGENTS.md Section 4). Tests assert
the component's own behaviour: session gating, empty/list rendering, add/remove calls with
the right arguments, and error surfacing — via accessibility-first queries (`getByRole`,
`getByLabelText`).
