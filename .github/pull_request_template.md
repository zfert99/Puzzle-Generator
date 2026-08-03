<!-- markdownlint-disable-file MD041 -- an H1 here would render as a heading in every PR body -->

## What & why

<!-- One or two sentences. Link the plan/slice this belongs to. -->

## Pre-merge self-review

<!-- Tick what you actually checked. Strike through (~~like this~~) anything that doesn't apply,
     rather than leaving it ambiguous. Tests, types and CI own mechanical defect-finding; these
     boxes are for the judgment they can't do. -->

- [ ] **Correctness:** I re-derived the core logic; edge cases considered
- [ ] **Trust boundaries:** new endpoints/actions do authorize → validate (Zod) → mutate
- [ ] **Authorization:** ownership enforced in the query (`WHERE user_id = …`), not after the fetch
- [ ] **AI-generated logic** flagged and verified — explain-back done for the risky parts
- [ ] **New dependencies** confirmed to exist and be reputable *before* install (slopsquatting)
- [ ] **No secrets** committed, and none captured in Server Action closures
- [ ] **Tests** added/updated, and not weakened in the same commit as the code they cover
- [ ] **Migration** (if any): generated SQL read by hand — Drizzle emits a bare
      `ADD COLUMN … NOT NULL`, which fails on a populated table; reverse SQL written; additive-only
      until cutover

## Docs (same PR — never a follow-up)

- [ ] Mirrored `.md` updated for every `.ts`/`.tsx` touched
- [ ] **Reverse-reference sweep** — grepped the repo for every symbol renamed/removed and every
      design superseded, including plan docs that "anticipate" what this builds. Mirroring cannot
      catch a doc whose source you never edited
- [ ] `Docs/roadmap.md` + `README.md` status table, if a phase's scope or status changed
- [ ] Living plan doc's step-log appended (process / learnings / blockers)
- [ ] `Docs/research/*.md` record for any roadblock or plan divergence
- [ ] `npx markdownlint-cli` clean on every doc changed

## Verification

<!-- Paste real output. "Tests pass" without numbers is not evidence. -->

- [ ] `npx vitest run` — <!-- N passed -->
- [ ] `npm run lint`
- [ ] `npm run build` — **eslint does not type-check**; a widened union can pass lint and still
      break the production build
- [ ] Benchmarks, if solver/generator core changed (`benchmark-human-solver` / `-calc` / `-killer`),
      reviewed against the tier targets
- [ ] Ran the thing end-to-end where it's observable — rendering bugs don't fail a test suite

## Size

- [ ] Diff is < ~400 LOC — **or** state below why it can't be split
      <!-- e.g. an atomic cutover: readers and writers must change together or the app breaks -->

## Review

- [ ] `/security-review` run (required for auth/authz/data-access changes)
- [ ] `/code-review` — **user-triggered and billed; an agent cannot run it.** If an agent prepared
      this PR, it should have said so explicitly rather than implying this was done
