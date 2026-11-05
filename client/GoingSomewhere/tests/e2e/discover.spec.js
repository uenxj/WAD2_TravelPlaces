import { test, expect } from 'playwright/test'

test('a visitor searches a destination on Discover and sees its card, then closes it', async ({ page }) => {
  await page.route('https://unpkg.com/**', route => route.abort())
  await page.goto('/discover')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Discover somewhere new.')

  await page.getByRole('searchbox', { name: 'Find a destination' }).fill('Tokyo')
  await page.getByRole('button', { name: 'Tokyo Japan' }).click()
  await expect(page.locator('.dest-card h1.place')).toHaveText('Tokyo,')

  await page.locator('.dest-card').getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.dest-card')).toHaveCount(0)
})

test('the card shows the tourist count for the destination country', async ({ page }) => {
  await page.route('https://unpkg.com/**', route => route.abort())
  let countryAsked = ''
  await page.route('https://api.api-ninjas.com/**', route => {
    countryAsked = new URL(route.request().url()).searchParams.get('name')
    return route.fulfill({ json: [{ tourists: 1234567 }] })
  })

  await page.goto('/discover?destination=tokyo')
  await expect(page.locator('.dest-card').getByText('1,234,567')).toBeVisible()
  expect(countryAsked).toBe('Japan')
})