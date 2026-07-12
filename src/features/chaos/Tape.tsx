/**
 * A translucent "tape strip" (chaos layer, §8) — a small rotated semi-opaque rectangle that
 * simulates something taped to a corkboard. Decoration only; absolutely positioned by the
 * caller. Purely visual, so it's `aria-hidden`.
 */
export function Tape({
  rotate = -6,
  className = '',
  width = 64,
}: {
  rotate?: number;
  className?: string;
  width?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ transform: `rotate(${rotate}deg)`, width, height: 22 }}
      className={`pointer-events-none block bg-paper/45 border-x border-ink/10 backdrop-blur-[1px] ${className}`}
    />
  );
}
