import Link from 'next/link';
import { SettingsMenu } from '@/features/settings/SettingsMenu';
import { AccountBadge } from '@/features/auth/components/AccountBadge';
import { MobileNavMenu } from './MobileNavMenu';

/**
 * The global app header — the design system's grape nav bar: a cream Fredoka wordmark, a
 * small handwritten marginalia aside, ghost-style nav links, the theme toggle, and the
 * account control. Rendered once in the root layout so every page shares it (replacing the
 * old per-page header rows).
 *
 * The marginalia uses `--font-marker` (Permanent Marker) which lands with the 5.5 chaos
 * layer; until then it falls back to a system cursive, so the slot is reserved now.
 *
 * The nav wraps. At 320 px (the WCAG 1.4.10 reflow width) its five items plus the gear and
 * "Sign in" ran to ~335 px on one line and the global `overflow-x: hidden` clipped "Sign in"
 * off the right edge — unreachable, since the page itself could not scroll to it.
 */
export function AppHeader() {
  return (
    <header className="bg-grape text-paper border-b-[3px] border-ink">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <Link href="/" className="font-display text-2xl text-paper hover:opacity-90 whitespace-nowrap">
            🧩 Puzzle Lab
          </Link>
          <span
            className="text-xs text-paper/90 hidden sm:inline whitespace-nowrap"
            style={{ fontFamily: 'var(--font-marker, ui-rounded, cursive)' }}
          >
            est. today, mostly stable
          </span>
        </div>

        {/* Each link is padded to a ≥ 24 px tall target (WCAG 2.5.8): the bare text-sm links were
            20 px, and once the nav wraps at phone widths the rows sit close enough that the
            spacing exception no longer applies. */}
        <nav aria-label="Primary" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
          <Link href="/daily" className="text-paper/90 hover:underline py-1">Daily</Link>
          <Link href="/leaderboard" className="text-paper/90 hover:underline py-1">Leaderboard</Link>
          <Link href="/play" className="text-paper/90 hover:underline py-1">Play</Link>
          <Link href="/archive" className="text-paper/90 hover:underline hidden sm:inline py-1">Archive</Link>
          <Link href="/generate" className="text-paper/90 hover:underline hidden md:inline py-1">PDF</Link>
          {/* Overflow for the links hidden above (QA F11) — see MobileNavMenu. */}
          <MobileNavMenu />
          <SettingsMenu />
          <AccountBadge />
        </nav>
      </div>
    </header>
  );
}
