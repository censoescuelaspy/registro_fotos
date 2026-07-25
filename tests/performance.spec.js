const { test, expect } = require('@playwright/test');

test('recalcula el plazo cuando falta un integrante del equipo', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const { contingencyForecast } = await import('/assets/js/performance.js');
    return {
      complete: contingencyForecast({
        pendingSchools: 12,
        baseMinutes: 45,
        hoursPerDay: 6,
        totalMembers: 2,
        availableMembers: 2
      }),
      oneAbsent: contingencyForecast({
        pendingSchools: 12,
        baseMinutes: 45,
        hoursPerDay: 6,
        totalMembers: 2,
        availableMembers: 1
      }),
      allAbsent: contingencyForecast({
        pendingSchools: 12,
        baseMinutes: 45,
        hoursPerDay: 6,
        totalMembers: 2,
        availableMembers: 0
      })
    };
  });
  expect(result.complete.baselineDays).toBe(1.5);
  expect(result.complete.estimatedDays).toBe(1.5);
  expect(result.oneAbsent.capacityFactor).toBe(0.5);
  expect(result.oneAbsent.estimatedDays).toBe(3);
  expect(result.oneAbsent.delayDays).toBe(1.5);
  expect(result.allAbsent.blocked).toBe(true);
  expect(result.allAbsent.estimatedDays).toBeNull();
});

test('muestra KPIs individuales y del equipo al censista', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByLabel('Usuario, codigo operativo o cedula').fill('2345678');
  await page.getByLabel('Contrasena / PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.locator('[data-view="pending"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Mi desempeño' })).toBeVisible();
  await expect(page.getByText('Promedio por ficha')).toBeVisible();
  await expect(page.getByText('Demora de sincronizacion')).toBeVisible();
  await expect(page.getByText('Capacidad actual')).toBeVisible();
  await expect(page.getByText('Plazo restante')).toBeVisible();
});
