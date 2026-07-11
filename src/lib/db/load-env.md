# Env Loader (`load-env.ts`)

A tiny side-effect module for standalone Node scripts (seed, one-off DB tooling) run via
`tsx`.

## Why a dedicated module instead of an inline `config()` call

**Why:** ES module imports are hoisted and evaluated in source order — so a plain
`config({ path })` statement in a script runs *after* every `import` on the same file has
already been evaluated. Any imported module that reads `DATABASE_URL` at load time would
therefore see it unset. Making env-loading its own module and importing it **first** as a
side effect guarantees the vars are populated before any DB code is imported.

```text
Load environment variables, preferring `.env.local` (Next convention, git-ignored),
falling back to `.env`. Never override a var already present in the process env.
```

## Note

The Next.js app never imports this — Next loads `.env.local` natively. It exists purely
for scripts that run outside the framework.
