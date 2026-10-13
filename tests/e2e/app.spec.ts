import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test.use({ timezoneId: 'Europe/Kyiv' })

const savedTask = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Read',
  description: '',
  deadline: '2026-10-13',
  link: '',
  completed: false,
  deleted: false,
  createdAt: '2026-10-12T09:00:00.000Z',
  updatedAt: '2026-10-12T09:00:00.000Z',
}

test('opens swask in Ukrainian without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Звільни місце для важливого.' }),
  ).toBeVisible()
  expect(await page.locator('html').getAttribute('lang')).toBe('uk')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
test('creates, opens, edits, persists and completes a task', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Нова задача' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Назва', { exact: true })
    .fill('Підготувати презентацію')
  await dialog.getByLabel('Опис').fill('Показати swask команді')
  await dialog.getByLabel('Дедлайн').fill('2026-10-14')
  await dialog.getByLabel('Посилання').fill('https://example.com/task')
  await dialog.getByRole('button', { name: 'Додати задачу' }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await page
    .getByRole('button', {
      name: 'Підготувати презентацію Показати swask команді',
    })
    .click()
  await expect(dialog.getByLabel('Посилання')).toHaveValue(
    'https://example.com/task',
  )
  await dialog.getByLabel('Назва', { exact: true }).fill('Готова презентація')
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click()
  await page
    .getByRole('button', { name: 'Завершити: Готова презентація' })
    .click()
  await page.getByRole('button', { name: /^Зроблено / }).click()
  await expect(
    page.getByText('Готова презентація', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Повернути: Готова презентація' })
    .click()
  await page.getByRole('button', { name: /^У плані / }).click()
  await expect(
    page.getByText('Готова презентація', { exact: true }),
  ).toBeVisible()
})
test('supports keyboard opening and Escape while protecting corrupted data', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('swask.tasks.v1', 'broken'),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('недоторканими')
  await expect(page.getByRole('button', { name: 'Нова задача' })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: /^Додай першу задачу/ }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Налаштування' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('swask.tasks.v1')),
  ).toBe('broken')
})
test('clears yesterday’s date filter after midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T20:59:30.000Z') })
  await page.addInitScript(
    (task) =>
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({
          version: 1,
          tasks: [
            task,
            {
              ...task,
              id: '00000000-0000-4000-8000-000000000002',
              title: 'Tomorrow',
              deadline: '2026-10-14',
            },
          ],
          pending: [],
        }),
      ),
    savedTask,
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Показати 13 жовтня' }).click()
  await expect(
    page.getByRole('button', { name: 'Tomorrow', exact: true }),
  ).toHaveCount(0)
  await page.clock.fastForward(60_000)
  await expect(
    page.getByRole('button', { name: 'Tomorrow', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Усі дні/ })).toHaveCount(0)
})
test('shows only the selected day’s empty state when other tasks exist', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-13T10:00:00.000Z') })
  await page.addInitScript(
    (task) =>
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({ version: 1, tasks: [task], pending: [] }),
      ),
    savedTask,
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Показати 14 жовтня' }).click()
  await expect(page.getByText('На цей день задач немає.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Додай першу задачу/ }),
  ).toHaveCount(0)
})
test('keeps an older completion out of today’s statistics after editing', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-13T10:00:00.000Z') })
  await page.addInitScript(
    (task) =>
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({
          version: 1,
          tasks: [{ ...task, completed: true }],
          pending: [],
        }),
      ),
    savedTask,
  )
  await page.goto('/')
  await page.getByRole('button', { name: /^Зроблено / }).click()
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Назва', { exact: true })
    .fill('Edited')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Зберегти', exact: true })
    .click()
  await expect(
    page
      .locator('.pace-stats div')
      .filter({ hasText: 'зроблено сьогодні' })
      .locator('strong'),
  ).toHaveText('0')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0]
          .completedAt,
    ),
  ).toBe(savedTask.updatedAt)
})
test('downloads even empty corrupted storage before recovery', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('swask.tasks.v1', ''))
  await page.goto('/')
  await page.getByRole('button', { name: 'Налаштування' }).click()
  const download = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Завантажити дані', exact: true })
    .click()
  const file = await download
  expect(file.suggestedFilename()).toBe('swask-recovery.json')
  expect(await readFile((await file.path())!, 'utf8')).toBe('')
  expect(
    await page.evaluate(() => localStorage.getItem('swask.tasks.v1')),
  ).toBe('')
})
test('shows a failed deletion inside the open editor and preserves the task', async ({
  page,
}) => {
  await page.addInitScript(
    (task) =>
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({ version: 1, tasks: [task], pending: [] }),
      ),
    savedTask,
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'swask.tasks.v1')
        throw new DOMException('quota', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Видалити задачу' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Не вдалося зберегти зміни',
  )
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deleted,
    ),
  ).toBe(false)
})
