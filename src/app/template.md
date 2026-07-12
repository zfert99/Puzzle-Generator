# Route Template (`template.tsx`)

The per-navigation route transition (design system §4).

## Why a `template`, not the layout

**Why:** A `template` re-mounts on every route change (a `layout` persists), so wrapping its
children in a Motion enter animation gives each page a gentle **fade + 8px slide** on
navigation. The wrapper is `flex-1 flex flex-col` so it transparently passes the body's flex
column through to each page's `flex-1` main (no layout break). Under reduced motion it renders
a plain `flex-1` wrapper — no animation.

```text
reduced motion -> <div flex-1 flex flex-col>{children}</div>
otherwise      -> <motion.div> fade in + slide up 8px, 150ms </motion.div>
```
