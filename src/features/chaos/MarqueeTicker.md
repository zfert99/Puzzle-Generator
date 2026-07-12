# Marquee Ticker (`MarqueeTicker.tsx`)

An old-portal scrolling ticker (chaos layer §8).

**Why the duplicated track + SR copy:** the visible track is duplicated so the CSS
`marquee-scroll` loops seamlessly; it **pauses on hover** and is **static under
`prefers-reduced-motion`** (via `.marquee*` in globals.css). A **static screen-reader-only
duplicate** carries the same content, so the animation is purely decorative (a11y §6).
Chrome only — never over the solve grid.
