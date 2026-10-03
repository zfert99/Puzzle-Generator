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

**Escape and outside-click close it (October 2026).** A native `<details>` does neither on its
own, so an opened menu stayed open until its summary was clicked again — not how a menu is
expected to behave. One mount effect adds two document listeners (removed on unmount):

```text
keydown Escape while open      -> close, and return focus to the <summary>
                                  (focus would otherwise be left inside a hidden panel)
pointerdown outside <details>  -> close
```

`pointerdown` rather than `click` so the menu closes as the press starts, before whatever was
pressed handles it. Both listeners check `details.open` first, so they cost nothing while the
menu is shut.

The "▾" glyph is `aria-hidden` so the disclosure's accessible name is just "More"
(September 2026 review nit).

**Why each link closes the menu itself (October 2026):** the close used to be one click
handler on the panel `<div>`, which jsx-a11y's strict rules reject (a static element with a
mouse handler and no keyboard twin). Each `Link` carries its own `onClick`; a keyboard activation
of a link fires `click` too, so nothing is lost.
