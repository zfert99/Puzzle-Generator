/**
 * An old-portal scrolling ticker (chaos layer, §8). The visible track is duplicated so it
 * loops seamlessly; it pauses on hover and is static under `prefers-reduced-motion` (via the
 * `.marquee*` CSS). A **static screen-reader duplicate** carries the same content, so the
 * animation is purely decorative (a11y §6). Chrome only — never over the solve grid.
 */
export function MarqueeTicker({ items }: { items: string[] }) {
  const line = items.join('  ★  ');
  return (
    <div className="marquee w-full max-w-md mx-auto border-2 border-ink bg-butterscotch text-ink text-xs py-1 rounded-md">
      <div className="marquee-track" aria-hidden>
        <span className="px-3">{line}  &#9733;  </span>
        <span className="px-3">{line}  &#9733;  </span>
      </div>
      <span className="sr-only">{line}</span>
    </div>
  );
}
