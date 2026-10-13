import { expect, test, type Route } from '@playwright/test'
import {
  applyOperation,
  type Task,
  type TaskOperation,
} from '../../src/lib/tasks'

// Route mocks and service workers interfere on Firefox/WebKit. The dedicated
// offline suite verifies the real worker; this suite isolates the sync transport.
test.use({ serviceWorkers: 'block' })

test('synchronizes two devices and replays an offline edit after reconnection', async ({
  page,
  context,
  browser,
}) => {
  let tasks: Task[] = []
  const receipts = new Set<string>()
  let firstOnline = true
  const key = 'e2e-personal-workspace-key'
  const config = {
    syncEnabled: true,
    spaceId: 'e2e-space',
    pushEnabled: false,
    pushPublicKey: null,
  }
  const handler = (online: () => boolean) => async (route: Route) => {
    if (!online()) {
      await route.abort('internetdisconnected')
      return
    }
    const request = route.request()
    if (new URL(request.url()).pathname === '/api/config') {
      await route.fulfill({ json: config })
      return
    }
    if (request.headers().authorization !== `Bearer ${key}`) {
      await route.fulfill({
        status: 401,
        json: { error: 'Перевір ключ твого простору.' },
      })
      return
    }
    const operations: TaskOperation[] = request.postDataJSON().operations
    for (const operation of operations)
      if (!receipts.has(operation.id)) {
        tasks = applyOperation(tasks, operation)
        receipts.add(operation.id)
      }
    await route.fulfill({
      json: {
        tasks,
        acknowledged: operations.map((operation) => operation.id),
        spaceId: config.spaceId,
      },
    })
  }
  await page.route(
    '**/api/**',
    handler(() => firstOnline),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Нова задача' }).click()
  await page.getByLabel('Назва', { exact: true }).fill('Спільна задача')
  await page.getByRole('button', { name: 'Додати задачу', exact: true }).click()
  await page.getByRole('button', { name: 'Налаштування' }).click()
  await page.getByLabel('Ключ твого простору').fill(key)
  await page
    .getByRole('button', { name: 'Під’єднати пристрій', exact: true })
    .click()
  await expect(
    page.getByText('Усі зміни синхронізовано.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Закрити', exact: true }).click()

  const secondContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
  })
  try {
    const second = await secondContext.newPage()
    await second.route(
      '**/api/**',
      handler(() => true),
    )
    await second.goto('/')
    await second.getByRole('button', { name: 'Налаштування' }).click()
    await second.getByLabel('Ключ твого простору').fill(key)
    await second
      .getByRole('button', { name: 'Під’єднати пристрій', exact: true })
      .click()
    await expect(
      second.getByText('Усі зміни синхронізовано.', { exact: true }),
    ).toBeVisible()
    await second.getByRole('button', { name: 'Закрити', exact: true }).click()
    await expect(
      second.getByText('Спільна задача', { exact: true }),
    ).toBeVisible()

    firstOnline = false
    await context.setOffline(true)
    await page
      .getByRole('button', { name: 'Спільна задача', exact: true })
      .click()
    await page.getByLabel('Назва', { exact: true }).fill('Оновлено офлайн')
    await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('swask.tasks.v1')!).pending.length,
      ),
    ).toBe(1)
    firstOnline = true
    await context.setOffline(false)
    await expect.poll(() => tasks[0]?.title).toBe('Оновлено офлайн')
    await second.getByRole('button', { name: 'Налаштування' }).click()
    await second
      .getByRole('button', { name: 'Синхронізувати', exact: true })
      .click()
    await expect
      .poll(() =>
        second.evaluate(
          () =>
            JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].title,
        ),
      )
      .toBe('Оновлено офлайн')
    await second.getByRole('button', { name: 'Закрити', exact: true }).click()
    await expect(
      second.getByText('Оновлено офлайн', { exact: true }),
    ).toBeVisible()
  } finally {
    await secondContext.close()
  }
})
