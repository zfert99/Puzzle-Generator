/**
 * The site-wide backdrop (juice layer): three slow-drifting "aurora" blobs in brand colors
 * plus a scatter of faint puzzle glyphs, fixed behind every page. The per-page dot pattern
 * (transparent SVG) sits on top, so the blobs glow through the dots — visually interesting
 * without competing with content.
 *
 * Design constraints (why it looks the way it does):
 * - **Theme-aware for free**: colors come from `color-mix` over the token vars, so the same
 *   markup works in light (warm pastel wash) and dark (deep glows) — no per-theme branches.
 * - **Cheap**: transform-only animations (GPU-composited), no `filter: blur` on huge layers
 *   (pre-soft radial gradients instead), `pointer-events: none`, decorative → `aria-hidden`.
 * - **Motion-safe**: `prefers-reduced-motion` freezes the drift (rules in globals.css).
 * - **Deterministic**: glyph positions are a fixed table, not RNG — this is a Server
 *   Component and must render identically on server and client (AGENTS.md §1 hydration).
 */

const GLYPHS: ReadonlyArray<{ char: string; top: string; left: string; rotate: number; duration: number; delay: number }> = [
  { char: '7', top: '12%', left: '6%', rotate: -14, duration: 46, delay: 0 },
  { char: '3', top: '68%', left: '9%', rotate: 9, duration: 54, delay: -12 },
  { char: '9', top: '22%', left: '88%', rotate: 12, duration: 50, delay: -25 },
  { char: '5', top: '78%', left: '84%', rotate: -8, duration: 58, delay: -7 },
  { char: '∑', top: '45%', left: '3%', rotate: 6, duration: 62, delay: -33 },
  { char: '1', top: '88%', left: '46%', rotate: -11, duration: 48, delay: -19 },
  { char: '⌗', top: '6%', left: '55%', rotate: 8, duration: 66, delay: -40 },
];

export function Backdrop() {
  return (
    <div className="site-backdrop" aria-hidden="true">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />
      {GLYPHS.map((g) => (
        <span
          key={`${g.char}-${g.top}-${g.left}`}
          className="backdrop-glyph"
          style={{
            top: g.top,
            left: g.left,
            animationDuration: `${g.duration}s`,
            animationDelay: `${g.delay}s`,
            ['--glyph-rotate' as string]: `${g.rotate}deg`,
          }}
        >
          {g.char}
        </span>
      ))}
    </div>
  );
}
