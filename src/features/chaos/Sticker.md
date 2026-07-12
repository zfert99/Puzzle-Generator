# Sticker (`Sticker.tsx`)

A hand-cut "sticker" badge (chaos layer §8) — a rotated pill in a wildcard color with an
**asymmetric** `border-radius` (so it reads as cut, not a uniform pill), Marker font, offset
shadow. Absolutely positioned by the caller.

**Why quarantined:** the wildcard sticker colors (`--sticker-pink/lime/sky`) are decoration
only — never text/buttons/functional UI — and a sticker never carries meaning on its own
(pair its label with real UI when it conveys state, per a11y §6). `aria-hidden`.
