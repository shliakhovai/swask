import { expect, test } from '@playwright/test'
import { sample } from '../fixtures/task'

test.use({ timezoneId: 'Europe/Kyiv' })
test('shows a due reminder at the chosen time and keeps dismissal across reloads', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-13T05:59:00Z') })
  await page.addInitScript(
    (task) =>
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({
          version: 1,
          tasks: [{ ...task, deadline: '2026-10-13' }],
          pending: [],
        }),
      ),
    sample,
  )
  await page.goto('/')
  const reminder = page.getByRole('status', {
    name: 'Нагадування про дедлайни',
  })
  await expect(reminder).not.toBeVisible()
  await page.clock.fastForward(61_000)
  await expect(reminder).toContainText('Задачі з дедлайном: 1')
  await page
    .getByRole('button', { name: 'Приховати нагадування сьогодні' })
    .click()
  await page.reload()
  await expect(reminder).not.toBeVisible()
})
test('saves reminder time and the in-app reminder preference', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Налаштування' }).click()
  await page.getByLabel('Час нагадування', { exact: true }).fill('10:30')
  await page.getByLabel('Показувати нагадування в застосунку').uncheck()
  await page.getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Налаштування' }).click()
  await expect(page.getByLabel('Час нагадування', { exact: true })).toHaveValue(
    '10:30',
  )
  await expect(
    page.getByLabel('Показувати нагадування в застосунку'),
  ).not.toBeChecked()
})
test('receives a simulated push in the actual production service worker', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium' || process.platform === 'darwin',
    'The real-worker notification check runs in Chromium on Linux CI; macOS headless blocks notification permissions. No provider is contacted.',
  )
  await context.grantPermissions(['notifications'], {
    origin: 'http://127.0.0.1:4173',
  })
  const session = await context.newCDPSession(page)
  let registrationId: string | undefined
  session.on(
    'ServiceWorker.workerRegistrationUpdated',
    (event: {
      registrations: {
        scopeURL: string
        registrationId: string
        isDeleted: boolean
      }[]
    }) => {
      registrationId =
        event.registrations.find(
          (registration) =>
            registration.scopeURL === 'http://127.0.0.1:4173/' &&
            !registration.isDeleted,
        )?.registrationId ?? registrationId
    },
  )
  await session.send('ServiceWorker.enable')
  await page.goto('/')
  expect(await page.evaluate(() => Notification.permission)).toBe('granted')
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await expect.poll(() => registrationId).toBeTruthy()
  await session.send('ServiceWorker.deliverPushMessage', {
    origin: 'http://127.0.0.1:4173',
    registrationId: registrationId!,
    data: JSON.stringify({
      title: 'swask · Нагадування',
      body: 'Тестова задача',
      tag: 'swask-push-test',
    }),
  })
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map(
          (notification) => ({
            title: notification.title,
            body: notification.body,
            tag: notification.tag,
          }),
        ),
      ),
    )
    .toEqual([
      {
        title: 'swask · Нагадування',
        body: 'Тестова задача',
        tag: 'swask-push-test',
      },
    ])
  await page.evaluate(async () => {
    for (const notification of await (
      await navigator.serviceWorker.ready
    ).getNotifications())
      notification.close()
  })
})
