# DifficultyConfigurator: Plain English Pseudocode

This document explains `DifficultyConfigurator.tsx`, the presentational component
that lets the user choose how many puzzles of each difficulty to generate.

## Why this file exists

Extracted from `PuzzleForm` to keep that parent composable (AGENTS.md Section 1).
It is a controlled component — the parent owns the `counts` state and this
component only renders inputs and reports changes.

## Why difficulty availability depends on grid size

Expert and Extreme puzzles are only defined for 9x9 grids (the mini 4x4/6x6 grids
do not have enough room for those elite strategies). Rather than hide the
unavailable rows — which would make the form jump around as the grid size changes
— the component always renders all five difficulty rows and visually **disables**
the ones that do not apply to the current grid size.

## The optional `difficulties` override

Callers can pass a `difficulties` array to override the grid-size-based availability — e.g.
Killer mode passes `['easy','medium','hard']` so Expert/Extreme render disabled regardless of
grid size. When omitted, availability falls back to the grid-size lookup (classic behaviour).

## What it does

1. Use the `difficulties` prop if given, else look up which difficulties are available for the
   current `gridSize` from a lookup table (4 and 6 -> easy/medium/hard; 9 -> all five).
2. Render a row for every difficulty (easy, medium, hard, expert, extreme):
   - Determine whether the row is disabled (not in the available set).
   - Disabled rows render at 40% opacity, forced to a value of 0, and cannot be
     edited.
   - Enabled rows render a numeric input (0-50) bound to `counts[difficulty]`,
     reporting edits via `onChange`.
3. Show a helper line noting the 1-50 total-per-request limit.
4. When the grid is not 9x9, show a note that Expert/Extreme are 9x9-only.
5. When a slow tier is requested, show a red **slow-generation warning tailored to the variant +
   selected tiers + Mystery mode** (`slowGenerationWarning`). The time ranges come from measured 9×9
   generation:
   - **Classic** — Extreme only (elite-tier strategies W-Wing/ALS/AICs, ~5 s each). Expert is fast, no
     warning.
   - **Killer** — Expert/Extreme use advanced strategies, several seconds each (Extreme up to ~10 s).
   - **Keisan** — Expert needs a hypothesis (Nishio) step (~1–4 s); Extreme needs many (~2–5 s).
   - **Keisan + Mystery** — hiding the operators makes unique boards rare (the union table is ~4×
     bigger), so it's much slower: Expert ~5–15 s, **Extreme ~15–30 s and occasionally up to a
     minute**. This is the case the warning most needs to set expectations for.

## Note

The 0-50 range and "at least one puzzle" rules are enforced here for fast UX
feedback, but the server (`/api/generate`) re-validates them authoritatively —
client-side checks are a convenience, never the security boundary.
