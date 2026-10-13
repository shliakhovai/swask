import { expect, test } from '@playwright/test'

test('installs a complete Ukrainian manifest and precaches the application', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const response = await request.get('/manifest.webmanifest')
  const manifest = await response.json()
  expect(manifest.lang).toBe('uk')
  expect(manifest.display).toBe('standalone')
  expect(
    manifest.icons.some(
      (icon: { purpose: string }) => icon.purpose === 'maskable',
    ),
  ).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await expect(
    page.getByText('Готовий до офлайн', { exact: true }),
  ).toBeVisible()
})
test('reloads and persists task edits with the network disconnected', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Працюємо офлайн', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Нова задача' }).click()
  await page.getByLabel('Назва', { exact: true }).fill('Задача без інтернету')
  await page.getByRole('button', { name: 'Додати задачу', exact: true }).click()
  await page.reload()
  await expect(
    page.getByText('Задача без інтернету', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Завершити: Задача без інтернету' })
    .click()
  await page.getByRole('button', { name: /^Зроблено / }).click()
  await expect(
    page.getByText('Задача без інтернету', { exact: true }),
  ).toBeVisible()
  await context.setOffline(false)
})
