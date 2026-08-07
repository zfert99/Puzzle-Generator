# Puzzle Lab → Biscuit Lab: Should You Merge, and How

*(Commissioned research artifact, imported 2026-08-07. It answers the question raised after the
[cron outage](vercel-cron-deployment-protection-outage.md) — whether the multi-zone split still
earns its keep, and what merging would actually cost. The repo-side decision, reconciled against
measurements taken here, lives in
[multi-zone-cost-and-alternatives.md](multi-zone-cost-and-alternatives.md); read that first, this
second. Confidence tags — **[strong]** / **[moderate]** — are the researcher's own.)*

---

## TL;DR

- **Recommended end-state: option (a) — collapse Puzzle Lab into the Biscuit Lab app as a single Next.js app/repo, with `/puzzles/*` served by a literal route segment so URLs are unchanged and `basePath` is removed entirely — but do NOT do it this month.** A full single-app merge is the technically correct architecture and genuinely simplifies your setup (it kills the origin host, the grey-cloud DNS, the Deployment-Protection cron workaround, the `apiPath()` guardrail, and the entire multi-zone rewrite), and it is low-risk for auth and SEO. It also competes directly with job-hunt hours, and your own backlog says the portfolio is already "done enough."
- **Your two stated motivations are half-right.** "Make the structure easier" is real and is the actual prize. "Cut down on the redirect" is mostly a misconception: `/puzzles/*` is a **rewrite** (a server-side proxy, invisible to users and to Google, one small internal hop) — not the user-visible **301**. The only 301 is the legacy `puzzles.biscuitlab.net` subdomain, and that must stay regardless, to preserve link equity.
- **Auth and SEO survive a merge cleanly.** Passkeys are safe (rpID/origin are host-only and path-independent), sessions survive (`__Host-` cookie is `Path=/`), and URLs don't change so there's no ranking event. The real work is config hygiene, not migration danger. The highest-leverage move for your job hunt is the **blog post / interview story** — "I built a multi-zone setup, then made the honest case for tearing it down" — which is worth more than the infra change itself.

## Key Findings

### The decision, disambiguated

- **(a) Single Next.js app, one Vercel project, `/puzzles` as an ordinary route tree, `basePath` removed** — **RECOMMENDED end-state.** Maximally simplifies; removes every moving part that has bitten you.
- **(b) Monorepo, two apps, two Vercel projects, rewrite retained** — **NOT recommended for you.** Monorepo tooling (Turborepo/pnpm workspaces) exists to solve *multi-team coordination* and *code sharing at scale*. At n=1 with one shared design system, it adds config surface (workspace wiring, `turbo.json` env declarations, per-project root dirs, Ignored Build Step / `turbo-ignore`) while keeping the rewrite, the origin host, and the Deployment-Protection cron problem. You'd take on most of the cost of a merge and keep most of the cost of multi-zone. Vercel's own monorepo docs confirm that two projects in one repo each get their own domain and you "proxy requests to the other upstream projects" via `vercel.json` rewrites — i.e. (b) does not eliminate the rewrite.
- **(c) Status quo** — defensible. It works today. The costs are ongoing cognitive overhead and the standing guardrails (`apiPath()`, the two-sitemap split, the cron GitHub Action).
- **(d) Merge the other direction (hub as pages inside the Puzzle Lab app)** — viable and arguably the *least* work, since Puzzle Lab is the heavier app that already owns all the infra (auth, DB, KV, cron). The hub is "a minimal projects hub with a build log at `/log`." Folding those few static pages into the Puzzle Lab app and pointing the apex at it is less code movement than the reverse. Treat this as the concrete *implementation* of (a), not a separate option.

### Vercel / Next.js official guidance

- Next.js's multi-zones guide frames zones as a scaling-*down* tool. Verbatim: *"By moving those pages to a separate zone (i.e., a separate application), you can reduce the size of each application which improves build times and removes code that is only necessary for one of the zones. Since applications are decoupled, Multi-Zones also allows other applications on the domain to use their own choice of framework."* None of those rationales apply to a solo dev with one framework, one design system, and a small app. You have neither a build-time problem nor a team-independence problem, which are the two problems multi-zones solves. **[strong]**
- Next.js docs also note navigation *between* zones is a **hard navigation** (full page reload) while navigation *within* a zone is a soft navigation. Today every hub→puzzles transition is a hard navigation; a merge converts those to soft navigations — a small but real UX win. **[strong]**
- **Next.js 16 (current)** requires an explicit `images.qualities` allowlist. Verbatim from the v16 upgrade guide: *"The default value for images.qualities has changed from allowing all qualities to only [75]."* v16 also removed synchronous `params`/`cookies`/`headers`, removed AMP and `next lint`, made Turbopack the default for `dev` and `build` (custom webpack config now fails the build by default), and renamed `middleware.ts` → `proxy.ts`. These are upgrade concerns independent of the merge, but you'll touch config either way. **[strong]**

### Performance: is "cut down on the redirect" real?

- **Distinguish rewrite vs redirect.** `/puzzles/*` is a Next.js **rewrite** — a server-side proxy. The browser never sees it, Google never sees it, and there is no client-visible 3xx. Removing it eliminates **one internal hop** (Client → hub Edge → Puzzle Lab deployment → hub Edge → Client). Practitioner consensus is that each proxy hop adds latency and the advice is "only proxy what you must," but at portfolio traffic this is single-digit milliseconds of TTFB, not a Core Web Vitals issue. **[moderate — reasoned, not benchmarked on your deployment]**
- The **301** is a different thing: the host-scoped redirect from the legacy `puzzles.biscuitlab.net` subdomain. It must **stay** to preserve link equity and avoid dead inbound links. The literature brackets 301 link-equity loss between "essentially none" and ~15%: Google's Gary Illyes stated in 2016 that "30x redirects don't lose PageRank," and John Mueller has reaffirmed "we can forward PageRank through 301 and 302 redirects," while Moz's 2016 case study observed a ~15% organic-traffic drop after a 301 and Matt Cutts (2013) put retained equity at "approximately 85–99%." A merge does **not** remove this 301 and shouldn't. **[strong on "keep it," moderate on the exact %]**
- **Net:** "cut down on the redirect" as a *performance* motivation is a perceived win, not a measurable one. The rewrite hop is negligible at your scale, and the redirect you might be picturing isn't going away.

### Build / deploy blast radius

- One app = one build, one deploy, one function-bundle set. Vercel's first-party Hobby limits (as documented, checked mid-2026) are **6,000 build-execution minutes/month**, a **45-minute per-build cap**, one concurrent build, 100 deployments/day, and up to 200 projects — you are nowhere near any of these with either topology, so build minutes are not a real decision factor. **[strong on the figure; the draft's earlier concern about conflicting numbers resolves to this first-party figure]**
- A merge means the daily-puzzle-generation deploy and a hub-copy typo now share a blast radius. At n=1 this is fine (you control every commit) and is outweighed by having a single mental model.

### Technical risk resolution (the important part)

**better-auth / WebAuthn / passkeys — SAFE. [strong]**

- rpID is `biscuitlab.net` and WebAuthn `origin` is `https://biscuitlab.net` — both host/scheme-only, with **no path component** (WebAuthn origin per the W3C model is scheme+host only; the better-auth passkey plugin defaults `origin` to null and derives it from `baseURL` scheme+host). Changing the auth route path therefore does not touch either value, so **existing passkey credentials remain valid**. (Note: changing rpID at all would invalidate every passkey — Corbado, MojoAuth and others confirm "changing the RP ID invalidates all existing passkeys." You are not changing it, which is why the earlier decision to pin rpID to the apex before cutover pays off again here.)
- The session cookie is `Path=/` (host root), and the `__Host-` prefix *guarantees* `Path=/` and host-only (browsers reject a `__Host-` cookie that isn't `Secure`, `Domain`-less, and `Path=/`). A working `__Host-` cookie is definitionally sent on every path, so **existing sessions survive** the mount-path change — no forced re-login. (Confirmed against better-auth cookie source and a captured `Set-Cookie` showing `Path=/`.)
- **The one thing that must change:** once Next's `basePath` is removed, the basePath *stripping* stops, so the **server and client must agree on one literal auth path**. Today you have an asymmetry (server mounts `/api/auth`, client uses `/puzzles/api/auth`) that exists *only because* Next strips the prefix before the handler sees it. Two internally consistent options:
  - **Option A (recommended, simplest):** put auth under a route group — `app/(app)/api/auth/[...all]/route.ts` — so it mounts at the literal `/api/auth`. Server keeps default `basePath: '/api/auth'`; client uses `baseURL: 'https://biscuitlab.net'` with default basePath. Google redirect URI stays `https://biscuitlab.net/api/auth/callback/google` — **no Google Cloud Console change**, no `trustedOrigins` change (it's origin-scoped and already trusts `baseURL`).
  - **Option B:** literal folder `app/puzzles/api/auth/...` → mounts at `/puzzles/api/auth`; set server `basePath: '/puzzles/api/auth'` (or put the path in `baseURL`) and client to match; **must update the Google Authorized Redirect URI** to `https://biscuitlab.net/puzzles/api/auth/callback/google`.

- This is exactly the failure mode in **better-auth issue #4715**: under Next.js `basePath`, a dev set *both* server `baseURL` and client to the prefixed URL and got 404s on all auth routes, because Next strips the prefix before the handler. Removing basePath eliminates that trap — but only if you make server and client agree on the single literal path. (The 404→basePath-stripping root cause is [strong] from Next docs; the specific attribution to #4715's closed/locked thread is [moderate] inference.)
- **Choose Option A.** Zero Google Console changes, stable auth path, safest sequencing.

**basePath removal. [strong]**

- The `apiPath()` guardrail in `src/lib/base-path.ts` becomes a no-op once `basePath` is gone and paths are literal — but **keep it as a passthrough** (return the path unchanged) rather than deleting it, so you don't have to edit nine call sites in the same risky PR. Delete it in a later cleanup PR once stable. This decouples the dangerous change from the mechanical one.
- `metadataBase` changes from `https://biscuitlab.net/puzzles` to `https://biscuitlab.net`; self-referencing canonicals (`alternates: { canonical: './' }`) resolve relative to each route either way, but **verify the emitted absolute canonical URLs** after the change.
- `next/image`: under `basePath` you sometimes had to prepend the prefix in `src`; with literal paths this simplifies. Audit any hardcoded `/puzzles/...` asset paths.
- **URL preservation subtlety:** a parenthesized route group `(app)` does **not** appear in the URL. To keep user-facing URLs at `/puzzles/*` you need a *literal* `puzzles/` directory segment, not a group. Use a route group only for auth/layout isolation; use the literal `puzzles/` directory for the puzzle pages themselves.

**Cron / scheduled jobs. [strong]**

- Root cause of the earlier silent outage: Vercel Cron makes an HTTP GET to the *production deployment URL*, cron jobs **do not follow redirects** (a 3xx is treated as final), and redirected/cached invocations **aren't logged** — so Deployment Protection on the generated origin URL silently ate the daily generation.
- After a merge the app is served directly on `biscuitlab.net` with no separate protected origin, so you *could* return to Vercel Cron. But the GitHub Action calling the custom domain already works and is more observable (you get Action logs). **Keep the GitHub Action.** It isn't what the merge is meant to fix, and Vercel documents cron delivery as "best effort" (can miss or double-fire), so your generation should be idempotent regardless. If you ever move back to Vercel Cron, gate it with a `CRON_SECRET` bearer check and `export const dynamic = 'force-dynamic'`. (For the record: if you kept multi-zone, the modern fix would be Vercel's Protection Bypass for Automation via the `x-vercel-protection-bypass` header / `VERCEL_AUTOMATION_BYPASS_SECRET`, now available on all plans — but a merge makes that unnecessary.)

**SEO continuity — essentially no risk. [strong]**

- URLs stay `biscuitlab.net/puzzles/*`, so there is no URL migration and no ranking event. Canonicals stay self-referencing.
- The two-sitemap architecture (Option B in your plan) can collapse to one `app/sitemap.ts` in the merged app. The reason you split them (avoiding special-file collision across two apps) disappears when there's one app. A single sitemap is well within limits — Google Search Central: *"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs"* — and you index six curated pages. Keep advertising it via `robots.txt`.
- `noindex` on procedurally generated puzzle instances behaves identically post-merge and remains the correct hedge against Google's **scaled-content-abuse** policy. Verbatim from Google's Spam Policies: *"Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users… creating large amounts of unoriginal content that provides little to no value to users, no matter how it's created."* Keeping generated instances out of the index is exactly right; keep it.
- The legacy `puzzles.biscuitlab.net` 301 **stays**, and keeping `/signin` and `/account` as `noindex` (crawlable, not `robots.txt`-disallowed) remains correct.

**Deployment Protection / origin host — this is the cleanup prize. [strong]**

- `origin-puzzles.biscuitlab.net`, the grey-cloud DNS record, and Deployment Protection on the Puzzle Lab project all **go away entirely** in option (a). This is the single largest structural simplification and the strongest engineering argument for the merge.

**CI/CD, testing, branch protection. [moderate]**

- Merging your ~353 tests (incl. property-based generator tests) + Playwright + Vitest into one repo is mechanical. Vitest parallelizes across workers; in a bigger repo, watch `maxWorkers`/`poolOptions.forks` if memory spikes, but 353 tests is small and this is unlikely to bite.
- CodeQL / Dependabot / npm audit now scan one larger surface — strictly *simpler* to administer (one config, one branch-protection ruleset) than maintaining two.
- Playwright config merges; point the base URL at the single app.

**Design system. [strong]**

- Currently duplicated/diverged across two repos (hub "warm-baked" aesthetic vs. Puzzle Lab's full design system). A merge **deletes the duplication problem outright** — one copy, no shared-package indirection needed. At n=1, a shared workspace package is over-engineering; one app with a single `components/`/`styles/` tree is correct.

**Database / Drizzle — no impact. [strong]**

- Same Neon database, same Drizzle migrations, owned by the one app. Only caveat: if the hub ever gains its own tables, keep one migration folder and one `drizzle.config`. Today the hub has no DB, so there's nothing to do.

## Details: Recommended Runbook (option a, if/when you execute)

**Read this first — the two silent-failure classes that bit you before:**

1. **Path/prefix mismatches that 404 without throwing** (the `fetch()`/basePath regression). Mitigate by keeping `apiPath()` as a passthrough and doing a full click-through + Network-tab audit of every former call site.
2. **Scheduled work that fails silently** (the cron / Deployment-Protection outage). Do **not** touch cron in the merge; verify the GitHub Action still fires against the new setup *before* removing anything.

**Pre-flight (before any change):**

1. Confirm Next 16 and add an explicit `images.qualities` if you use non-75 qualities.
2. Full green CI on both repos; tag/branch both for rollback.
3. Inventory every hardcoded `/puzzles` string (assets, canonicals, OAuth redirect, sitemap, robots).
4. Record current Google OAuth redirect URIs and better-auth env values (`BETTER_AUTH_URL`, `PASSKEY_RP_ID`, callback URLs).

**Ordered sequence (each a small, independently shippable PR where possible):**

5. **PR1 — bring the code together** under a literal `app/puzzles/` tree in the surviving repo, keeping `basePath` temporarily. Deploy to a preview; verify puzzle pages render. *Reversible: delete branch.*
6. **PR2 (the risky one — ship alone) — remove `basePath`; move auth to Option A (route group mounting `/api/auth`); update `metadataBase`; make `apiPath()` a passthrough.** Verify: passkey register+login round-trip, Google OAuth round-trip, email/password, the nine former `fetch` call sites, `next/image` assets. *Reversible in <10 min* (revert PR, re-add `basePath`, revert `BETTER_AUTH_URL`) — mirrors your original migration's rollback.
7. **PR3 — collapse the two sitemaps into one `app/sitemap.ts`;** keep the `robots.txt` pointer; keep generated-instance `noindex`. Verify via Search Console URL inspection. *Reversible.*
8. **PR4 — point apex `biscuitlab.net` at the merged project; keep the `puzzles.biscuitlab.net` → apex 301; remove the hub→origin rewrite.** Verify no redirect loops. *Reversible via DNS/rewrite revert.*
9. **PR5 (cleanup, after a stable week) — delete the Puzzle Lab Vercel project, `origin-puzzles.biscuitlab.net` DNS, its Deployment Protection config, and finally the `apiPath()` helper + call sites.** *Least reversible; do last.*

**Effort estimate (solo):** ~1–2 focused days for PR1–PR4, plus a stabilization week before PR5 — realistically **8–14 hours** of hands-on work, with the auth PR carrying roughly half the risk and deserving its own careful session.

## Recommendations

1. **Do not start this now.** Your backlog explicitly ranks the job hunt at ~70% of hours, calls Puzzle Lab a portfolio piece that's "done enough," and names "planning as the activity" and scope creep as recurring failure modes. This merge fixes no user-facing problem and clears no portfolio bar you haven't already cleared. It is precisely the category of attractive-feeling maintenance work your own notes warn you about.
2. **Do write the blog post now.** The highest-leverage move is the *narrative*: "Why I built a multi-zone Next.js setup — and the honest case for tearing it back down." You already convert infra war stories into portfolio writing (the basePath `fetch()` regression). A piece that walks through multi-zone vs single-app trade-offs, the passkey/rpID reasoning, the cron/Deployment-Protection postmortem, and lands on a *decision with thresholds* is directly aligned with Learning Experience Designer / Technical Curriculum Developer / Developer Educator roles — it demonstrates the exact skill those jobs test. This captures the bulk of the interview value for a fraction of the effort.
3. **If a genuine lull appears** (e.g. waiting on interview loops), execute option (a) via the runbook and fold the execution into the post as an "…and then I did it" follow-up, converting the work itself into more content.
4. **If you touch it at all, do (a), not (b).** The monorepo/two-project middle ground keeps the very costs you're trying to shed.
5. **Never remove the `puzzles.biscuitlab.net` 301, and never touch the cron during the merge.**

**What would change this recommendation:**

- Puzzle Lab becomes a **product** (real users / monetization) → the single-app simplification becomes worth prioritizing, and you'd also need to leave Vercel Hobby (its Fair Use Guidelines restrict Hobby to "non-commercial personal use only").
- Two-repo overhead starts **actively costing interview-prep time** (e.g. you keep re-fixing design-system divergence) → merge sooner.
- A **specific interview** asks "show me a recent architecture decision" → do the merge deliberately as the answer.
- You add a **second app** under `biscuitlab.net` → revisit (b); at n=2+ apps a shared workspace package starts earning its keep.

## Caveats

- **Core auth claims are [strong]:** better-auth session cookie `Path=/`, `__Host-` implying `Path=/`, and WebAuthn origin/rpID being path-independent are confirmed from better-auth source/docs and the W3C WebAuthn model. The exact line-level rpID-from-hostname derivation was corroborated via docs plus a third-party reimplementation rather than a directly fetched `routes.ts`, so treat that single sub-point as **[moderate]**.
- **better-auth issue #4715** documents the 404 symptom and config, but was closed/locked without a captured maintainer resolution; the root-cause (Next strips `basePath` before the handler) is **[strong]** from Next.js docs, while the specific link *to #4715* is **[moderate]** inference.
- **Performance claims are [moderate]:** "the extra hop adds a few ms" is practitioner consensus and first-principles reasoning, not a benchmark of your specific deployment. I found no primary benchmark isolating Next.js rewrite-hop latency; treat "negligible at your scale" as reasoned, not measured. The 301 link-equity range (0–15%) is bracketed by named but partly conflicting sources (Illyes/Mueller vs. Moz/Cutts).
- **Vercel Hobby build limits** resolve to the first-party figure of **6,000 build-execution minutes/month** and a **45-minute per-build cap**; some secondary sources cite lower or "no published" figures. Irrelevant to the recommendation (you're far from any cap), but flagged. **[strong on first-party figure]**
- **Next.js 16 specifics** (`images.qualities`, `proxy.ts` rename, removed sync APIs) are **[strong]** from official upgrade docs, but whether each affects *you* depends on your exact config, which I haven't inspected.
- The **opportunity-cost framing** is a judgment call built on your stated priorities, not an empirical claim — but it's the one I'd weight most heavily.
