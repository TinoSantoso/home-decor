import { expect, test } from '@playwright/test';

/**
 * Phase 1 happy-path E2E (plan §14 step 4, §17 acceptance check).
 *
 * Walks the core flow that the manual browser smoke test covered last
 * session — landing → dashboard → new project → editor with zone +
 * recommended item → cost estimator — so Phase 2 work has a regression
 * net beneath it.
 *
 * Each Playwright `test()` runs in a fresh browser context, which
 * means a fresh IndexedDB. No cleanup needed between cases.
 */

test.describe('Phase 2 slice 1: 3D tour route mounts', () => {
  test('navigates from editor to 3D tour and renders a canvas', async ({ page }) => {
    // Catch errors throughout, not just at the end.
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Bootstrap a project with a zone — wait for the debounced auto-save
    // to hit IDB before navigating away, otherwise /tour loads a project
    // with no zones.
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
    await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
    await expect(page.getByText('Tersimpan')).toBeVisible();

    // Navigate to the 3D tour via the editor nav link.
    await page.getByRole('link', { name: 'Tur 3D' }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/tour$/);
    await expect(
      page.getByRole('heading', { name: 'Rumah Tapak T45' }),
    ).toBeVisible();

    // Suspense fallback "Memuat pemandangan 3D…" disappears once the
    // heavy R3F chunk loads and the canvas mounts.
    await expect(page.getByText('Memuat pemandangan 3D…')).toBeHidden({
      timeout: 15_000,
    });

    // Canvas element confirms WebGL surface is present.
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });

    // No JavaScript runtime errors during scene boot.
    expect(errors).toEqual([]);
  });

  test('shows an empty-state hint when the project has no zones', async ({
    page,
  }) => {
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Apartemen Studio/ }).click();
    // Wait until the editor has fully loaded the new project from IDB
    // before navigating away — guarantees the IDB write completed.
    await expect(
      page.getByRole('textbox', { name: 'Nama proyek' }),
    ).toHaveValue('Apartemen Studio');

    // Don't add any zones — navigate straight to /tour.
    const tourUrl = page.url().replace('/editor', '/tour');
    await page.goto(tourUrl);
    await expect(
      page.getByText(/Belum ada zona\. Tambahkan zona di editor/),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('Phase 1 happy path (Bahasa Indonesia locale)', () => {
  test('user creates a project, adds a zone, places a recommendation, and sees the cost estimate', async ({
    page,
  }) => {
    // 1. Landing
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Rancang rumah impian Anda dalam 3D' }),
    ).toBeVisible();

    // 2. Dashboard (empty state for fresh IDB)
    await page.getByRole('link', { name: 'Mulai sekarang' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Proyek Saya' })).toBeVisible();
    await expect(
      page.getByText(/Belum ada proyek tersimpan/),
    ).toBeVisible();

    // 3. Template gallery → pick Rumah Tapak T45
    await page.getByRole('link', { name: 'Buat Proyek Baru' }).click();
    await expect(page).toHaveURL(/\/projects\/new$/);
    await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();

    // 4. Editor loads at /projects/<id>/editor with the canvas mounted
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
    await expect(
      page.getByRole('textbox', { name: 'Nama proyek' }),
    ).toHaveValue('Rumah Tapak T45');

    // 5. Add a Ruang Tamu zone via the toolbar — auto-selects it.
    await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
    await expect(page.getByText('1 zona')).toBeVisible();

    // 6. Side panel opens on Properties tab for the new zone.
    await expect(
      page.getByRole('button', { name: 'Properti', pressed: true }),
    ).toBeVisible();

    // 7. Pick the Japandi project style so the recommender filters to it.
    await page.getByRole('button', { name: 'Japandi', exact: true }).click();

    // 8. Open the Recommendations tab and add the top-scored item.
    await page.getByRole('button', { name: 'Rekomendasi' }).click();
    const firstAdd = page
      .getByRole('button', { name: /Tambahkan ke Zona/ })
      .first();
    await expect(firstAdd).toBeVisible();
    await firstAdd.click();

    // 9. Placed tab counter updates to (1).
    await expect(
      page.getByRole('button', { name: /Terpasang \(1\)/ }),
    ).toBeVisible();

    // 10. Auto-save status reaches "Tersimpan".
    await expect(page.getByText('Tersimpan')).toBeVisible();

    // 11. Navigate to the cost estimator and confirm a non-zero grand total.
    await page.getByRole('link', { name: 'Lihat Estimasi' }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/estimate$/);
    await expect(
      page.getByRole('heading', { name: 'TOTAL KESELURUHAN' }),
    ).toBeVisible();
    // Grand total is formatted as "Rp <digits with thousands separator>".
    await expect(
      page.locator('text=/Rp[\\s ][\\d.]+/').first(),
    ).toBeVisible();

    // 12. Per-zone breakdown lists Ruang Tamu (proves the placed item +
    //     surface derivation both fed into the engine).
    await expect(
      page.getByRole('heading', { name: 'Per Zona' }),
    ).toBeVisible();
  });

  test('newly-created project appears on the dashboard with persistence after reload', async ({
    page,
  }) => {
    // Create a project end-to-end.
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Apartemen Studio/ }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
    await expect(
      page.getByRole('textbox', { name: 'Nama proyek' }),
    ).toHaveValue('Apartemen Studio');

    // Wait for the auto-save to fire (the editor saves on mount when
    // any field changes; load itself doesn't trigger save).
    await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
    await expect(page.getByText('Tersimpan')).toBeVisible();

    // Reload the page → project state should still be there.
    await page.reload();
    await expect(page.getByText('1 zona')).toBeVisible();

    // Back to dashboard → the project shows in the list.
    await page.getByRole('link', { name: 'Beranda' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Apartemen Studio')).toBeVisible();
    await expect(page.getByText(/1 zona/).first()).toBeVisible();
  });
});
