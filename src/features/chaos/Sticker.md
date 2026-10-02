# Sticker (`Sticker.tsx`)

A hand-cut "sticker" badge (chaos layer §8) — a rotated pill in a wildcard color with an
**asymmetric** `border-radius` (so it reads as cut, not a uniform pill), Marker font, offset
shadow. Absolutely positioned by the caller.

**Why quarantined:** the wildcard sticker colors (`--sticker-pink/lime/sky`) are decoration
only — never text/buttons/functional UI — and a sticker never carries meaning on its own
(pair its label with real UI when it conveys state, per a11y §6). `aria-hidden`.

**Why `text-on-sticker`, not `text-ink` (October 2026):** the fills are the same in both
themes, but `--ink` flips to cream in the dark theme — so the dark-mode hub's "new!" sticker
read cream-on-lime at 1.25:1 and the daily's "play me!" cream-on-pink at 2.35:1. The first
dark-mode axe run (`e2e/a11y.spec.ts`) caught it. `--on-sticker` is the dark ink in both themes.
