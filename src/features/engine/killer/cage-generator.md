# Cage Generator (`cage-generator.ts`)

Partitions a solved grid into connected cages by randomized **region growing** — the KDE
KSudoku approach. Produces a valid partition only; it does **not** guarantee a unique solution
(that's the K5 pipeline's job, which gates each layout through the exact solver).

## How it grows

Think spilled ink. For each unassigned cell in scan order (which guarantees every cell is
eventually covered and the loop terminates), we seed a cage and annex **random** eligible
neighbours until it reaches a random target size:

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

## Not yet here (K3 refinements)

- **`maxCombos` / singles bounds** — finer difficulty levers (fewer allowed combinations = more
  constrained = easier; 1-cell cages act as givens, so their count is capped). Layered in when
  K4/K5 need difficulty tuning.
- **Symmetry** — an off-by-default aesthetic pass (rotational cage layout); costs generation
  attempts, doesn't affect difficulty.
