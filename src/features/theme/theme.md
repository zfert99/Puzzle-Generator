# Theme Helper (`theme.ts`)

The small, framework-free core of light/dark theming.

## Why a pre-paint script string

**Why:** `THEME_PRE_PAINT_SCRIPT` is a plain string (not a module) because it must run
**inline, before paint** — injected into `<body>` by the root layout. It sets `data-theme`
on `<html>` from the saved choice (`localStorage`), falling back to the OS
`prefers-color-scheme`. Running before React hydrates means no theme flash and no hydration
mismatch (the attribute is already correct when the server HTML is compared).

```text
THEME_PRE_PAINT_SCRIPT  -> (inline) set <html data-theme> from storage | system, before paint
setTheme(theme)         -> apply data-theme now + persist to localStorage (client only)
getAppliedTheme()       -> read the currently-applied theme ('dark' if the attr is 'dark', else 'light')
```

`setTheme` swallows `localStorage` failures (private mode) — the attribute still applies for
the session.
