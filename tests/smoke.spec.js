const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible();
  await page.getByLabel('Usuario o cedula').fill('1234567');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
});

test('muestra las 86 escuelas piloto y permite filtrar', async ({ page }) => {
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(86);
  await page.getByPlaceholder('Codigo, escuela, distrito...').fill('11007');
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(1);
  await expect(page.getByText('COLEGIO NACIONAL DE E.M.D. PRESIDENTE FRANCO')).toBeVisible();
});

test('crea un registro con identificador fotografico automatico', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await expect(page.getByRole('heading', { name: 'Nuevo registro' })).toBeVisible();
  await expect(page.locator('.record-code')).toContainText(/-B01-P00-E001-H01/);
  await expect(page.locator('.photo-id-preview')).toContainText(/-AM01-FT01/);
  await expect(page.locator('input[data-photo-input="EVIDENCIA"]')).toHaveAttribute('capture', 'environment');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado en este celular.')).toBeVisible();
});

test('activa la camara y agrega el identificador al pie de la imagen', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  const sample = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dce8d5"/><rect x="90" y="80" width="460" height="210" fill="#ffffff" stroke="#123f69" stroke-width="8"/></svg>'
  );
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'aula-prueba.svg',
    mimeType: 'image/svg+xml',
    buffer: sample
  });
  await expect(page.locator('.photo-item')).toHaveCount(1);
  await expect(page.locator('.photo-item')).toContainText(/-AM01-FT01/);

  const image = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cialpa-registro-fotos-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise((resolve, reject) => {
      const request = database.transaction('blobs', 'readonly').objectStore('blobs').getAll();
      request.onsuccess = () => resolve(request.result[0]);
      request.onerror = () => reject(request.error);
    });
    const bitmap = await createImageBitmap(stored.blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const pixel = [...context.getImageData(bitmap.width - 8, bitmap.height - 8, 1, 1).data];
    return { width: bitmap.width, height: bitmap.height, pixel, mimeType: stored.blob.type };
  });
  expect(image).toMatchObject({ width: 640, height: 456, mimeType: 'image/jpeg' });
  expect(image.pixel[0]).toBeLessThan(45);
  expect(image.pixel[1]).toBeGreaterThan(40);
  expect(image.pixel[2]).toBeGreaterThan(75);
});

test('reabre un registro sincronizado y continua la secuencia fotografica', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'continuidad.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#edf3f8"/></svg>')
  });
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByRole('heading', { name: 'Mi jornada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Registros sincronizados', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Continuar registro' })).toBeVisible();
  await expect(page.locator('.photo-item.is-synced')).toHaveCount(1);
  await expect(page.locator('.photo-id-preview')).toContainText(/-AM01-FT02/);
});

test('expone control administrativo y resumen por censista', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avance por censista' })).toBeVisible();
  await expect(page.locator('.operations-tab.is-active')).toContainText('Resumen');
});

test('administra encuestadores y conserva la cuenta principal protegida', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="surveyors"]').click();
  await expect(page.getByRole('heading', { name: 'Administrar encuestadores' })).toBeVisible();
  await expect(page.getByText('Protegido', { exact: true })).toBeVisible();

  await page.getByLabel('Codigo / cedula').fill('4567890');
  await page.getByLabel('Nombres').fill('Carla');
  await page.getByLabel('Apellidos').fill('Benitez');
  await page.getByLabel('Telefono').fill('0981000003');
  await page.getByLabel('PIN inicial').fill('4321');
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText('Carla Benitez', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Carla Benitez' }).click();
  await expect(page.getByRole('heading', { name: 'Editar usuario' })).toBeVisible();
  await expect(page.getByLabel('Codigo / cedula')).toHaveAttribute('readonly', '');
});

test('planifica, filtra, deshace y guarda asignaciones logisticas', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="logistics"]').click();
  await expect(page.getByRole('heading', { name: 'Logistica de campo' })).toBeVisible();
  const assignment = page.locator('[data-logistics-assignment="12110"]');
  await assignment.selectOption('2345678');
  await expect(page.locator('.dirty-banner')).toContainText('1 cambio sin guardar');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.dirty-banner')).toHaveCount(0);

  await page.locator('[data-logistics-assignment="12110"]').selectOption('2345678');
  await page.getByRole('button', { name: /Guardar 1 cambio/ }).click();
  await expect(page.getByText('1 asignacion actualizada.')).toBeVisible();
  await expect(page.locator('[data-logistics-assignment="12110"]')).toHaveValue('2345678');

  await page.getByPlaceholder('Codigo, escuela o localidad...').fill('12110');
  await expect(page.locator('[data-logistics-assignment]')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  await expect(await download).toBeTruthy();
});

test('mantiene solicitudes en una bandeja administrativa separada', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="requests"]').click();
  await expect(page.getByRole('heading', { name: 'Solicitudes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bandeja de solicitudes' })).toBeVisible();
});

test('recorre los modulos operativos sin errores ni desborde de pagina', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const views = [
    ['pending', 'Mi jornada'],
    ['admin', 'Resumen general'],
    ['surveyors', 'Administrar encuestadores'],
    ['logistics', 'Logistica de campo'],
    ['requests', 'Solicitudes'],
    ['account', 'Mi cuenta']
  ];
  for (const [view, heading] of views) {
    await page.locator(`[data-view="${view}"]:visible`).first().click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  expect(errors).toEqual([]);
});

test('intercambia respuestas GAS mediante el puente iframe sin depender de CORS', async ({ page }) => {
  let postedBody = '';
  await page.route('https://script.google.com/mock', async (route) => {
    postedBody = route.request().postData() || '';
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><script>
        top.postMessage({
          source: 'CIALPA_GAS',
          requestId: window.name.replace('cialpa-gas-', ''),
          payload: { ok: true, data: { service: 'CIALPA Fotos', version: '1.1.0' } }
        }, '*');
      <\/script>`
    });
  });

  const result = await page.evaluate(async () => {
    const { ApiClient } = await import('./assets/js/api.js?bridge-test=1');
    const api = new ApiClient({
      demo: false,
      gasExecUrl: 'https://script.google.com/mock',
      version: '1.1.0'
    });
    const health = await api.health();
    return {
      health,
      iframes: document.querySelectorAll('iframe[name^="cialpa-gas-"]').length,
      forms: document.querySelectorAll('form[target^="cialpa-gas-"]').length
    };
  });

  expect(postedBody).toContain('health');
  expect(result).toEqual({
    health: { service: 'CIALPA Fotos', version: '1.1.0' },
    iframes: 0,
    forms: 0
  });
});

test('acepta el subdominio dinamico oficial de HtmlService', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const formSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function submitMock() {
      const requestId = this.querySelector('[name="requestId"]').value;
      window.postMessage({
        source: 'CIALPA_GAS',
        requestId,
        payload: { ok: true, data: { service: 'CIALPA Fotos' } }
      }, location.origin);
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://dynamic-id-script.googleusercontent.com',
        data: {
          source: 'CIALPA_GAS',
          requestId,
          payload: { ok: true, data: { service: 'CIALPA Fotos' } }
        }
      }));
    };
    try {
      const { ApiClient } = await import('/assets/js/api.js');
      const api = new ApiClient({ demo: false, version: '1.1.0', gasExecUrl: '/fake-gas' });
      return await api.health();
    } finally {
      HTMLFormElement.prototype.submit = formSubmit;
    }
  });
  expect(result).toEqual({ service: 'CIALPA Fotos' });
});
