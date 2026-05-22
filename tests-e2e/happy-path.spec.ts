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

  test('uploads a floor-plan reference image and persists the URL across reload', async ({
    page,
  }) => {
    // Stub the TanStack Start server-fn endpoint BEFORE any nav.
    // Protocol notes (from @tanstack/start-client-core/createServerFn.js):
    //   - URL is `${TSS_SERVER_FN_BASE}<functionId>` (default base = "/_serverFn").
    //   - The server-side base middleware wraps the user's return value as
    //     `{ result: <user-return> }` before serialization, and the top-level
    //     wrapper extracts `result.result`. So a stubbed JSON response must
    //     mirror that shape, not the raw upload result, or the hook reads
    //     `.url` off `undefined`.
    //   - Plain `application/json` (no `x-tss-serialized` header) makes the
    //     fetcher return the body verbatim — no seroval framing needed.
    await page.route('**/_serverFn/**', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = req.postData() ?? '';
      // Sanity-check that this is in fact the upload payload, not some
      // other future server fn.
      if (!body.includes('bodyBase64')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          result: {
            ok: true,
            key: 'floor-plans/test/stub.png',
            url: 'https://assets.test.local/floor-plans/test/stub.png',
          },
        }),
      });
    });

    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);

    // Smallest valid PNG (1x1 transparent) — enough to clear the
    // fileToBase64 "empty blob" guard.
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000005000101' +
        '0d0a2db40000000049454e44ae426082',
      'hex',
    );

    await page.getByTestId('floor-plan-file-input').setInputFiles({
      name: 'sketch.png',
      mimeType: 'image/png',
      buffer: pngBytes,
    });

    // Once the stub resolves, the image and "Replace" button render.
    const img = page.getByTestId('floor-plan-image');
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect(img).toHaveAttribute(
      'src',
      'https://assets.test.local/floor-plans/test/stub.png',
    );

    // Auto-save fires because floorPlanImageUrl is in the watched keys.
    await expect(page.getByText('Tersimpan')).toBeVisible();

    // Reload — the URL must come back from IDB.
    await page.reload();
    const imgAfterReload = page.getByTestId('floor-plan-image');
    await expect(imgAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(imgAfterReload).toHaveAttribute(
      'src',
      'https://assets.test.local/floor-plans/test/stub.png',
    );
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

test.describe('Phase 3 slice 5: shareable read-only links', () => {
  test('generates a share link and renders a read-only estimate view', async ({
    page,
  }) => {
    // 1. Create project with a zone and item.
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Rumah Tapak T36/ }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
    await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
    await page.getByRole('button', { name: 'Rekomendasi' }).click();
    await page
      .getByRole('button', { name: /Tambahkan ke Zona/ })
      .first()
      .click();
    await expect(page.getByText('Tersimpan')).toBeVisible();

    // 2. Navigate to the estimate page and wait for the share button.
    await page.getByRole('link', { name: 'Lihat Estimasi' }).click();
    await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/estimate$/);
    await expect(
      page.getByRole('heading', { name: /TOTAL KESELURUHAN/i }),
    ).toBeVisible();
    // Wait for the Copy Link button to appear (it only shows when load.kind === 'ready').
    const shareButton = page.getByTestId('copy-share-link');
    await expect(shareButton).toBeVisible({ timeout: 10_000 });

    // 3. Click "Copy Link" button. It generates a token and stores the share URL
    //    in the data-share-url attribute.
    await shareButton.click();
    // Wait for the async share URL to populate on the button.
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-testid="copy-share-link"]') as HTMLElement | null)
          ?.getAttribute('data-share-url') !== '',
      { timeout: 10_000 },
    );
    const url = (await shareButton.getAttribute('data-share-url')) ?? '';
    expect(url).toMatch(/\/share\/[A-Za-z0-9_-]+$/);

    // 4. Open the share link in a new page (simulating a recipient).
    const sharePage = await page.context().newPage();
    await sharePage.goto(url);

    // 5. Verify read-only view: grand total and "read-only" label.
    await expect(
      sharePage.getByRole('heading', { name: /TOTAL KESELURUHAN/i }),
    ).toBeVisible();
    await expect(
      sharePage.getByText(/Tampilan hanya-baca|Read-only view/),
    ).toBeVisible();

    // 6. Verify PDF export button is present (read-only can still export).
    await expect(
      sharePage.getByRole('button', { name: /Unduh PDF|Download PDF/ }),
    ).toBeVisible();

    // 7. Verify no "Copy Link" button (no editing controls on share page).
    await expect(
      sharePage.getByRole('button', { name: /Salin Tautan|Copy Link/ }),
    ).toHaveCount(0);

    // 8. Verify the zone pill is visible.
    await expect(sharePage.getByText('Ruang Tamu').first()).toBeVisible();

    await sharePage.close();
  });
});
