# Saved Elapsed (`SavedElapsed.tsx`)

The `M:SS` clock shown beside "Continue" on the hub banner and the play/daily menus.

## Why a component

**Why:** `useSavedGame` used to return `elapsedTime` as part of its slice. Every Experience
component calls that hook (for the Continue button and the "a new game erases your saved one"
warning), so each one re-rendered once a second while a game ran — taking the whole board
tree, the numpad and the cage overlay with it — to keep a label current that only exists on
the menu. Subscribing to the clock from this one leaf means a tick re-renders a single text
node, and only where the label is actually rendered.

```text
elapsedTime <- store
render formatElapsed(elapsedTime)
```
