# Marquee Ticker (`MarqueeTicker.tsx`)

An old-portal scrolling ticker (chaos layer §8).

**Why the duplicated track + SR copy:** the visible track is duplicated so the CSS
`marquee-scroll` loops seamlessly; it **pauses on hover** and is **static under
`prefers-reduced-motion`** (via `.marquee*` in globals.css). A **static screen-reader-only
duplicate** carries the same content, so the animation is purely decorative (a11y §6).
Chrome only — never over the solve grid.

**Why `.marquee` needs `contain: paint`, not just `overflow: hidden` (July 2026):** the
duplicated track is `white-space: nowrap`, so its unwrapped natural width is easily 1000px+
regardless of viewport size — by design, that's what makes it scroll continuously. On real
mobile browsers (verified on a real Android phone; not reproducible in any desktop or
emulated-mobile testing), that width could leak past `overflow: hidden` and inflate the
whole PAGE's layout viewport — only on `/daily`, the one route that renders this component.
`contain: paint` (`globals.css`) is a stronger isolation guarantee than `overflow: hidden`
alone: nothing inside the box can affect layout/paint outside it, full stop.
