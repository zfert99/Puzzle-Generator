# Cage Generator (`cage-generator.ts`)

Partitions a solved grid into connected cages by randomized **region growing** — the KDE
KSudoku approach. Produces a valid partition only; it does **not** guarantee a unique solution
(that's the K5 pipeline's job, which gates each layout through the exact solver).

## How it grows

Think spilled ink. For each unassigned cell in scan order (which guarantees every cell is
eventually covered and the loop terminates), we seed a cage and annex **random** eligible
neighbours until it reaches a random target size drawn from `[minSize, maxSize]`:

- **Eligible** = unassigned AND its solution digit isn't already in the cage. Enforcing
  no-repeat *during growth* means the finished cage satisfies the no-repeat invariant by
  construction — no cleanup pass needed.
- Random neighbour choice gives organic, irregular shapes; scan-order seeding keeps it simple
  and terminating. The same `orthogonalNeighbors` helper as `isCageConnected` (K1) — generation
  builds connectivity, validation confirms it.

Each cage's target sum is just the total of the solution digits it covers.

## Why the RNG is injectable

`options.rng` defaults to `Math.random` but can be a seeded PRNG, which is what makes the tests
deterministic — and lets us **fuzz**: generate 50+ random layouts and assert every one is a
valid partition via the K1 `validateKillerCages`. Because generation is RNG-driven, it must run
client-side, never during SSR (AGENTS.md §1 hydration rule).

## Why `maxSize` defaults to 4 (a measured choice)

Cage size is the main performance lever on the *solver*, not just an aesthetic. Profiling the
exact solver over generated layouts showed maxSize ≤ 4 verifies in < 10 ms, while maxSize 5 can
occasionally explode to seconds (large loose cages under-prune — see `killer-solver.md`). So the
default is **4**: a standard published cage cap that keeps verification cheap. Difficulty is
tuned by cage *structure*, not by maximising size.

## Why `minSize` exists (the biggest difficulty lever)

Single-cell cages are **givens** — a sum over one cell just tells you the digit. The difficulty
research (`Docs/research/`) identifies single-cage count as the strongest of the four cage
levers, and the original `1 + floor(rng() * maxSize)` draw over-produced them (~52% of cages at
maxSize 2). `minSize: 2` shifts the target-size draw to `[2, maxSize]`, suppressing *intentional*
singles for medium/hard. A few **forced** singles can still occur when a growing cage boxes a
cell in — the pipeline's per-difficulty `maxSingles` gate (K5) rejects partitions where that
happens too often, rather than this generator trying to guarantee it.

## Why `maxSizeBias` exists (but nothing uses it yet)

The difficulty research's "2-cell cage count" lever (too many small cages = too constrained =
easy) applied at the DRAW: with probability `maxSizeBias` the target size is `maxSize` instead
of a uniform pick, so harder tiers can get bigger-cage-heavy partitions without
rejection-sampling a rare tail. Measured outcome: the lever *works structurally* (bias 0.3
drops 2-cell cages from ~17 to ~15.5 per grid) but is **unusable until the logical solver
grows more Killer techniques** — the tier-3-solvable rate collapses from ~10% to ~1% → 0% as
2-cell cages thin out, because the current technique set gets its traction from tight 2-cell
cages. It stays as the ready-made knob for the expert tier.

## Not yet here (K3 refinements)

- **Symmetry** — an off-by-default aesthetic pass (rotational cage layout); costs generation
  attempts, doesn't affect difficulty.
