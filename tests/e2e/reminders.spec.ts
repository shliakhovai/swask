import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { sample } from '../fixtures/task'
import { installPushBoundary } from '../fixtures/push-boundary'
import type { PushProbe } from '../fixtures/push-boundary'

test.use({ timezoneId: 'Europe/Kyiv' })
test('protects corrupt reminder preferences and recovers them without deleting tasks', async ({
  page,
}) => {
  const raw = '{"version":2,"note":"recover me"}'
  await page.addInitScript(
    ({ raw, task }) => {
      if (localStorage.getItem('swask.reminders.v1') === null)
        localStorage.setItem('swask.reminders.v1', raw)
      if (localStorage.getItem('swask.tasks.v1') === null)
        localStorage.setItem(
          'swask.tasks.v1',
          JSON.stringify({ version: 1, tasks: [task], pending: [] }),
        )
    },
    { raw, task: sample },
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Налаштування' }).click()
  await expect(
    page.getByLabel('Час нагадування', { exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByLabel('Показувати нагадування в застосунку'),
  ).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'недоторканими',
  )
  const download = page.waitForEvent('download')
  await page
    .getByRole('button', {
      name: 'Завантажити налаштування нагадувань',
      exact: true,
    })
    .click()
  expect(await readFile((await (await download).path())!, 'utf8')).toBe(raw)
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', {
      name: 'Скинути налаштування нагадувань',
      exact: true,
    })
    .click()
  await expect(
    page.getByLabel('Час нагадування', { exact: true }),
  ).toBeEnabled()
  await page.getByRole('dialog').press('Escape')
  await page.reload()
  await page.getByRole('button', { name: 'Налаштування' }).click()
  await expect(page.getByLabel('Час нагадування', { exact: true })).toHaveValue(
    '09:00',
  )
  await expect(
    page.getByRole('button', {
      name: 'Скинути налаштування нагадувань',
      exact: true,
    }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].title,
    ),
  ).toBe(sample.title)
})
test('can opt out after notification permission is revoked without requesting permission again', async ({
  page,
  baseURL,
}) => {
  const server = await installPushBoundary(
    page,
    {
      permission: 'denied',
      existing: true,
    },
    baseURL!,
  )
  try {
    await page.goto(server.url)
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Налаштування' }).click()
    await page
      .getByRole('button', { name: 'Вимкнути push-нагадування', exact: true })
      .click()
    await expect(
      page.getByRole('button', {
        name: 'Увімкнути push-нагадування',
        exact: true,
      }),
    ).toBeVisible()
    expect(server.calls.map((call) => call.method)).toEqual(['DELETE'])
    const probe = await page.evaluate(
      () => (window as unknown as { swaskPushProbe: PushProbe }).swaskPushProbe,
    )
    expect(probe).toMatchObject({
      active: false,
      permissionRequests: 0,
      unsubscribes: 1,
    })
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('swask.reminders.v1')!).push,
      ),
    ).toBe(false)
  } finally {
    await server.close()
    if (!page.isClosed()) await page.goto('about:blank').catch(() => {})
  }
})
test('compensates server opt-in when the browser cannot persist its preference', async ({
  page,
  baseURL,
}) => {
  const server = await installPushBoundary(
    page,
    {
      permission: 'granted',
      existing: false,
      storageFails: true,
    },
    baseURL!,
  )
  try {
    await page.goto(server.url)
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Налаштування' }).click()
    await page
      .getByRole('button', { name: 'Увімкнути push-нагадування', exact: true })
      .click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Не вдалося зберегти налаштування',
    )
    await expect(
      page.getByRole('button', {
        name: 'Увімкнути push-нагадування',
        exact: true,
      }),
    ).toBeEnabled()
    expect(server.calls.map((call) => call.method)).toEqual(['POST', 'DELETE'])
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { swaskPushProbe: PushProbe }).swaskPushProbe
            .active,
      ),
    ).toBe(false)
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('swask.reminders.v1')!).push,
      ),
    ).toBe(false)
  } finally {
    await server.close()
    if (!page.isClosed()) await page.goto('about:blank').catch(() => {})
  }
})
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
    browserName !== 'chromium',
    'CDP push delivery is Chromium-only; the native display boundary is mocked and no provider is contacted.',
  )
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
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await expect.poll(() => registrationId).toBeTruthy()
  const worker = context.serviceWorkers()[0]
  if (!worker) throw new Error('Production service worker is missing')
  await worker.evaluate(() => {
    const scope = self as unknown as ServiceWorkerGlobalScope & {
      capturedNotifications: { title: string; body: string; tag: string }[]
    }
    scope.capturedNotifications = []
    scope.registration.showNotification = async (title, options) => {
      scope.capturedNotifications.push({
        title,
        body: options?.body ?? '',
        tag: options?.tag ?? '',
      })
    }
  })
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
      worker.evaluate(
        () =>
          (
            self as unknown as {
              capturedNotifications: {
                title: string
                body: string
                tag: string
              }[]
            }
          ).capturedNotifications,
      ),
    )
    .toEqual([
      {
        title: 'swask · Нагадування',
        body: 'Тестова задача',
        tag: 'swask-push-test',
      },
    ])
})
