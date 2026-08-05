const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible();
  await page.getByLabel('Usuario, codigo operativo o cedula').fill('1234567');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
});

test('muestra las 86 escuelas piloto y permite filtrar', async ({ page }) => {
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(86);
  await page.getByPlaceholder('Codigo RUE o interno, escuela, distrito...').fill('11007');
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(1);
  await expect(page.getByText('COLEGIO NACIONAL DE E.M.D. PRESIDENTE FRANCO')).toBeVisible();
  await page.getByPlaceholder('Codigo RUE o interno, escuela, distrito...').fill('0011007');
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(1);
  await expect(page.locator('[data-action="select-school"] small')).toContainText('RUE 0011007');

  const sharedSite = await page.evaluate(async () => {
    const catalog = await fetch('./assets/data/pilot-schools.json').then((response) => response.json());
    const first = catalog.schools.find((school) => school.codigo === '1108034');
    const second = catalog.schools.find((school) => school.codigo === '1108042');
    return {
      schemaVersion: catalog.schemaVersion,
      physicalSites: catalog.physicalSites,
      firstSite: first.sitioId,
      secondSite: second.sitioId,
      sharedCodes: first.codigosRueSitio
    };
  });
  expect(sharedSite).toEqual({
    schemaVersion: 2,
    physicalSites: 85,
    firstSite: 'CIALPA-S051',
    secondSite: 'CIALPA-S051',
    sharedCodes: ['1108034', '1108042']
  });
});

test('centra el mapa al seleccionar una escuela desde la lista', async ({ page }) => {
  await page.evaluate(() => {
    window.__mapOperations = [];
    const originalSetView = window.L.Map.prototype.setView;
    const originalInvalidateSize = window.L.Map.prototype.invalidateSize;
    window.L.Map.prototype.setView = function setView(center, zoom, options) {
      const point = window.L.latLng(center);
      window.__mapOperations.push({ type: 'setView', lat: point.lat, lng: point.lng, zoom });
      return originalSetView.call(this, center, zoom, options);
    };
    window.L.Map.prototype.invalidateSize = function invalidateSize(options) {
      window.__mapOperations.push({ type: 'invalidateSize' });
      return originalInvalidateSize.call(this, options);
    };
  });

  await page.locator('[data-action="select-school"][data-school="11007"]').click();
  await expect(page.locator('.school-marker.is-selected')).toBeVisible();
  await page.waitForTimeout(250);

  await expect.poll(async () => page.evaluate(() => {
    const map = document.querySelector('#school-map')?.getBoundingClientRect();
    const marker = document.querySelector('.school-marker.is-selected')?.getBoundingClientRect();
    if (!map || !marker) return Number.POSITIVE_INFINITY;
    const deltaX = (marker.left + marker.width / 2) - (map.left + map.width / 2);
    const deltaY = (marker.top + marker.height / 2) - (map.top + map.height / 2);
    return Math.hypot(deltaX, deltaY);
  })).toBeLessThan(24);

  const lastOperation = await page.evaluate(() => window.__mapOperations.at(-1));
  expect(lastOperation).toEqual({
    type: 'setView',
    lat: -25.2844425,
    lng: -57.6359119,
    zoom: 18
  });
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

test('muestra la guia operativa y sus recursos de capacitacion', async ({ page }) => {
  await page.locator('[data-view="guide"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Guia de campo', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secuencia recomendada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recuperacion segura' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar plantilla' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Manual de capacitacion/ })).toHaveAttribute(
    'href',
    './docs/MANUAL_CAPACITACION_CIALPA_FOTOS_2026-07-25.pdf'
  );
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

test('edita un registro sincronizado y continua la secuencia fotografica', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { name: 'Editar registro' })).toBeVisible();
  await expect(page.locator('.photo-item.is-synced')).toHaveCount(1);
  await expect(page.locator('.photo-id-preview')).toContainText(/-AM01-FT02/);
});

test('permite ver y ampliar las fotos sincronizadas desde la galeria', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'galeria.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#62a88d"/></svg>')
  });
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByRole('heading', { name: 'Mi jornada' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cialpa-fotos-demo-data-v1')).photos.length)).toBe(1);
  await page.evaluate(() => {
    const key = 'cialpa-fotos-demo-data-v1';
    const data = JSON.parse(localStorage.getItem(key));
    const photo = data.photos[0];
    const binary = atob(photo.demoBase64);
    const repeated = binary.repeat(Math.max(2, Math.ceil(310000 / binary.length)));
    photo.demoBase64 = btoa(repeated);
    photo.bytes = repeated.length;
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.locator('[data-view="photos"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Fotografias por escuela' })).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  await expect.poll(() => page.locator('.gallery-image img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.gallery-image img')).toHaveAttribute('data-photo-quality', 'preview');
  await page.locator('.gallery-image').click();
  await expect(page.locator('.photo-dialog')).toBeVisible();
  await expect(page.locator('.photo-dialog img')).toBeVisible();
  await expect(page.locator('.photo-dialog img')).toHaveAttribute('data-photo-quality', 'original');
});

test('muestra en la galeria registros de escuelas que no estan en el catalogo estatico', async ({ page }) => {
  await page.evaluate(() => {
    const key = 'cialpa-fotos-demo-data-v1';
    const data = JSON.parse(localStorage.getItem(key));
    data.records.push({
      recordKey: '1234567:9998123-B01-P00-E001-H01',
      recordId: '9998123-B01-P00-E001-H01',
      codigoCensista: '1234567',
      codigoEscuela: '9998123',
      codigoRue: '9998123',
      bloque: '1', piso: '0', espacio: '1', numeroHoja: '1',
      estado: 'FINALIZADO', cantidadFotos: 0,
      updatedAt: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.removeItem('cialpa-fotos-records-cache-v1');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
  await page.locator('[data-view="photos"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Fotografias por escuela' })).toBeVisible();
  await expect(page.locator('[data-gallery-school] option[value="9998123"]')).toHaveCount(1);
  await page.locator('[data-gallery-school]').selectOption('9998123');
  await expect(page.locator('.gallery-summary')).toContainText('Escuela no catalogada 9998123');
  await expect(page.locator('[data-gallery-record]')).toHaveValue('1234567:9998123-B01-P00-E001-H01');
});

test('separa fotos vinculadas y fotos sin registro en el control administrativo', async ({ page }) => {
  await page.evaluate(() => {
    const key = 'cialpa-fotos-demo-data-v1';
    const data = JSON.parse(localStorage.getItem(key));
    const recordKey = '1234567:11007-B01-P00-E001-H01';
    data.records.push({
      recordKey,
      recordId: '11007-B01-P00-E001-H01',
      codigoCensista: '1234567', codigoEscuela: '11007',
      estado: 'FINALIZADO', cantidadFotos: 1, updatedAt: new Date().toISOString()
    });
    data.photos.push(
      { fotoId: 'FOTO-VINCULADA', recordKey, codigoCensista: '1234567', codigoEscuela: '11007' },
      { fotoId: 'FOTO-HUERFANA', recordKey: 'REGISTRO-INEXISTENTE', codigoCensista: '1234567', codigoEscuela: '11007' }
    );
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.locator('[data-view="admin"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Integridad registro–foto' })).toBeVisible();
  await expect(page.locator('.data-quality-panel')).toContainText('FOTO-HUERFANA');
  await expect(page.locator('.data-quality-panel')).toContainText('REVISAR');
  await expect(page.locator('.admin-summary')).toContainText('Fotos vinculadas');
  await expect(page.locator('.admin-summary')).toContainText('1 sin registro');
});

test('muestra Editar para un registro antiguo con codigo numerico y sin recordKey', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'registro-antiguo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#edf3f8"/></svg>')
  });
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();

  await page.evaluate(() => {
    const key = 'cialpa-fotos-demo-data-v1';
    const data = JSON.parse(localStorage.getItem(key));
    data.records[0].codigoCensista = Number(data.records[0].codigoCensista);
    delete data.records[0].recordKey;
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.removeItem('cialpa-fotos-records-cache-v1');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
  await page.locator('[data-view="pending"]:visible').first().click();
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { name: 'Editar registro' })).toBeVisible();
  await expect(page.locator('.photo-item.is-synced')).toHaveCount(1);
});

test('controla GPS al finalizar y explicacion de pendientes', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'control-cierre.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#e7eef4"/></svg>')
  });
  await expect(page.locator('.photo-item')).toHaveCount(1);
  await page.locator('select[name="estado"]').selectOption('FINALIZADO');
  await expect(page.locator('select[name="estado"]')).toHaveValue('FINALIZADO');
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByText('Obtenga el GPS antes de marcar el registro como Finalizado.')).toBeVisible();
  await expect(page.locator('#record-form')).toBeVisible();

  await page.locator('select[name="estado"]').selectOption('CON_PENDIENTES');
  await expect(page.locator('select[name="estado"]')).toHaveValue('CON_PENDIENTES');
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByText('Describa en Observaciones que falta y la accion requerida.')).toBeVisible();
  await expect(page.locator('#record-form')).toBeVisible();
});

test('expone control administrativo y resumen por censista', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avance por censista' })).toBeVisible();
  await expect(page.locator('.operations-tab.is-active')).toContainText('Resumen');
  await expect(page.getByRole('heading', { name: 'Compatibilidad RUE' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conciliar con RUE' })).toBeVisible();
});

test('genera un manifiesto de conciliacion RUE con sede, espacio y evidencia', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'compatibilidad-rue.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dbe8ef"/></svg>')
  });
  await page.getByRole('button', { name: /Finalizar y sincronizar/ }).click();
  await expect(page.getByRole('heading', { name: 'Mi jornada' })).toBeVisible();

  await page.getByRole('button', { name: 'Control' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Conciliar con RUE' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cialpa-compatibilidad-rue-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = fs.readFileSync(await download.path(), 'utf8');
  expect(content).toContain('"contrato_version";"codigo_establecimiento_rue"');
  expect(content).toContain('"RUE-CIALPA-1.0";"0011007";"11007"');
  expect(content).toContain('"CIALPA-S001"');
  expect(content).toContain('"AULA"');
  expect(content).toContain('"COMPATIBLE"');
});

test('administra encuestadores y conserva la cuenta principal protegida', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="surveyors"]').click();
  await expect(page.getByRole('heading', { name: 'Administrar encuestadores' })).toBeVisible();
  await expect(page.getByText('Protegido', { exact: true })).toBeVisible();

  await page.getByLabel('Codigo operativo / cedula').fill('4567890');
  await page.getByLabel('Nombres').fill('Carla');
  await page.getByLabel('Apellidos').fill('Benitez');
  await page.getByLabel('Telefono').fill('0981000003');
  await page.getByLabel('PIN inicial').fill('4321');
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText('Carla Benitez', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Carla Benitez' }).click();
  await expect(page.getByRole('heading', { name: 'Editar usuario' })).toBeVisible();
  await expect(page.getByLabel('Codigo operativo / cedula')).toHaveAttribute('readonly', '');
});

test('crea e inactiva equipos sin eliminar su historial', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="surveyors"]').click();
  await expect(page.getByRole('heading', { name: 'Gestion de equipos', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Crear equipo' }).click();
  const editor = page.locator('.team-editor');
  await editor.getByLabel('Nombre del equipo').fill('Equipo 9');
  await editor.getByLabel('Coordinador').selectOption('1234567');
  await editor.getByLabel('Notas').fill('Prueba de gestion trazable');
  await editor.getByRole('button', { name: 'Crear equipo' }).click();
  const card = page.locator('.team-card').filter({ hasText: 'Equipo 9' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Activo');

  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Inactivar' }).click();
  await expect(page.getByText(/Equipo inactivado/)).toBeVisible();
  await expect(page.locator('.team-card').filter({ hasText: 'Equipo 9' })).toContainText('Inactivo');
});

test('inactiva y reactiva una asignacion conservando la fila historica', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="logistics"]').click();
  await expect(page.getByRole('heading', { name: 'Logistica de campo' })).toBeVisible();

  const row = page.locator('tr').filter({ has: page.locator('[data-logistics-assignment="11007"]') });
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Inactivar' }).click();
  await expect(page.getByText('Asignacion inactivada sin eliminar el historial.')).toBeVisible();
  const storedInactive = await page.evaluate(() => JSON.parse(localStorage.getItem('cialpa-fotos-demo-data-v1'))
    .assignments.filter((item) => item.codigoEscuela === '11007'));
  expect(storedInactive).toHaveLength(1);
  expect(storedInactive[0].activo).toBe(false);

  const refreshedRow = page.locator('tr').filter({ has: page.locator('[data-logistics-assignment="11007"]') });
  await refreshedRow.locator('[data-logistics-assignment="11007"]').selectOption('2345678');
  page.once('dialog', (dialog) => dialog.accept());
  await refreshedRow.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByText('Asignacion activada sin eliminar el historial.')).toBeVisible();
  const storedActive = await page.evaluate(() => JSON.parse(localStorage.getItem('cialpa-fotos-demo-data-v1'))
    .assignments.filter((item) => item.codigoEscuela === '11007'));
  expect(storedActive).toHaveLength(1);
  expect(storedActive[0].activo).toBe(true);
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

test('conserva la ficha offline y la sincroniza al recuperar conexion', async ({ page, context }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[data-photo-input="EVIDENCIA"]').setInputFiles({
    name: 'contingencia-offline.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#eaf0f5"/></svg>')
  });
  await context.setOffline(true);
  await expect(page.getByText('Sin conexion', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Finalizar y guardar en cola/ }).click();
  await expect(page.getByRole('heading', { name: 'Mi jornada' })).toBeVisible();
  await expect(page.locator('.queue-list .list-card')).toHaveCount(2);
  await expect(page.locator('.sync-queue-notice')).toContainText('Este dispositivo conserva 2 operaciones que aun no llegaron al servidor.');
  await expect(page.getByText('Registro guardado en la cola local.')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Todo esta sincronizado.')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.queue-list .list-card')).toHaveCount(0);
  await expect(page.locator('.sync-queue-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
});

test('recupera un borrador despues de cerrar o recargar la app', async ({ page }) => {
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await page.locator('input[name="numeroFormulario"]').fill('77');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
  await page.locator('[data-view="pending"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Borradores locales' })).toBeVisible();
  await expect(page.locator('.draft-list .list-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('input[name="numeroFormulario"]')).toHaveValue('77');
});

test('registra una ausencia y recalcula la capacidad del equipo', async ({ page }) => {
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('.operations-tab[data-view="surveyors"]').click();
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') await dialog.accept('Contingencia de prueba');
    else await dialog.accept();
  });
  await page.getByRole('button', { name: 'Registrar ausencia de Ana Lopez' }).click();
  await expect(page.getByText('Ausencia registrada y plazo recalculado.')).toBeVisible();
  await page.locator('.operations-tab[data-view="admin"]').click();
  await expect(page.getByRole('heading', { name: 'KPIs y contingencias por equipo' })).toBeVisible();
  await expect(page.getByText('Sin personal disponible')).toBeVisible();
});

test('controla una respuesta demorada y limpia el transporte temporal', async ({ page }) => {
  await page.route('https://script.google.com/sin-respuesta', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Sin respuesta</title>'
    });
  });
  const result = await page.evaluate(async () => {
    const { ApiClient } = await import('/assets/js/api.js?timeout-test=1');
    const api = new ApiClient({
      demo: false,
      gasExecUrl: 'https://script.google.com/sin-respuesta',
      version: '1.4.0'
    });
    try {
      await api.request('health', {}, { timeout: 100 });
      return { code: 'NO_TIMEOUT' };
    } catch (error) {
      return {
        code: error.code,
        iframes: document.querySelectorAll('iframe[name^="cialpa-gas-"]').length,
        forms: document.querySelectorAll('form[target^="cialpa-gas-"]').length
      };
    }
  });
  expect(result).toEqual({ code: 'TIMEOUT', iframes: 0, forms: 0 });
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
    ['guide', 'Guia de campo'],
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
