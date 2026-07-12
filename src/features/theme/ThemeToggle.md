# Theme Toggle (`ThemeToggle.tsx`)

The light/dark toggle button.

## Why `useSyncExternalStore`, not effect + setState

**Why:** The theme is applied before paint by the inline script, so this control only needs
to *read* the current value and flip it. Reading via `useSyncExternalStore` (rather than an
effect that calls setState) is both **hydration-safe** and satisfies the
`react-hooks/set-state-in-effect` rule:

- `getServerSnapshot` returns `null`, so the server render and the first client render match
  (a neutral placeholder — no icon flash, no mismatch).
- After hydration it reads the real theme from the DOM (`getAppliedTheme`).
- The toggle calls `setTheme(next)` then dispatches a `themechange` window event; the store's
  `subscribe` listens for it and re-renders the icon — no synchronous setState in an effect.

```text
theme = useSyncExternalStore(subscribe-to-'themechange', getAppliedTheme, () => null)
onClick -> setTheme(opposite) + dispatch 'themechange'
render  -> null: placeholder · dark: ☀️ · light: 🌙   (aria-label describes the action)
```

## Note

Placed on the home page in 5.1; it moves into shared header chrome in 5.2.
