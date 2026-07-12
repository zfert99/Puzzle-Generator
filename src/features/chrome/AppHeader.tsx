import Link from 'next/link';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { AccountBadge } from '@/features/auth/components/AccountBadge';

/**
 * The global app header — the design system's grape nav bar: a cream Fredoka wordmark, a
 * small handwritten marginalia aside, ghost-style nav links, the theme toggle, and the
 * account control. Rendered once in the root layout so every page shares it (replacing the
 * old per-page header rows).
 *
 * The marginalia uses `--font-marker` (Permanent Marker) which lands with the 5.5 chaos
 * layer; until then it falls back to a system cursive, so the slot is reserved now.
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
            className="text-xs text-paper/70 hidden sm:inline whitespace-nowrap"
            style={{ fontFamily: 'var(--font-marker, ui-rounded, cursive)' }}
          >
            est. today, mostly stable
          </span>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/daily" className="text-paper/90 hover:underline">Daily</Link>
          <Link href="/leaderboard" className="text-paper/90 hover:underline">Leaderboard</Link>
          <Link href="/play" className="text-paper/90 hover:underline">Play</Link>
          <Link href="/generate" className="text-paper/90 hover:underline hidden md:inline">PDF</Link>
          <ThemeToggle />
          <AccountBadge />
        </nav>
      </div>
    </header>
  );
}
