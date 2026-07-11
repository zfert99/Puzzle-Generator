# Sign-in Page (`/signin`)

The authentication route.

## Why a Server shell

**Why:** Like the other routes, this is routing/layout only — the interactive form lives in
the client `AuthPanel` leaf. No session logic here; the client handles sign-in and navigates
on success. Keeps the page a static shell (AGENTS.md §1).
