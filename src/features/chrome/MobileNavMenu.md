# MobileNavMenu (`MobileNavMenu.tsx`)

The header's mobile overflow menu — QA finding **F11** (September 2026).

## Why it exists

`AppHeader` hides Archive below `sm` and PDF below `md` to keep the grape bar uncrowded, and
before this component those pages simply had **no header path** on a phone — reachable only by
going back through the hub. F11's alternatives were an overflow menu or "accept and document the
hub as canonical"; the menu won because a native `<details>`/`<summary>` disclosure costs almost
nothing (keyboard and screen-reader semantics built in, no positioning library, no focus code).

## How it stays correct at every width

- The whole menu is `md:hidden` — PDF is the *last* link to appear inline (at `md`), so above
  that the menu has nothing to offer.
- Inside the panel each link mirrors its inline twin's breakpoint (Archive appears inline from
  `sm`, so its menu copy is `sm:hidden`). Exactly one visible path to each page at every width.

## The one bit of JavaScript

The root layout's header **persists across client navigations**, so a plain `<details>` opened
on one page would still be open on the next. The panel's click handler closes the disclosure
before `Link` navigates — which is the only reason this leaf is a client component while
`AppHeader` stays a Server Component. Pinned by a test.
