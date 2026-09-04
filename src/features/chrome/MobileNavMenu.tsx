'use client';

import Link from 'next/link';
import { useRef } from 'react';

/**
 * The header's mobile overflow menu (QA F11): Archive and PDF used to be `display:none` below
 * their breakpoints with no other header path — a player deep in `/play` on a phone could only
 * get to them by going back through the hub. This is a native `<details>` disclosure (keyboard
 * and screen-reader semantics for free, no positioning library), shown only while at least one
 * link is hidden from the inline nav (`md:hidden` — PDF is the last to appear, at `md`).
 *
 * The one thing that needs JavaScript: the root layout's header PERSISTS across client
 * navigations, so a plain `<details>` would still be open on the next page. The panel's click
 * handler closes it before `Link` navigates — which is why this leaf is a client component
 * while `AppHeader` stays a Server Component.
 *
 * Inside the panel, each link mirrors the inline nav's breakpoint (Archive appears inline from
 * `sm`, so its menu copy is `sm:hidden`), keeping exactly one visible path to each page at
 * every width.
 */
export function MobileNavMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="relative md:hidden">
      <summary className="list-none cursor-pointer select-none text-paper/90 hover:underline">
        More ▾
      </summary>
      <div
        className="absolute right-0 mt-2 z-50 flex flex-col gap-2 rounded-lg border-2 border-ink bg-grape p-3 shadow-chunky min-w-28"
        onClick={() => detailsRef.current?.removeAttribute('open')}
      >
        <Link href="/archive" className="text-paper/90 hover:underline sm:hidden">
          Archive
        </Link>
        <Link href="/generate" className="text-paper/90 hover:underline">
          PDF
        </Link>
      </div>
    </details>
  );
}
