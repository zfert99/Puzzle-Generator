# Auth Errors (`errors.ts`)

Shared auth error types.

## Why a separate, dependency-free module

**Why:** `UnauthorizedError` needs to be thrown by the `server-only` session guard AND
caught by thin route controllers — and referenced in tests. If it lived in `session.ts` (or
`auth.ts`), importing it would drag in the whole better-auth instance and the `server-only`
guard, which breaks plain-Node test imports. Keeping it in a tiny module with no imports
lets every layer share the exact same type.

```text
UnauthorizedError  ->  thrown by requireUserId() when there is no session; routes map it to 401
```
