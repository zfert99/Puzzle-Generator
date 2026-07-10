# Logger: Plain English Pseudocode

This document explains `logger.ts`, the single shared logging instance for the
whole application.

## Why this file exists

AGENTS.md Section 5 forbids raw `console.log` for business logic or errors and
mandates structured JSON logging via Pino, emitting "wide events". Centralizing
the logger in one module means every part of the app logs in the same structured
format and there is exactly one place to configure levels and transports.

## What it does

1. Create one Pino logger instance and export it.
2. Read the log level from the `LOG_LEVEL` environment variable, defaulting to
   `info` when it is unset.
3. **In development only** (`NODE_ENV !== 'production'`), pipe output through the
   `pino-pretty` transport for colorized, human-readable lines with timestamps.
4. **In production**, no transport is configured — Pino writes raw, fast JSON to
   stdout, which log collectors can ingest directly.

## Important constraint

The `pino-pretty` transport runs on a Node.js worker thread (`thread-stream`),
which does not exist on the Edge runtime and can also break under Turbopack
bundling. This logger is therefore only safe to import from Node.js-runtime code
paths. See the Pino + Edge Runtime note in AGENTS.md Section 5 and the
`instrumentation.ts` guards that keep logging on the Node runtime.
