/**
 * A footer row of tiny faux-nostalgia "88×31" badges (chaos layer, §8) — pure GeoCities-era
 * flavor, no functional links. `aria-hidden` (decoration). Caveat font.
 */
const BADGES = [
  'best viewed at any size',
  'made with ♥ + crumbs',
  'no cookies, only biscuits',
  'est. today',
];

export function RetroBadges() {
  return (
    <div aria-hidden className="flex flex-wrap justify-center gap-2">
      {BADGES.map((b, i) => (
        <span
          key={i}
          style={{ fontFamily: 'var(--font-caveat, cursive)' }}
          className="text-[11px] leading-tight border border-ink px-1.5 py-0.5 bg-paper-2 text-ink-soft rounded-sm"
        >
          {b}
        </span>
      ))}
    </div>
  );
}
