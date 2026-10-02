# Skyscrapers entry point (`skyscrapers.ts`)

`generateSkyscrapers(difficulty, { gridSize, timeBudgetMs })` — what `/api/puzzle` calls, the
counterpart of `generateKakuro`. Plan slice **E4** (October 2026) ships it in its first form; E5
gives it the Kakuro E5 shape (the classifier in the objective, a puzzle at *exactly* the
requested tier, per-size tier sets). It exists now so the serving policy lives in the engine and
the route stays a controller (AGENTS.md §1 — the E4 review's finding), and so the daily roller
(R1) and the print route (E5) call one function rather than copy four numbers.

## What it promises (E4)

A fresh, unique Skyscrapers **no harder than the request** — the clue removal is bounded by the
requested tier, so a hard request never serves expert, but may serve medium; the label is the
classifier's own (D7). When the size has no square at or below the requested tier (E3: an easy
7×7 floor is one square in fifty), the request is still served: **unbounded**, labelled as what
it is, and flagged `fallback: true` for the route's log. It throws only when both attempts run
out of budget — 0 in 100 per size and level in the gate run — so a throw is a fault, not a path
the route expects.

```text
generateSkyscrapers(level, { gridSize = 6, rng, timeBudgetMs = 8 000 }):
    bounded   = generateUniqueSkyscrapers({ targetTier: tierOf(level), maxRounds 40,
                                            maxFloorMisses 12, budget ¾ of the total })
    bounded   → { …bounded, fallback: false }
    unbounded = generateUniqueSkyscrapers({ budget: what is left })
    unbounded → { …unbounded, fallback: true }
    neither   → throw
```

**Why 12 floor misses:** removal only moves a puzzle up the ladder, so a square whose fully clued
floor is above the target is a dead end known after one classify (L17). At 6×6 one square in four
has an easy floor, so twelve misses is a 3% fallback rate; at 7×7 easy is one in fifty, so the
bounded attempt spends its misses (≈ 3 s) and the fallback serves whatever comes — the per-size
tier-set question E5 answers (offer easy at 7×7 or lock it, as the mini sizes lock expert/extreme
elsewhere; L19).

## Measured (E4 gate run, 100 per level at 5 and 6, 60 at 7)

See `skyscrapers-generator.md`: 0 failures everywhere; mean 7–10 ms at 5×5, 34–51 ms at 6×6,
391–782 ms at 7×7 for medium–extreme, 3.5 s for 7×7 easy with 45/60 fallbacks.
