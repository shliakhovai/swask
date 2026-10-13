import { expect, test } from '@playwright/test'

test('opens swask in Ukrainian without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Задачі у твоєму ритмі.' }),
  ).toBeVisible()
  expect(await page.locator('html').getAttribute('lang')).toBe('uk')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
