import { expect, test } from '@playwright/test';

/**
 * Phase 2 slice 5: Before/After wipe-slider compare E2E smoke test.
 *
 * Verifies:
 *   1. The "Bandingkan" toggle is visible after zones exist on the tour route.
 *   2. Clicking it swaps the single `<TourScene>` for `<BeforeAfterCompare>`,
 *      which mounts two `<canvas>` elements (two WebGL contexts: before + after).
 *   3. The divider slider element is present and aria-labelled.
 *   4. Dragging the divider moves it horizontally on the page.
 *
 * The drag exercises pointer-down/move/up via Playwright's mouse API
 * (the divider attaches its handlers to `window`).
 */

test.describe('Phase 2 slice 5: compare mode wipe slider', () => {
  test('toggles into compare mode, mounts two scenes, and slider drags', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!e.message.includes('pointer lock') && !e.message.includes('PointerLock')) {
        errors.push(e.message);
      }
    });

    // Bootstrap a project with a zone, then navigate to the 3D tour.
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
    await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
    await expect(page.getByText('Tersimpan')).toBeVisible();

    await page.getByRole('link', { name: 'Tur 3D' }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/tour$/);

    // Wait for the regular tour to mount before clicking the toggle.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    // Toggle into compare mode.
    const toggle = page.getByTestId('tour-compare-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Bandingkan');
    await toggle.click();
    await expect(toggle).toHaveText('Keluar dari mode bandingkan');

    // Compare container mounts with both scenes (two canvases — before + after).
    await expect(page.getByTestId('before-after-compare')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('before-after-before')).toBeVisible();
    await expect(page.getByTestId('before-after-after')).toBeVisible();
    // Two WebGL canvases must be present (one per scene).
    await expect(page.locator('[data-testid="before-after-compare"] canvas')).toHaveCount(
      2,
      { timeout: 15_000 },
    );

    // Side labels visible (i18n is wired correctly).
    await expect(page.getByText('Sebelum')).toBeVisible();
    await expect(page.getByText('Sesudah')).toBeVisible();

    // Divider present and accessible.
    const divider = page.getByTestId('before-after-divider');
    await expect(divider).toBeVisible();
    await expect(divider).toHaveAttribute(
      'aria-label',
      'Geser untuk membandingkan sebelum dan sesudah',
    );

    // Drag the divider to the left and assert it moved.
    const startBox = await divider.boundingBox();
    if (!startBox) throw new Error('divider has no bounding box');
    const startCenterX = startBox.x + startBox.width / 2;
    const startCenterY = startBox.y + startBox.height / 2;

    // Drag ~120 px to the left via low-level mouse events.
    await page.mouse.move(startCenterX, startCenterY);
    await page.mouse.down();
    await page.mouse.move(startCenterX - 120, startCenterY, { steps: 8 });
    await page.mouse.up();

    const endBox = await divider.boundingBox();
    if (!endBox) throw new Error('divider has no bounding box after drag');
    const endCenterX = endBox.x + endBox.width / 2;
    expect(endCenterX).toBeLessThan(startCenterX - 50);

    // Exit compare mode → regular TourScene returns.
    await toggle.click();
    await expect(page.getByTestId('before-after-compare')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
