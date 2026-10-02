/**
 * Route transition (design system §4): a subtle fade + 8px slide on navigation. A `template`
 * (unlike `layout`) re-mounts on every route change, so giving its wrapper a CSS enter
 * animation gives each page a gentle entrance.
 *
 * This is a Server Component on purpose. It used to be a `motion.div` from the `motion`
 * library, which (a) shipped ~39 KB gzipped of animation runtime to every route — including
 * the hub, leaderboard, sign-in and print pages, where nothing else animates — and (b)
 * server-rendered `style="opacity:0;transform:translateY(8px)"`, so every page's content was
 * invisible until the framework and that chunk had downloaded, hydrated and run the animation.
 * The LCP element could never paint before hydration. A CSS keyframe (`.page-enter` in
 * `globals.css`) plays at first paint with no JavaScript at all, and the existing
 * `[data-motion="reduce"]` pre-paint attribute switches it off for reduced motion — including
 * on the very first paint, which the client-side `useReducedMotion` snapshot could not do.
 *
 * The wrapper is `flex-1 flex flex-col` so it transparently passes the body's flex column
 * through to each page's `flex-1` main.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col page-enter">{children}</div>;
}
