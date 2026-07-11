# Vercel Config (`vercel.json`)

Deployment configuration for Vercel.

## Why it exists

**Why:** It registers the daily-puzzle **cron**. Vercel reads the `crons` array and calls
the given path on the given schedule; there is no other way to schedule the 00:00-UTC
generation job on this platform.

```text
crons:
  - path: /api/cron/daily     # the secret-guarded generation route
    schedule: "0 0 * * *"     # every day at 00:00 UTC
```

## Note

The route itself enforces auth via `CRON_SECRET` (see `src/app/api/cron/daily/route.md`).
Set `CRON_SECRET` in the Vercel project env so Vercel attaches the matching
`Authorization: Bearer …` header to each scheduled invocation. Cron schedules only fire on
production deployments.
