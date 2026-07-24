# KenKen Types & Operator Model (`kenken-types.ts`)

The vocabulary layer for KenKen (Calcudoku / Mathdoku): the operator type, the cage shape, and
the two invariants the operator model enforces. Everything arithmetic (which multisets hit a
target) lives in [`kenken-combinations.ts`](./kenken-combinations.md); this file is the shared
type surface the rest of the KenKen engine builds on.

## What KenKen is (and how it differs from Killer)

An N×N **Latin square** — 1..N once per row and column, **no boxes** — partitioned into cages,
each showing a target and an operator (`+ − × ÷`). The defining divergence from Killer Sudoku: a
digit **may repeat within a cage** as long as the repeats don't share a row or column. That single
rule is why cage combinations are multisets (see the combinations doc) and drives the whole K1
slice.

## The operator model

### `KenKenOperator = 'add' | 'sub' | 'mul' | 'div'`

**Why named, not symbol-keyed:** `'add'` reads unambiguously and `'div'` never visually collides
with the `/` operator in code. Display glyphs (`+ − × ÷`) live in `OPERATOR_SYMBOL` and are a K5
labelling concern. No-Op / "Mystery" mode (operator hidden) is a deferred later slice, so it is
deliberately not a member here.

### Two invariants the model turns on

- **Subtraction/division are two-cell only.** Non-associativity makes a 3+-cell `−`/`÷` ambiguous
  (`6−(4−1)=3` but `(6−4)−1=1`). This engine adopts the Shortz/NYT + KSudoku convention: `−`/`÷`
  cages are always exactly two cells. `operatorAllowedForCageSize` encodes this; the combination
  tables enforce it by construction (empty for any other size).
- **Single-cell cages are givens.** A one-cell cage shows only its value — no operator. So no
  operator is "allowed" at size 1, and `hasAssignableOperator` treats a single-cell cage as always
  satisfiable (it needs no operator).

## Functions

### `computeTarget(op, digits)`

The inverse of the combination tables — used by generation (K2) to label a cage once its solution
digits are known.

```text
add → sum of digits
mul → product of digits
sub → larger − smaller   (exactly two digits; order-independent by the two-cell convention)
div → larger ÷ smaller   (exactly two digits)
sub/div with != 2 digits → throw (a caller assigned a two-cell-only operator to a wrong-size cage)
```

### `operatorAllowedForCageSize(op, size)`

```text
size < 2            → false   (a given — no operator cage)
op is sub or div    → size === 2   (two-cell only)
op is add or mul    → true    (any cage of 2+ cells)
```

### `hasAssignableOperator(activeOps, size)` — the K2 legality invariant

**Why:** the K2 operator assigner picks each cage's operator from the *active operator set* (a
difficulty axis). Every cage size present must have at least one assignable operator, or generation
silently wedges — a "sub only" or "div only" set is unsatisfiable for any cage of 3+ cells (those
need `add` or `mul`). This helper is the assertion that guards against that. Single-cell givens
need no operator, so they always pass.

## `KenKenCage`

`{ id, op, target, cells }` — cells are FLAT indices (`row * size + col`), the same convention as
Killer's `Cage`. A single-cell cage is a given (its `target` is the digit, `op` irrelevant). This
is the shape the solver, generator, and renderers (K2–K5) consume.

## Naming / trademark

"KenKen" is a trademark of KenKen Puzzle LLC, so it is used only *descriptively* in code and docs.
The user-facing product name (tentatively "MathCage") is a K5 surfacing decision; the engine
modules use the generic descriptive term `kenken` internally.
