const { test, expect } = require('@playwright/test');

test('ofrece ayuda contextual accesible basada en el manual', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();

  const userHelp = page.getByRole('button', { name: 'Informacion: Usuario de acceso' }).first();
  await expect(userHelp).toBeVisible();
  await userHelp.click();
  const dialog = page.getByRole('dialog', { name: 'Usuario de acceso' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('codigo operativo o la cedula');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByLabel('Usuario, codigo operativo o cedula').fill('1234567');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.locator('[data-action="select-school"]').first().click();
  await page.locator('[data-action="start-record"]').click();
  await expect(page.getByRole('heading', { name: 'Nuevo registro', exact: true })).toBeVisible();
  expect(await page.locator('#record-form .context-help-button').count()).toBeGreaterThanOrEqual(12);

  await page.getByRole('button', { name: 'Informacion: Bloque' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Bloque' })).toContainText('misma numeracion del croquis y de RUE');
  await page.getByRole('button', { name: 'Informacion: Evidencia fotografica' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Evidencia fotografica' })).toContainText('contexto, posicion, detalle y hoja');
});

test('el supervisor ve solo las escuelas y los integrantes de su equipo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByLabel('Usuario, codigo operativo o cedula').fill('5678901');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('heading', { name: 'Escuelas asignadas', exact: true })).toBeVisible();
  await expect(page.locator('[data-action="select-school"]')).toHaveCount(1);
  await expect(page.locator('[data-action="select-school"][data-school="11007"]')).toBeVisible();
  await expect(page.locator('[data-action="select-school"][data-school="10038"]')).toHaveCount(0);
  await expect(page.locator('[data-view="photos"]:visible').first()).toBeVisible();

  await page.getByRole('button', { name: 'Control' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen de Equipo 1', exact: true })).toBeVisible();
  const progressSection = page.getByRole('heading', { name: 'Avance por censista', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(progressSection.getByText('Ana Lopez', { exact: true })).toBeVisible();
  await expect(page.getByText('Bruno Diaz', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

  await page.locator('.operations-tab[data-view="surveyors"]').click();
  await expect(page.getByRole('heading', { name: 'Equipos coordinados', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gestion de equipos', exact: true })).toBeVisible();
  await expect(page.getByText('Equipo 1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Ana Lopez', { exact: true })).toBeVisible();
  await expect(page.locator('.data-table-wrap').getByText('Sofia Supervisora', { exact: true })).toBeVisible();
  await expect(page.getByText('Bruno Diaz', { exact: true })).toHaveCount(0);

  await page.locator('.operations-tab[data-view="logistics"]').click();
  await expect(page.getByRole('heading', { name: 'Logistica de campo', exact: true })).toBeVisible();
  await expect(page.locator('[data-logistics-assignment]')).toHaveCount(1);
});

test('el encuestador dispone de la galeria para sus escuelas autorizadas', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByLabel('Usuario, codigo operativo o cedula').fill('2345678');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Escuelas asignadas', exact: true })).toBeVisible();
  await page.locator('[data-view="photos"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Fotografias por escuela' })).toBeVisible();
  await expect(page.locator('.view-gallery')).toBeVisible();
});
