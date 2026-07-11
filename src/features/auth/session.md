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
requireUserId()     -> the current user's id, or throw UnauthorizedError (-> 401)
```

## `requireUserId()` — the BOLA entry point

**Why:** Protected routes call this and pass the returned id — the server's notion of "who
is calling" — into the data layer. A route must **never** take a `userId` from the request;
deriving it here is what stops one caller from acting as another user (4.3.1). It throws
`UnauthorizedError` (from [errors.ts](./errors.md)) so the caller can't be treated as an
anonymous no-op.

## Note

`server-only`: this pulls in the auth instance and must stay off the client. Downstream code
should depend on `getCurrentUserId()` rather than reaching into better-auth directly, so the
ownership-check pattern is uniform across every personal-data route.
