const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('muestra la version y permite buscar actualizaciones antes y despues del acceso', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByText('Version 1.8.1', { exact: true })).toBeVisible();
  const accessUpdate = page.getByRole('button', { name: 'Actualizar aplicacion' });
  await expect(accessUpdate).toBeVisible();
  await accessUpdate.click();
  await expect(page.getByText('Ya esta usando la version 1.8.1.')).toBeVisible();

  await page.getByLabel('Usuario, codigo operativo o cedula').fill('1234567');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.locator('.topbar .version-badge')).toHaveText('v1.8.1');
  await expect(page.locator('.topbar').getByRole('button', { name: 'Actualizar aplicacion' })).toBeVisible();
});

test('el service worker invalida la cache anterior, recarga y marca la version aplicada', async () => {
  const response = await fetch('http://127.0.0.1:4173/sw.js');
  const source = await response.text();
  expect(source).toContain("const CACHE_VERSION = 'cialpa-fotos-v1.8.1'");
  expect(source).toContain("url.searchParams.set('app_updated', APP_VERSION)");
  expect(source).toContain('client.navigate(url.href)');
});

test('el workflow publica el manifiesto de version usado por la actualizacion', () => {
  const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  expect(workflow).toContain('sw.js version.json .nojekyll');
});

test('aplica una version nueva y avisa al usuario despues de la recarga', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    await caches.delete('cialpa-fotos-v1.8.1-shell');
    await caches.open('cialpa-fotos-v1.7.2-shell');
    await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  });
  await expect(page.getByText('Aplicacion actualizada correctamente a la version 1.8.1.')).toBeVisible({ timeout: 15000 });
  await expect(page).not.toHaveURL(/app_updated=/);
});

test('muestra el aviso cuando la recarga informa la version aplicada', async ({ page }) => {
  await page.goto('/?demo=1&app_updated=1.8.1');
  await expect(page.getByText('Aplicacion actualizada correctamente a la version 1.8.1.')).toBeVisible();
  await expect(page).not.toHaveURL(/app_updated=/);
});
