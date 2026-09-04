import type { Metadata } from "next";
import { Fredoka, Manrope, Space_Mono, Permanent_Marker, Caveat } from "next/font/google";
import { THEME_PRE_PAINT_SCRIPT } from "@/features/theme/theme";
import { SETTINGS_PRE_PAINT_SCRIPT } from "@/features/settings/settings";
import { AppHeader } from "@/features/chrome/AppHeader";
import { Backdrop } from "@/features/chrome/Backdrop";
import { WobbleDefs } from "@/features/chaos/Wobble";
import { BASE_PATH } from "@/lib/base-path";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/**
 * Root Layout Component
 *
 * Wraps every page. Responsibilities:
 * 1. Self-host the Biscuit Lab type families via `next/font` (no layout shift, no
 *    external request), exposed as CSS vars consumed by `@theme` in globals.css:
 *    Fredoka (display), Manrope (body/UI), Space Mono (grid/stats).
 * 2. Set the base HTML document structure.
 * 3. Run the pre-paint theme script so `data-theme` is applied before first paint
 *    (no theme flash, hydration-safe).
 * 4. Global metadata.
 */

// Display — chunky rounded arcade face (Flash-portal energy). Variable font.
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });

// Body / UI — clean modern grotesk. Variable font.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

// Mono — puzzle-grid digits, timers, stats. Not variable; pin the weights we use.
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

// Chaos-layer marginalia (5.5) — DECORATIVE only, never body copy. Marker for bold scrawl,
// Caveat for lighter cursive notes. `preload: false`: next/font preloads every font
// declared at the root by default regardless of whether the current route renders it above
// the fold, and neither of these two is guaranteed to paint quickly on every page — that
// tripped Firefox's "preloaded but not used within a few seconds" warning on /daily.
const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-permanent-marker",
  preload: false,
});
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", preload: false });

export const metadata: Metadata = {
  // Public URL including the /puzzles path, so canonicals + OG URLs resolve to the
  // real host (biscuitlab.net/puzzles), not the origin *.vercel.app. Canonical tags
  // are the primary anti-index defense for the origin — NOT a Host-based noindex,
  // which would fire on the proxied response too (validation doc §1, §9).
  metadataBase: new URL("https://biscuitlab.net/puzzles"),
  // Per-page titles via template (QA F8): 6 of 8 routes used to share one document title, which
  // fails WCAG 2.4.2 (pages need distinguishing titles) and duplicates titles for SEO. The brand
  // is also reconciled here — the UI has said "Puzzle Lab" since the Phase 5 redesign while the
  // title still said "Puzzle Generator". Routes export a plain `metadata.title` string and the
  // template appends the brand; the hub itself gets `default`.
  title: { default: "Puzzle Lab", template: "%s · Puzzle Lab" },
  description:
    "Daily sudoku, competitive leaderboards, and print-ready puzzle books.",
  // Per-page canonical. Next resolves a "./" canonical against the CURRENT route's
  // pathname (path.posix.resolve(pathname, "./")), then composes it with
  // metadataBase — so every page emits a canonical at its own biscuitlab.net/puzzles/*
  // URL, not the origin *.vercel.app. This is the primary anti-duplicate-index defense
  // for the exposed origin (canonical-first, NOT a Host-based noindex — that would fire
  // on the proxied response too). Verified per-route under basePath (no double /puzzles).
  alternates: { canonical: "./" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The pre-paint script sets `data-theme` on <html> before hydration, so React would
      // otherwise flag an attribute mismatch on this element. The mutation is intentional.
      suppressHydrationWarning
      className={`${fredoka.variable} ${manrope.variable} ${spaceMono.variable} ${permanentMarker.variable} ${caveat.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        // Next prepends `basePath` to <Link>/next-image/router URLs but NOT to CSS `url()`, so a
        // Tailwind `bg-[url('/bg-pattern.svg')]` resolved outside the `/puzzles` zone and 404'd on
        // every page — the background never rendered anywhere (QA finding F2). The asset URL is
        // composed HERE, once, from the same BASE_PATH constant `fetch()` uses; pages consume it
        // as `bg-[image:var(--bg-pattern)]`, so no page carries a path that can drift.
        style={{ "--bg-pattern": `url(${BASE_PATH}/bg-pattern.svg)` } as React.CSSProperties}
      >
        {/* Applies data-theme before paint — must be the first thing to run. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRE_PAINT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_PRE_PAINT_SCRIPT }} />
        <WobbleDefs />
        <Backdrop />
        <AppHeader />
        {children}
        {/* Real-user monitoring: p75 LCP/INP/CLS per route (Speed Insights) + page analytics.
            Zero-config, tied to the deployment; data appears in the Vercel dashboard within ~24h. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
