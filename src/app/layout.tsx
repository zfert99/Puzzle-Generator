import type { Metadata } from "next";
import { Fredoka, Manrope, Space_Mono, Permanent_Marker, Caveat } from "next/font/google";
import { THEME_PRE_PAINT_SCRIPT } from "@/features/theme/theme";
import { AppHeader } from "@/features/chrome/AppHeader";
import { WobbleDefs } from "@/features/chaos/Wobble";
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
// Caveat for lighter cursive notes.
const permanentMarker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-permanent-marker" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Puzzle Generator",
  description:
    "Daily sudoku, competitive leaderboards, and print-ready puzzle books.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${manrope.variable} ${spaceMono.variable} ${permanentMarker.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Applies data-theme before paint — must be the first thing to run. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRE_PAINT_SCRIPT }} />
        <WobbleDefs />
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
