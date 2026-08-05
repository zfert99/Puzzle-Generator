# Username Schema (`username-schema.ts`)

The server-side username validator, wired into better-auth as
`user.additionalFields.username.validator.input` (see [auth.md](./auth.md)).

```text
usernameSchema = z.string().regex(USERNAME_PATTERN, USERNAME_RULE)
```

## Why it is separate from `username.ts`

**Why:** Two reasons, both concrete.

1. **Bundle:** the pattern is imported by `'use client'` components. Building the schema
   alongside it would pull Zod into the client bundle for two components that need only a regex.
2. **Testability:** `auth.ts` imports `server-only` and the Neon client, so a unit test cannot
   reach a schema defined *inside* it without standing up the whole auth instance. As its own
   module the control is directly testable — see `username-schema.test.ts`, which asserts the
   abuse cases the client-only check used to let through.

## Why Zod, and the two contract details that are load-bearing

**Why Zod rather than a hand-rolled object:** better-auth calls
`validator.input['~standard'].validate(value)` — the Standard Schema v1 interface. Zod v4
implements it, so this is a one-liner instead of a hand-implemented protocol. Zod was already
resolved in the tree (better-auth depends on it); this PR promotes it to a **direct** dependency
rather than importing a transitively-resolved package, which would break silently if
better-auth ever dropped it.

**Why the schema must be synchronous:** better-auth throws `INTERNAL_SERVER_ERROR` if
`validate()` returns a Promise. A string+regex validates synchronously in Zod v4, but that is a
property of *this* schema, not a guarantee of the library — anything added here (a `.refine()`
doing an async lookup, say) would turn every rejected username into a 500. The test asserts
this directly.

**Why the message matters:** a rejection surfaces to the client as a 400 carrying
`issues[0].message`, which is why the message is the shared `USERNAME_RULE` string rather than
Zod's default "Invalid string" phrasing.
