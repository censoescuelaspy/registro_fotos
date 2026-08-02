const { test, expect } = require('@playwright/test');

test('carga completa de escuela simulada con 75 registros y 300 fotografias', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const startedAt = Date.now();
  await page.goto('/?demo=1&loadtest=1');
  await page.getByLabel('Usuario, codigo operativo o cedula').fill('1234567');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas' })).toBeVisible();
  await expect(page.locator('.load-test-banner')).toContainText('No utiliza el libro productivo');
  const metadataLoadMs = Date.now() - startedAt;

  await expect(page.locator('[data-action="select-school"]')).toHaveCount(87);
  const testSchool = page.locator('[data-action="select-school"][data-school="9999001"]');
  await expect(testSchool).toContainText('ESCUELA FICTICIA DE PRUEBA DE CARGA');
  await page.locator('[data-view="photos"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Fotografias por escuela' })).toBeVisible();
  await expect(page.locator('[data-gallery-school]')).toHaveValue('9999001');

  const recordSelect = page.locator('[data-gallery-record]');
  await expect(recordSelect.locator('option')).toHaveCount(75);
  const recordKeys = await recordSelect.locator('option').evaluateAll((options) => options.map((option) => option.value));
  const galleryStartedAt = Date.now();
  let loadedPhotos = 0;
  for (const recordKey of recordKeys) {
    await recordSelect.selectOption(recordKey);
    await expect(page.locator('.gallery-card')).toHaveCount(4);
    await expect.poll(async () => page.locator('.gallery-image img').evaluateAll((images) => images.filter((image) => image.naturalWidth > 0).length)).toBe(4);
    await expect(page.locator('.gallery-error')).toHaveCount(0);
    loadedPhotos += 4;
  }
  const galleryLoadMs = Date.now() - galleryStartedAt;
  const browserMetrics = await page.evaluate(() => ({
    localStorageBytes: Object.entries(localStorage).reduce((sum, [key, value]) => sum + (key.length + value.length) * 2, 0),
    usedJsHeapBytes: performance.memory?.usedJSHeapSize || null,
    totalJsHeapBytes: performance.memory?.totalJSHeapSize || null
  }));
  const metrics = {
    schoolCode: '9999001',
    schoolsVisible: 87,
    records: recordKeys.length,
    photosLoaded: loadedPhotos,
    metadataLoadMs,
    galleryLoadMs,
    totalMs: Date.now() - startedAt,
    ...browserMetrics
  };
  console.log(`SIMULATED_SCHOOL_LOAD ${JSON.stringify(metrics)}`);
  await testInfo.attach('simulated-school-load.json', {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: 'application/json'
  });
  expect(metrics.records).toBe(75);
  expect(metrics.photosLoaded).toBe(300);
  expect(metrics.galleryLoadMs).toBeLessThan(90000);
});
