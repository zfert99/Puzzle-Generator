import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/**
 * The 404 page. Without this file Next served its bare "This page could not be found." text
 * inside the app chrome — unstyled and with no way onward. Branded like every other route, and
 * it points at the hub (the one place every surface is reachable from).
 */
export default function NotFound() {
  return (
    <main id="main" className="flex-1 flex flex-col items-center justify-center p-8 bg-[image:var(--bg-pattern)] bg-cover bg-center">
      <div className="glass-panel p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-3" aria-hidden="true">🧩</div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-ink">That piece is missing</h1>
        <p className="text-ink-soft mb-6">There&apos;s no page at this address.</p>
        <Link href="/" className="btn-primary inline-flex justify-center">
          Back to the hub
        </Link>
      </div>
    </main>
  );
}
