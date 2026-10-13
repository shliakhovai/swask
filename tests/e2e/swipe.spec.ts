import { expect, test } from '@playwright/test'
import { sample } from '../fixtures/task'

test.use({ timezoneId: 'Europe/Kyiv' })
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T10:00:00.000Z') })
  await page.addInitScript((task) => {
    if (localStorage.getItem('swask.tasks.v1') !== null) return
    localStorage.setItem(
      'swask.tasks.v1',
      JSON.stringify({ version: 1, tasks: [task], pending: [] }),
    )
  }, sample)
  await page.goto('/')
  await page.getByRole('button', { name: 'Свайпи', exact: true }).click()
})
test('skips without completing and returns in the next round', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Свайп вправо — наступне коло' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Коло завершено.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Почати нове коло' }).click()
  await expect(
    page.getByRole('heading', { name: 'Read', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].completed,
    ),
  ).toBe(false)
})
test('uses keyboard completion and supports undo', async ({ page }) => {
  await page
    .getByRole('article', { name: 'Картка задачі: Read' })
    .press('ArrowLeft')
  await expect(
    page.getByRole('heading', { name: 'Усе в твоїх руках.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Read', exact: true }),
  ).toBeVisible()
})
test('cancels then postpones from the future deadline', async ({ page }) => {
  await page.getByRole('button', { name: 'Свайп вгору — перенести' }).click()
  await page.getByRole('dialog').press('Escape')
  await expect(
    page.getByRole('heading', { name: 'Read', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('article', { name: 'Картка задачі: Read' })
    .press('ArrowUp')
  await page.getByRole('button', { name: /^На 3 дні/ }).click()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deadline,
    ),
  ).toBe('2026-10-17')
  await page.getByRole('button', { name: 'Почати нове коло' }).click()
  await expect(page.getByText('17 жовтня', { exact: true })).toBeVisible()
})
test('recognizes a real pointer drag and keeps the mobile layout within the viewport', async ({
  page,
}) => {
  const card = page.getByRole('article', { name: 'Картка задачі: Read' })
  const box = await card.boundingBox()
  if (!box) throw new Error('Missing swipe card')
  await page.mouse.move(box.x + box.width / 2, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 110, box.y + 140, { steps: 8 })
  await page.mouse.up()
  await expect(
    page.getByRole('heading', { name: 'Коло завершено.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
test('keeps keyboard focus while advancing through multiple cards', async ({
  page,
}) => {
  await page.evaluate((task) => {
    localStorage.setItem(
      'swask.tasks.v1',
      JSON.stringify({
        version: 1,
        pending: [],
        tasks: [
          task,
          {
            ...task,
            id: '00000000-0000-4000-8000-000000000002',
            title: 'Second',
            deadline: '2026-10-15',
          },
          {
            ...task,
            id: '00000000-0000-4000-8000-000000000003',
            title: 'Third',
            deadline: '2026-10-16',
          },
        ],
      }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: 'swask.tasks.v1' }))
  }, sample)
  await page.getByRole('article', { name: 'Картка задачі: Read' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('article', { name: 'Картка задачі: Second' }),
  ).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('article', { name: 'Картка задачі: Third' }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks.find(
          (task: { title: string }) => task.title === 'Second',
        ).completed,
    ),
  ).toBe(true)
})
test('undoes postponement and restores the persisted deadline and current card', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Свайп вгору — перенести' }).click()
  await page.getByRole('button', { name: /^На 3 дні/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Коло завершено.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deadline,
    ),
  ).toBe('2026-10-17')
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click()
  await expect(
    page.getByRole('article', { name: 'Картка задачі: Read' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deadline,
    ),
  ).toBe(sample.deadline)
  await page.getByRole('button', { name: 'За днями', exact: true }).click()
  await page.reload()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deadline,
    ),
  ).toBe(sample.deadline)
})
test('disables postponement past the last supported date without damaging storage', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Деталі та редагування ↗' }).click()
  await page.getByRole('dialog').getByLabel('Дедлайн').fill('9999-12-24')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Зберегти', exact: true })
    .click()
  await page.getByRole('button', { name: 'Свайп вгору — перенести' }).click()
  await page.getByRole('button', { name: /^На тиждень/ }).click()
  await page.getByRole('button', { name: 'Почати нове коло' }).click()
  await page.getByRole('button', { name: 'Свайп вгору — перенести' }).click()
  for (const name of [/^На добу/, /^На 3 дні/, /^На тиждень/])
    await expect(
      page.getByRole('dialog').getByRole('button', { name }),
    ).toBeDisabled()
  await page.getByRole('dialog').press('Escape')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('swask.tasks.v1')!).tasks[0].deadline,
    ),
  ).toBe('9999-12-31')
  await expect(
    page.getByRole('article', { name: 'Картка задачі: Read' }),
  ).toBeVisible()
})
