import { expect, test } from '@playwright/test'
import { pwaUpdateServer } from '../fixtures/pwa-update-server'

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
test('waits for open dialogs before activating a real worker update and reloading', async ({
  page,
  baseURL,
}) => {
  const server = await pwaUpdateServer(baseURL!)
  try {
    await page.goto(server.url)
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Нова задача' }).click()
    await page.getByLabel('Назва', { exact: true }).fill('Збережена задача')
    await page
      .getByRole('button', { name: 'Додати задачу', exact: true })
      .click()
    await page.getByRole('button', { name: 'Нова задача' }).click()
    await page.getByLabel('Назва', { exact: true }).fill('Незбережена чернетка')
    server.nextVersion()
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration!.update()
    })
    const update = page.getByRole('button', { name: 'Оновити', exact: true })
    await expect(update).toBeDisabled()
    await expect(page.getByLabel('Назва', { exact: true })).toHaveValue(
      'Незбережена чернетка',
    )
    expect(
      await page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    ).toBe(true)
    await page.getByRole('dialog').press('Escape')
    await page.getByRole('button', { name: 'Налаштування' }).click()
    await expect(update).toBeDisabled()
    await page.getByRole('dialog').press('Escape')
    await expect(update).toBeEnabled()
    const reload = page.waitForEvent('framenavigated', {
      predicate: (frame) => frame === page.mainFrame(),
    })
    await update.click()
    await reload
    await expect(
      page.getByRole('button', { name: 'Збережена задача', exact: true }),
    ).toBeVisible()
    await expect(update).toHaveCount(0)
    const version = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const channel = new MessageChannel()
          const timeout = setTimeout(
            () => reject(new Error('Worker version probe timed out')),
            2000,
          )
          channel.port1.onmessage = (event) => {
            clearTimeout(timeout)
            resolve(event.data as number)
          }
          navigator.serviceWorker.controller!.postMessage(
            'SWASK_TEST_VERSION',
            [channel.port2],
          )
        }),
    )
    expect(version).toBe(2)
    expect(
      await page.evaluate(
        async () =>
          (await navigator.serviceWorker.getRegistration())?.waiting ?? null,
      ),
    ).toBeNull()
  } finally {
    await server.close()
    if (!page.isClosed()) await page.goto('about:blank').catch(() => {})
  }
})
