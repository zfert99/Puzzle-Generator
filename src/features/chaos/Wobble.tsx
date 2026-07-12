import type { ReactNode } from 'react';

/**
 * The hand-inked wobble filter (chaos layer, §8) — `feTurbulence` + `feDisplacementMap`. This
 * is the technique that reads most as "hand-drawn." It is applied ONLY to decorative SVG
 * outlines (never as a CSS filter on content), so text inside never warps.
 *
 * `WobbleDefs` renders the filter once (in the root layout); `WobbleFrame` draws a wobbly
 * rounded-rect outline behind its children.
 */
export function WobbleDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <filter id="chaos-wobble" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
      </filter>
    </svg>
  );
}

export function WobbleFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <rect
          x="2%"
          y="4%"
          width="96%"
          height="92%"
          rx="16"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3"
          style={{ filter: 'url(#chaos-wobble)' }}
        />
      </svg>
      {children}
    </div>
  );
}
