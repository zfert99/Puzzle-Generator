# Instrumentation: Plain English Pseudocode

This document explains `instrumentation.ts`, the Next.js server-lifecycle hook
file. Next.js automatically imports this module once, when the server process
boots, and calls the functions it exports. We use it to wire up telemetry.

## Why this file exists

AGENTS.md Section 5 mandates structured JSON logging (Pino) via
`instrumentation.ts`, emitting "wide events" rather than scattering `console.log`
calls. Everything here is deliberately gated to the **Node.js runtime**, because
Pino's async transport relies on worker threads (`thread-stream`) that do not
exist on the Edge runtime — running it there throws.

## 1. `register()` — process startup

**Goal:** Announce that the app has started and install global safety nets so a
stray rejected promise or thrown error is captured instead of silently killing
the process.

**Steps:**

1. Only run when `NEXT_RUNTIME === 'nodejs'` (skip on Edge).
2. Lazily import the Pino logger (dynamic import keeps it out of the Edge bundle).
3. Log an `app_start` wide event.
4. Register a global handler for **unhandled promise rejections** — log an
   `unhandled_rejection` event with the reason.
5. Register a global handler for **uncaught exceptions** — log an
   `uncaught_exception` event. (In production you might `process.exit(1)` here,
   depending on whether the process can recover.)

## 2. `onRequestError()` — per-request error telemetry

**Goal:** Capture every error thrown while handling a request — in App Router
renders, Route Handlers, Server Actions, and middleware — as one structured event.
Next.js calls this hook automatically whenever a request errors.

**Steps:**

1. Bail out immediately unless we are on the Node.js runtime.
2. Lazily import the Pino logger.
3. Emit a single `request_error` wide event containing the error message and
   stack **(server-side log only)**, plus request context: HTTP method, path,
   router kind, route path, and route type.

Note the division of responsibility: the API route's own `catch` block returns a
generic response to the client (no stack), while this hook is where the full
stack is preserved in the logs. The stack never travels to the browser.
