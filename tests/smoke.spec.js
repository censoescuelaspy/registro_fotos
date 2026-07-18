const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible();
  await page.getByLabel('Codigo de censista / cedula').fill('1234567');
  await page.getByLabel('PIN', { exact: true }).fill('1234');
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
  await expect(page.getByRole('heading', { name: 'Mi trabajo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Registros sincronizados', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Continuar registro' })).toBeVisible();
  await expect(page.locator('.photo-item.is-synced')).toHaveCount(1);
  await expect(page.locator('.photo-id-preview')).toContainText(/-AM01-FT02/);
});

test('expone control administrativo y resumen por censista', async ({ page }) => {
  await page.getByRole('button', { name: 'Administrar' }).click();
  await expect(page.getByRole('heading', { name: 'Administracion' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avance por censista' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Asignar escuela' })).toBeVisible();
});
