# Not Found (`not-found.tsx`)

The branded 404.

## Why it exists

**Why:** Next renders a route's `not-found.tsx` for any unmatched path (and for `notFound()`
calls). Without one, the app served Next's default two-line "This page could not be found."
inside the real header — unstyled, with no link onward. This page keeps the Biscuit Lab chrome
and sends the visitor to the hub, the one surface from which everything else is reachable.
`robots: { index: false }` keeps a 404 shell out of the index.

```text
render: <main id="main"> glass panel -> heading, one line, "Back to the hub" (Link to /)
```
