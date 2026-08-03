---
description: Run the AGENTS.md pre-merge gate on the working diff — mechanical checks plus this project's own invariants.
---

# Pre-merge gate

Run the pre-merge gate from `AGENTS.md` against the current diff (`git diff main...HEAD`, or the
working tree if nothing is committed yet). Report findings; do not merge.

Deliberately short. Generic reviewers already find null derefs and injection; the point of this
command is to aim attention at the handful of places *this* codebase actually breaks. Adding more
lines here makes it worse, not better.

## 1. Mechanical (run them, paste real numbers)

```bash
npx vitest run && npm run lint && npm run build
```

`npm run build` is not redundant with lint — **eslint does not type-check**. A widened union has
already passed lint here and broken the production build.

If `human-solver.ts`, `sudoku.ts`, or any solver/generator core changed, run the matching benchmark
and compare to the tier targets in `AGENTS.md` §3. If nothing solver-side changed, say so and skip.

## 2. Where this project actually breaks

Check only what the diff touches:

- **A slot key is not an identity.** Under type-as-slot, a key like `hard` holds a different *type*
  each day, and `mini-hard` also rolls its *size*. Any cross-date aggregate must group by **every
  axis the slot rolls** — `(key, variant, size)`. Grouping by fewer silently collapses two different
  boards and the faster one wins. This has now been the bug twice.
- **Randomised inputs void `ON CONFLICT DO NOTHING`.** It dedupes identical *keys*, which is only
  idempotency while the key set is deterministic. Generation guards the date explicitly. Any new
  retry-safe write needs the same reasoning spelled out.
- **Retired keys stay readable.** `killer-*`, `calc*`, `mini4-*`, `mini6-*`, `killer6-*` and legacy
  `killer` are never generated again but must still validate, resolve a rung, and replay from the
  archive.
- **Ownership lives in the query.** `WHERE user_id = …` from the session — never a `userId` from the
  request, never filtered in application code after a broad fetch.
- **Migrations:** read the generated SQL by hand. Drizzle emits a bare `ADD COLUMN … NOT NULL`,
  which fails on a populated table; the safe shape is add-nullable → backfill → `SET NOT NULL`,
  where the constraint doubles as the exhaustiveness assertion.
- **Anything AI-wrote that looks plausible.** Re-derive it. The failure mode is plausible-but-wrong,
  not obviously broken.

## 3. Docs

Mirrored `.md` for every `.ts`/`.tsx` touched, **plus the reverse-reference sweep** — grep the repo
for every symbol renamed/removed and every design superseded, including plan docs that "anticipate"
what this PR builds. Mirroring structurally cannot catch a doc whose source you never edited; that
is how three stale docs shipped once already.

Leave genuinely historical records alone (`Docs/archive/*`, dated roadmap entries, completed
walkthroughs). If such a doc names something now gone, add a dated **Superseded** note rather than
rewriting it.

```bash
npx markdownlint-cli "**/*.md"
```

## 4. Report

Findings first, most severe first, each with a file:line and a concrete failure case — inputs or
state, and the wrong output that results. Separate what you verified from what you only read.

Then close with, explicitly:

- whether `/security-review` was run (required for any auth/authz/data-access change — you *can*
  run this one), and
- that **`/code-review` has NOT been run, because it is user-triggered and billed and you cannot
  launch it.** Say this outright every time. Never imply the hosted review happened.

Do not merge. Leave that to the owner.
