'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * The route error boundary. A thrown render error used to drop the visitor onto Next's bare
 * "Application error: a client-side exception has occurred" screen with no way back. This keeps
 * the app chrome (the root layout still renders around it), says what happened without the
 * stack, and offers the two things that help: try again (`reset` re-renders the segment) and
 * the hub. Must be a Client Component — error boundaries are class-component territory under
 * the hood and need the browser.
 *
 * The error is reported through `console.error` here deliberately: this runs in the browser,
 * where the structured Pino logger (`instrumentation.ts`) does not exist, and the console is
 * what the error-tracking hook (`instrumentation-client.ts`, when added) and DevTools read.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex-1 flex flex-col items-center justify-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div role="alert" className="glass-panel p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-3" aria-hidden="true">💥</div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-ink">Something broke</h1>
        <p className="text-ink-soft mb-6">
          This page hit an error. Your saved puzzle is safe — it lives in this browser, not on this page.
        </p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors">
            Back to the hub
          </Link>
        </div>
      </div>
    </main>
  );
}
