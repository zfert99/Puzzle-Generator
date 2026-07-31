# Daily Slot Display (`slot-display.ts`)

The shared shape (`DailySlotInfo`) and label helper (`slotLabel`) for a day's daily boards, used by
both the `/daily` picker and the leaderboard tabs.

## Why this exists

Under the **type-as-slot** model the puzzle TYPE is rolled per day and stored on the row, so a slot
key no longer tells you what a board is: `hard` is Classic one day and Killer the next. A pill
labelled just "hard" would be genuinely ambiguous — the player couldn't tell what they were about to
play. So a slot is labelled from its `(difficulty, variant, size)` instead:

```text
standard -> "Hard · Killer"
mini     -> "Easy 4×4 · Keisan"     (size shown, since minis vary 4×4 / 6×6)
```

**Why a shared module rather than a helper in each component:** the picker and the leaderboard tabs
must agree exactly — a board labelled "Hard · Killer" on `/daily` has to read the same on
`/leaderboard`, or the player can't tell they're looking at the same board. One function, two
callers.

This deliberately does **not** live in `daily-row.ts` (`formatDailyKey`), because that function
formats a key *alone* — for saved-game banners, personal bests, and archived rows, where no
variant context is available. Composing difficulty + type needs the row's stored `variant`, which
only the fetched slot list carries.

The `Variant → display name` map is where the internal slug/display-name split is honoured:
`calc` renders as **Keisan** (the product name), never as "calc".
