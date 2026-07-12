/**
 * The win-moment confetti burst — a crumb-scatter in the brand accents. `canvas-confetti`
 * is **lazy-loaded** (dynamic import) so it costs zero bundle on every other page/route;
 * only the solve moment pays for it.
 *
 * Capped at ~40 particles (design system: reserve the big effect for genuine completions,
 * keep it cheap). Colours are the accents (butterscotch/grape/mint), which read in both
 * themes. Callers must skip this under reduced motion — it is an animation.
 */
export async function fireConfetti(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { default: confetti } = await import('canvas-confetti');
  confetti({
    particleCount: 40,
    spread: 72,
    startVelocity: 38,
    origin: { y: 0.62 },
    colors: ['#E8A33D', '#5A3E96', '#2FAE86'], // butterscotch · grape · mint
    scalar: 0.9, // small "crumb" particles
    ticks: 180,
    disableForReducedMotion: true, // belt-and-suspenders; callers also gate on the hook
  });
}
