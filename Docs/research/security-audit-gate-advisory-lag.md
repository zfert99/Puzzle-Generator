# Roadblock: the `security-audit` gate went red twice in one fix (2026-09-30)

**Status:** ✅ Resolved on `fix/undici-next-cves` — `undici` 8.10.0 → 8.11.2 and `next` 16.3.4 → 16.3.8,
plus a daily scheduled `security-audit` run on main. Recorded per the Roadblock & Research Rules
because the plan ("bump undici, gate goes green") was contradicted mid-build. The run itself is in
[pre-merge-log.md](../pre-merge-log.md) (2026-09-30 entry).

**Why this stays in `research/` rather than `archive/`:** the incident is closed, but "What to
carry forward" is reference material that outlives it — how `--omit=dev` treats `devOptional`
packages and how far `npm audit` can trail the advisory database — and the `schedule:` trigger in
[`ci.yml`](../../.github/workflows/ci.yml) cites this doc as its rationale. Per the
[Docs index](../README.md), a roadblock record stays here while live config cites it.

## What we planned

PR #104 (`feature/kakuro`, no dependency changes) failed the `security-audit` job in
[`ci.yml`](../../.github/workflows/ci.yml) — `npm audit --audit-level=high --omit=dev`. Eleven
`undici` advisories had landed since main last ran CI (2026-09-11). The brief: on a fresh branch,
get `undici` to ≥ 8.10.2 with a lockfile-only bump, touch nothing else, and confirm the audit exits 0.

## What actually happened

| Time (UTC, 2026-09-30) | Event |
|---|---|
| 14:48:30 | GitHub publishes GHSA-vcvr-r3jv-pc5j — `next` ≥ 16.2.0 < 16.3.6, **critical**, RCE in `next/og` `ImageResponse`. Main locks `next@16.3.4`. |
| 16:07 | `next@16.3.8` published to npm (release notes name seven further advisories, one **high**). |
| ≈ 16:15–16:20 (not timestamped) | Audit on main's lockfile: `undici` high, **no `next` finding**. `undici` bumped; audit **exit 0**, "10 moderate". |
| 16:21:50 | Same lockfile, same command: **exit 1** — `next` critical. |
| 16:26 | After `next` → 16.3.8: exit 0. Still exit 0 at 17:06. |

So the undici fix was correct and complete, and the gate was red anyway.

## Why the plan did not hold

Three separate assumptions were wrong.

1. **"jsdom is under `dependencies`, which is why `--omit=dev` flags it."** It is under
   `devDependencies`. The lockfile marks `jsdom` and `undici` **`devOptional`**, not `dev`, because
   `better-auth` (a production dependency) declares an optional peer on `vitest`, and `vitest`
   declares an optional peer on `jsdom` (`npm explain jsdom`). `--omit=dev` drops only packages
   flagged `dev`. Consequence: **the production audit covers the whole vitest/jsdom toolchain**, and
   moving a package between `dependencies` and `devDependencies` does not change that.
2. **"A clean audit means no known advisory applies."** The first clean run came roughly 90 minutes
   *after* the `next` advisory was public. `npm audit` answered clean, then flagged it minutes later
   with an identical lockfile. The cause was **not established** — registry-side propagation from
   GitHub's database to npm's advisory endpoint is the likely one; a client-side cache was not ruled
   out. Either way an `npm audit` exit 0 can trail the GitHub advisory database by over an hour.
3. **"One advisory, one fix."** The gate is a single job over the whole production tree. Fixing
   `undici` in one PR and `next` in another would have left both PRs red; they had to land together.

## Options considered

- **Undici only, as briefed.** Smallest diff, but the branch could not meet its own exit criterion.
- **Merge Dependabot #103 instead.** It carries `undici@8.10.2`, but pins `next@16.3.5`, inside the
  critical range. Its green checks date from 2026-09-25, before any of these advisories; auditing
  its lockfile on 09-30 exits 1. Rejected.
- **`next` lockfile-only, floors untouched.** Worked, but left the patched minimum recorded nowhere
  but the lockfile and `eslint-config-next` four patches behind `next`. Code review flagged both.
- **`next` + raised floors (chosen, owner-approved).** `next: ^16.3.8`, `eslint-config-next: 16.3.8`,
  matching how the 2026-09-10 next fix was done.

`next` went to 16.3.8 rather than the minimum patched 16.3.6 because 16.3.8's release notes list
seven more security fixes (one high — SSRF in Image Optimization, GHSA-cjq9-62q9-8jv4 — five
medium, one low). That advisory was **not yet in GitHub's global database** shortly after 17:00 UTC
(the API returned 404), so its affected range is unknown — stopping at 16.3.6 risked a third red
gate as soon as it is published.

## What to carry forward

- **Read the lockfile flag before reasoning about `--omit=dev`.** `devOptional` stays in scope.
- **Treat an audit result as timestamped.** Re-run it last, and when a security release is fresh,
  read the release notes too — they can name advisories the audit does not know about yet.
- **`npm update` / `npm install` on macOS (npm 11.8.0) strips the `libc` field** from the four
  `@node-rs/argon2-linux-*` lockfile entries every time. It happened on all three installs here and
  was reverted each time. Diff the lockfile and keep only the hunks you meant.
- **A Dependabot PR's green checks are as old as its last CI run.**

## Resolved in the same PR

- **`security-audit` now also runs daily against main** (`ci.yml`, `schedule: "23 6 * * *"`; the
  build/test and e2e jobs are gated off the schedule — main's code has not changed, only the
  advisory data). Before this, a new advisory surfaced as a red check on whichever unrelated PR ran
  CI next — here, 19 days after main's last run. Code review asked for the root-cause fix rather
  than the open question it was first recorded as.

## Open questions

Not answered here; neither blocks this fix. Both are tracked in
[roadmap.md](../roadmap.md) under "Security Hardening, Stage 1+".

1. **Is the `libc` stripping an npm bug or a lockfile written by a different npm major?** Until it
   is pinned down, every local install produces a four-hunk diff someone has to notice and revert.
2. **What was the ~90-minute gap?** Registry propagation or local cache — worth one measurement the
   next time an advisory is published against a package we lock.
