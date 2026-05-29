import { expect, test } from '@playwright/test';

test('creates an advanced layout and opens upgraded 3D tour', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/projects/new');
  await page.getByRole('button', { name: /Rumah Tapak T45/ }).click();
  await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);

  await page.getByRole('button', { name: 'Ruang Tamu' }).first().click();
  await page.getByRole('button', { name: /Layout lanjutan|Advanced layout/ }).click();
  await expect(page.getByLabel(/Lantai|Floor/)).toBeVisible();
  await page.getByRole('button', { name: /Tambah lantai|Add floor/ }).click();
  await expect(page.getByLabel(/Lantai|Floor/)).toHaveValue('floor-2');

  await page.getByRole('button', { name: /Tambah area teras|Add terrace area/ }).click();
  await expect(page.getByText(/Teras|Terrace/).first()).toBeVisible();
  await page.getByText(/Teras|Terrace/).first().click();
  await expect(page.getByText(/Material luar ruang|Outdoor material/)).toBeVisible();

  await expect(page.getByText('Tersimpan')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await page.getByRole('button', { name: /Layout lanjutan|Advanced layout/ }).click();
  await expect(page.getByText(/Teras|Terrace/).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'Tur 3D' }).click();
  await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/tour$/);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
