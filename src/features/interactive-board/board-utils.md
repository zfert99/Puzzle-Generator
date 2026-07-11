# Board Utilities: Plain English Pseudocode

Pure helpers for the interactive board — peer geometry and pencil-mark bitmask ops.
Kept separate from the store so they can be unit-tested in isolation.

## `computePeers(config)`

**Why:** placing a digit must strip it from every cell that shares a row, column, or
box with the placed cell. Recomputing that peer set on every keystroke is wasteful, so
we precompute it once per game into an index → peer-indices table — an O(1) lookup
during play (research §4.3).

```text
FOR each cell (r, c):
  collect all other cells in the same row,
  all other cells in the same column,
  and all other cells in the same box (derived from config.boxWidth/boxHeight);
  store that de-duplicated set (as flat indices) at index r*size + c.
```

## Bitmask helpers

Pencil marks are stored as one integer per cell (bit `digit-1` set = candidate shown).

```text
toggleBit(mask, digit)  -> flip bit (digit-1)
hasBit(mask, digit)     -> is bit (digit-1) set?
maskToDigits(mask)      -> ascending array of the digits set in the mask
```
