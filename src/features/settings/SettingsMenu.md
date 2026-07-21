# Settings Menu (`SettingsMenu.tsx`)

The ⚙️ gear in the header (reachable on every page) opening an accessible settings dialog. It
**absorbs the theme toggle** — theme (light/dark) is a row here alongside Motion
(Auto/Full/Reduced), Colorblind mode, and Highlight mistakes.

## Practises the a11y research on itself

Follows the modal pattern from `Docs/research/accessibility-responsive-qa.md`: `role="dialog"` with `aria-modal`, focus moved in on open and **returned to the gear on close**, `Esc` to close,
a click-outside scrim, and `role="switch"`/`aria-pressed` on the controls. Theme is read via a
`useSyncExternalStore` subscription to `themechange` (no setState-in-effect).
