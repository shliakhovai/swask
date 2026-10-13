import { expect, test } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Налаштування' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('swask.tasks.v1')),
  ).toBe('broken')
})
