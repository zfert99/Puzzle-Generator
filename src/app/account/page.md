# `/account` route (`page.tsx`)

The signed-in account surface. A Server Component shell (routing + layout only) that renders
the client `PasskeyManager` leaf; there is no session logic here — the client component gates
on the session and prompts sign-in when absent.

```text
/account  ->  <main> heading "Account" + glass-panel > <PasskeyManager />
```

Reached by clicking the account handle in the global `AppHeader` (see
[AccountBadge.md](../../features/auth/components/AccountBadge.md)). Passkey management lives
in [PasskeyManager](../../features/auth/components/PasskeyManager.md).
