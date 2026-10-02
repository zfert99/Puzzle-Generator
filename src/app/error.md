# Route Error Boundary (`error.tsx`)

The branded error screen for a thrown render error on any route.

## Why it exists

**Why:** Without a route-level `error.tsx`, a client-side exception replaced the whole page
with Next's unstyled "Application error" text and no way back. This boundary keeps the root
layout's chrome (the header still renders around it), says what happened without exposing the
stack, and offers the two useful actions: **Try again** (`reset()` re-renders the failed
segment) and a link to the hub. It also reassures about the saved puzzle, which lives in
localStorage and is untouched by a render error.

It is a Client Component because React error boundaries need the browser. The error goes to
`console.error` on purpose — this is the browser, where the server's structured Pino logger
does not exist and the console is what DevTools and any client error tracking read.

```text
props: error (with Next's `digest`), reset
effect: console.error(error)
render: <main id="main"> panel (role=alert) -> heading, reassurance, [Try again] [Back to the hub]
```
