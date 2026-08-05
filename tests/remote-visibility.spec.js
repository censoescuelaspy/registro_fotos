const { test, expect } = require('@playwright/test');

test('mantiene visible el error remoto y no lo presenta como una lista vacia', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cialpa-fotos-session-v1', JSON.stringify({
      token: 'sesion-prueba-remota',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        codigoCensista: '1234567',
        nombres: 'Administracion',
        apellidos: 'Prueba',
        rol: 'ADMIN',
        activo: true
      }
    }));
  });

  await page.route('https://script.google.com/**', async (route) => {
    const posted = route.request().postData() || '';
    let payload;
    if (posted.includes('"action":"listRecords"')) {
      payload = { ok: false, error: { code: 'SERVER_ERROR', message: 'Falla simulada al leer REGISTROS.' } };
    } else if (posted.includes('"action":"bootstrap"')) {
      payload = {
        ok: true,
        data: {
          user: { codigoCensista: '1234567', nombres: 'Administracion', apellidos: 'Prueba', rol: 'ADMIN', activo: true },
          assignedCodes: [], showAllSchools: true, progress: {}, recentRecords: [],
          performance: { individual: null, team: null }
        }
      };
    } else {
      payload = { ok: true, data: { service: 'CIALPA Fotos', version: '1.9.0', bootstrapRequired: false } };
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><script>
        top.postMessage({
          source: 'CIALPA_GAS',
          requestId: window.name.replace('cialpa-gas-', ''),
          payload: ${JSON.stringify(payload)}
        }, '*');
      <\/script>`
    });
  });

  await page.goto('http://foo.localhost:4173/');
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
  await page.locator('[data-view="photos"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Fotografias por escuela' })).toBeVisible();
  await expect(page.locator('.remote-status-alert')).toContainText('Datos remotos no verificados');
  await expect(page.locator('.remote-status-alert')).toContainText('Falla simulada al leer REGISTROS');
  await expect(page.locator('.remote-status-alert')).toContainText('SERVER_ERROR');
  await expect(page.getByText('No se pudieron verificar las fotografias sincronizadas.')).toBeVisible();
  await expect(page.getByText('Aun no hay fotografias sincronizadas.')).toHaveCount(0);
});
