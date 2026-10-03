import type { MetadataRoute } from 'next';

/**
 * The web app manifest (a11y audit G9 — installable). Next serves this at
 * `/puzzles/manifest.webmanifest` under the basePath and links it from every page's metadata.
 * Icon paths are RELATIVE so they resolve against the manifest's own URL (`/puzzles/icons/…`);
 * an absolute `/icons/…` would escape the zone the way the old `bg-pattern` URL once did.
 * `start_url`/`scope` are the zone root. No service worker: Chrome dropped it as an install
 * requirement in 2024, and an offline shell for a generator app is a feature decision for later.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Puzzle Lab',
    short_name: 'Puzzle Lab',
    description: 'Daily sudoku, competitive leaderboards, and print-ready puzzle books.',
    start_url: '/puzzles',
    scope: '/puzzles',
    display: 'standalone',
    background_color: '#FBF3E3',
    theme_color: '#5A3E96',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
