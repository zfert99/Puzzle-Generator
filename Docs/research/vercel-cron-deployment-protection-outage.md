# Incident: Deployment Protection silently killed the daily cron (2026-08-07)

**Status:** ✅ Resolved — daily generation moved to a scheduled GitHub Action. Recorded per the
Roadblock & Research Rules, because the failure was *invisible* and the next person to enable a
protection setting deserves to find this.

## What happened

`2026-08-07` had **zero** daily boards. `/daily` served "No daily puzzle for 2026-08-07 yet" to
every visitor for ~13.5 hours, until the missing boards were noticed by hand and generated with
`npm run db:seed`.

Nothing alerted. Nothing errored. There was no failed cron run to look at, because there was no
cron run at all.

## The cause

Vercel invokes a cron by making an HTTP GET to the project's **generated production URL**
(`*.vercel.app`) — not to a custom domain. Enabling Deployment Protection restricts exactly that
URL. Vercel's own wording:

> "When you enable Standard Protection, the production generated deployment URL becomes restricted."

The protected URL answers with a `302` to `vercel.com/sso-api`. And:

> "Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx redirect status
> code, the job completes without further requests."
>
> "when cron jobs respond with a redirect or a cached response, **they will not be shown in the
> logs**."

So the invocation was refused before reaching the route, and the refusal was not logged. Both
halves matter: the first broke generation, the second hid it.

## The evidence

Runtime logs filtered to `requestPath:/puzzles/api/cron/daily`, over three days:

| UTC | Status | Domain |
|---|---|---|
| 2026-08-05 00:53:59 | **200** | `puzzle-generator-…vercel.app` |
| 2026-08-06 00:54:24 | **200** | `puzzle-generator-…vercel.app` |
| 2026-08-07 00:00–00:59 | — | **no invocation at all** |

Two things fall out of that table. Every *successful* run arrived on the generated
`*.vercel.app` domain, which is the direct proof of which URL Vercel uses. And the 7th has no entry
whatsoever — not a 401, not a 500 — which is the documented signature of a redirected invocation
rather than a failed one.

Probing the endpoint by hand separated "route broken" from "route unreachable":

| Entry point | Result |
|---|---|
| `origin-puzzles.biscuitlab.net/puzzles/api/cron/daily` | `401` — reachable, guard working |
| `biscuitlab.net/puzzles/api/cron/daily` | `401` — same |
| generated `*.vercel.app` alias | `302` → `vercel.com/sso-api` |

The runs at ~00:54 rather than 00:00 are unrelated and expected: Hobby-plan crons are spread across
the scheduled hour.

**Ruled out.** A `CRON_SECRET` mismatch — every `401` in the log window was a hand probe, not a
scheduled run. A transient delivery failure — possible for one night, but it does not explain the
`302` that is reproducible on demand.

## Why this was hard to see coming

Re-enabling Deployment Protection was **mitigation #1** of
[multi-zone-migration-safety-review.md](multi-zone-migration-safety-review.md) — a deliberate,
correct security improvement, and it was reported as a win the day before the outage. Nothing in
that review connected it to the cron, and the hub's `next.config.ts` comment explicitly notes the
generated alias "stays locked" as the intended outcome. The dependency ran the other way: locking
the alias was the goal, and the cron happened to be standing on it.

## The fix, and the options rejected

**Chosen: a scheduled GitHub Action calling the custom domain**
([`.github/workflows/daily-puzzles.yml`](../../.github/workflows/daily-puzzles.yml)). Custom
production domains are exempt from Standard Protection, so protection stays exactly as configured.
Authorization is unchanged — the endpoint's constant-time `CRON_SECRET` check was always the real
guard, never the caller's identity. The workflow adds two things the Vercel cron never had: a
`workflow_dispatch` trigger for recovering a missed night without hand-seeding, and a post-run
assertion that the day actually *has* boards, which is the check that would have caught this.

| Rejected | Why |
|---|---|
| Protection Bypass for Automation | `vercel.json` takes a path, not headers, so the bypass secret must ride in a query string — committed to a **public** repo, and permanent in git history |
| Deployment Protection Exceptions | Pro + the $150/month Advanced Deployment Protection add-on |
| Loosen protection to "(Legacy) Pre-Production Deployments" | Would work, but re-exposes every past production deployment — old code, still pointed at the **current** database, so fixed bugs stay reachable at their old URLs |
| Make the repo private | Doesn't touch the cause, and costs CodeQL: code scanning is free only on public repos for Free/Pro accounts |

## Lessons

**A scheduler that can fail silently needs an assertion, not just a status code.** The endpoint was
healthy the whole time; what was missing was anything checking that the day had boards. The new
workflow checks the outcome, not the call.

**When you close a security gap, ask what was reaching through it.** The protection change was
right and stays. The miss was not auditing what depended on the generated URL being reachable —
and the answer was written down in a research doc a week earlier, in a sentence about crons using
the generated URL rather than the custom domain.
