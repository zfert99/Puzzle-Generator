# Session Accessor (`session.ts`)

The single server-side "who is the current user?" helper.

## Why centralize it

**Why:** Everything that needs identity — Server Components, route handlers, and especially
the 4.3.1 ownership (BOLA) checks and 4.4 solve submission — should ask in exactly one way
and then filter by `session.user.id`. Centralizing means no route hand-rolls header parsing,
and the auth-library specifics stay behind this one function. `headers()` is async in Next
16, so it is awaited before being passed to better-auth.

```text
getSession()        -> better-auth session object (or null) for the current request
getCurrentUserId()  -> the current user's id, or null if signed out  (basis for BOLA checks)
```

## Note

`server-only`: this pulls in the auth instance and must stay off the client. Downstream code
should depend on `getCurrentUserId()` rather than reaching into better-auth directly, so the
ownership-check pattern is uniform across every personal-data route.
