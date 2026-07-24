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
// The band real phones actually report (Docs/research/responsive-design-pwa.md: Android
// 360/384/412, iPhone 375-430) — the subset of BREAKPOINTS worth checking for the two
// interaction-triggered overlays below, which only exist at mobile widths in practice.
const MOBILE_BREAKPOINTS = [320, 360, 390, 430];

/**
 * Regression guard for a real-device-only bug (July 2026): `MarqueeTicker`'s duplicated,
 * `white-space: nowrap` track is ~1000px+ wide by design (that's what makes it scroll), and
 * on a real Android phone that width leaked past `overflow: hidden` and inflated the WHOLE
 * page's layout viewport on /daily (the only route rendering it) — `window.innerWidth` and
 * `scrollHeight` both measured ~2.8x too large on-device, producing real horizontal scroll
 * and a hugely oversized page, while everything *looked* normally proportioned (the whole
 * viewport was scaled down to compensate). Not reproducible in desktop Chromium OR
 * Playwright's mobile-viewport emulation (verified — both render correctly regardless of
 * whether the fix below is present), so this can only assert the FIX'S PRESENCE (`contain:
 * paint`, a stronger isolation guarantee than `overflow: hidden` alone), not the original
 * bug's absence. Catches a future refactor silently dropping the property; does not replace
 * an occasional real-device check for anything else layout-viewport-related.
 */
test.describe('regression: marquee track cannot inflate the page viewport', () => {
  test('.marquee has contain: paint', async ({ page }) => {
    await page.goto('/daily');
    const marquee = page.locator('.marquee').first();
    await expect(marquee).toBeVisible();
    const containValue = await marquee.evaluate((el) => getComputedStyle(el).contain);
    expect(containValue, '.marquee lost its `contain: paint` isolation').toContain('paint');
  });
});

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

/**
 * Regression coverage for the July 2026 mobile bug report: the Settings panel and the
 * "start a new puzzle?" ConfirmModal are both interaction-triggered overlays that the page-
 * load-only checks above never open, so they slipped past the existing suite. Both used to
 * mis-render on real phones (settings anchored off the left edge of the viewport; the confirm
 * modal contributing to page-level horizontal scroll) despite passing the static-page checks.
 *
 * Asserts the STRONGER, more direct property (the overlay's own bounding box sits fully
 * inside the viewport) in addition to the page-level scrollWidth check — scrollWidth alone
 * wouldn't have caught "the panel is positioned off-screen but the page itself doesn't
 * scroll," which is exactly what `overflow-x: hidden` on `html`/`body` alone would produce
 * if the panel's own positioning bug weren't ALSO fixed.
 */
test.describe('responsive: overlay bounds stay inside the viewport', () => {
  for (const width of MOBILE_BREAKPOINTS) {
    test(`Settings panel stays on-screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Settings' }).click();

      const panel = page.getByRole('dialog', { name: 'Settings' });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box, 'Settings dialog has no bounding box').not.toBeNull();
      expect(box!.x, `Settings panel's left edge is off-screen at ${width}px (x=${box!.x})`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `Settings panel's right edge overflows the viewport at ${width}px`,
      ).toBeLessThanOrEqual(width + 1);

      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollW, `page-level horizontal overflow at ${width}px with Settings open`).toBeLessThanOrEqual(
        overflow.clientW + 1,
      );
    });

    // ConfirmModal is shared by /play and /daily, each with its own surrounding page chrome
    // (Daily's picker adds a MarqueeTicker + Tape + Sticker chaos decoration that /play's
    // menu doesn't have) — the original bug report was specifically about /daily, so both
    // trigger paths get their own case rather than assuming the shared component is enough.
    const confirmModalScenarios = [
      {
        label: '/play',
        trigger: async (page: import('@playwright/test').Page) => {
          await page.goto('/play');
          await page.getByRole('button', { name: '4×4' }).click();
          await page.getByRole('button', { name: /^Play$/ }).click();
          await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible();
          await page.getByRole('button', { name: /menu/i }).click();
          await page.getByRole('button', { name: /^Play$/ }).click();
        },
      },
      {
        label: '/daily',
        trigger: async (page: import('@playwright/test').Page) => {
          await page.goto('/daily');
          await page.getByRole('button', { name: /^easy$/i }).first().click();
          await page.getByRole('button', { name: /^Play/ }).click();
          await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible({ timeout: 15000 });
          await page.getByRole('button', { name: /difficulties/i }).click();
          await page.getByRole('button', { name: /^Play/ }).click();
        },
      },
    ];

    for (const scenario of confirmModalScenarios) {
      test(`"Start a new puzzle?" confirm modal (${scenario.label}) stays on-screen at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        // Create a saved game first (the warning only fires when one already exists), then
        // return to the menu and try to start another — the real trigger flow.
        await scenario.trigger(page);

        // `role="dialog"` sits on ConfirmModal's full-screen `fixed inset-0` backdrop, which
        // is trivially always viewport-sized — check its one direct child, the actual visible
        // card, or this assertion tests nothing.
        const dialog = page.getByRole('dialog', { name: 'Start a new puzzle?' });
        await expect(dialog).toBeVisible();
        const card = dialog.locator('> div');
        const box = await card.boundingBox();
        expect(box, 'confirm modal card has no bounding box').not.toBeNull();
        expect(box!.x, `confirm modal's left edge is off-screen at ${width}px (x=${box!.x})`).toBeGreaterThanOrEqual(0);
        expect(
          box!.x + box!.width,
          `confirm modal's right edge overflows the viewport at ${width}px`,
        ).toBeLessThanOrEqual(width + 1);

        const overflow = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollW,
          `page-level horizontal overflow at ${width}px with the confirm modal (${scenario.label}) open`,
        ).toBeLessThanOrEqual(overflow.clientW + 1);
      });
    }
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
