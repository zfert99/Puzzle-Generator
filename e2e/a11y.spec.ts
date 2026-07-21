import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility + responsive-layout guardrails, codifying the manual checks from the
 * mobile-width polish pass (see `Docs/mobile-a11y-audit.md`, gap G2):
 *  - no horizontal overflow across the phone→desktop breakpoint band, and
 *  - no serious/critical axe violations on the top user journeys.
 *
 * Runs on the routes that don't require auth. The puzzle board is a legitimate WCAG 1.4.10
 * Reflow exception, but it's sized `min(92vw, …)` so it never overflows anyway — no scroller
 * skipping needed here.
 */

const BREAKPOINTS = [320, 360, 390, 430, 768, 1024, 1440];
const PAGES = ['/', '/daily', '/archive', '/play', '/leaderboard', '/generate', '/signin'];

test.describe('responsive: no horizontal overflow', () => {
  for (const path of PAGES) {
    test(`${path} has no horizontal overflow across breakpoints`, async ({ page }) => {
      await page.goto(path);
      for (const width of BREAKPOINTS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(150); // let reflow settle
        const overflow = await page.evaluate(() => {
          const el = document.documentElement;
          return { scrollW: el.scrollWidth, clientW: el.clientWidth };
        });
        expect(
          overflow.scrollW,
          `horizontal overflow at ${width}px on ${path} (${overflow.scrollW} > ${overflow.clientW})`,
        ).toBeLessThanOrEqual(overflow.clientW + 1);
      }
    });
  }
});

test.describe('a11y: no serious/critical axe violations', () => {
  for (const path of ['/', '/daily', '/archive', '/play', '/leaderboard', '/signin']) {
    test(`${path} passes axe (serious+critical)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        blocking,
        blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.help}`).join('\n'),
      ).toEqual([]);
    });
  }
});
