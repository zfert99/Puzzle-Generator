# App Header (`AppHeader.tsx`)

The global grape nav bar — the design system's chrome, rendered once in the root layout so
every page shares it (replacing the old per-page header rows).

## Why global

**Why:** Nav, the theme toggle, and the account control were duplicated (and drifting) across
page shells. Hoisting them into one header in `layout.tsx` unifies the chrome, kills the
duplication, and matches the design system's "grape background bar, cream Fredoka wordmark,
ghost nav links" spec. Pages now just render their own content in a `flex-1` main below it.

```text
grape bar (ink bottom border):
  left  -> 🧩 Puzzle Lab wordmark (Fredoka, cream) + a small handwritten marginalia aside
  right -> nav links (Daily / Leaderboard / Play / PDF) · ThemeToggle · AccountBadge
```

## Notes

- The marginalia uses `--font-marker` (Permanent Marker), which lands with the **5.5** chaos
  layer; until then it falls back to a system cursive, so the slot is reserved now.
- `ThemeToggle` and `AccountBadge` are restyled cream-on-grape for this bar (they used to sit
  on paper backgrounds in the per-page rows).

## Archive link (July 2026)

Archive joined the nav (`sm+` only — small screens stay uncrowded and reach it via the hub
card).
