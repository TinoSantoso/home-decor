import { expect, test } from '@playwright/test';

/**
 * Phase 2 slice 2: walk-mode toggle E2E smoke test.
 *
 * We only assert the visible state change (mode badge + button label).
 * We intentionally do NOT trigger or assert actual pointer-lock because
 * browsers block pointer lock in automation contexts.
 *
 * The TourControls component uses `selector="canvas"` for PointerLockControls
 * so that clicking the toggle button does NOT trigger a pointer-lock request —
 * only clicking the canvas does. This keeps the toggle fully testable in CI.
 */

test.describe('Phase 2 slice 2: walk mode toggle', () => {
  test('toggle button switches between orbit and walk visible state', async ({
    page,
  }) => {
    // Collect only errors that are NOT the expected pointer-lock automation
    // rejection (browsers disallow pointer-lock outside real gestures).
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

    // Wait for the canvas to mount before interacting with the overlay.
    // Use first() — there may be multiple canvases (R3F + Konva editor from previous route).
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    // Initial state: orbit mode.
    await expect(page.getByTestId('tour-mode-badge')).toBeVisible();
    await expect(page.getByTestId('tour-mode-badge')).toHaveText('Orbit');
    await expect(page.getByTestId('tour-mode-toggle')).toHaveText('Mode Jalan');

    // Click to enter walk mode (changes store state → re-renders badge/button).
    // Does NOT trigger pointer-lock because selector="canvas" on PointerLockControls.
    await page.getByTestId('tour-mode-toggle').click();

    // Badge and button label update to reflect walk mode.
    await expect(page.getByTestId('tour-mode-badge')).toHaveText('Jalan');
    await expect(page.getByTestId('tour-mode-toggle')).toHaveText('Mode Orbit');

    // Click to return to orbit mode.
    await page.getByTestId('tour-mode-toggle').click();
    await expect(page.getByTestId('tour-mode-badge')).toHaveText('Orbit');
    await expect(page.getByTestId('tour-mode-toggle')).toHaveText('Mode Jalan');

    // No unexpected JS errors during the whole interaction.
    expect(errors).toEqual([]);
  });
});
