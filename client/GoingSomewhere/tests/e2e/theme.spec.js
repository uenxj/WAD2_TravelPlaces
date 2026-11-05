import { test, expect } from 'playwright/test'

// The light / dark theme switch in the header (src/composables/useTheme.js, src/styles/app.css).
// Each test starts in a fresh browser context, so nothing is saved yet.

test.beforeEach(async ({ page }) => {
  // The globe loads its pictures from unpkg; not needed here, and keeps the test offline.
  await page.route('https://unpkg.com/**', route => route.abort())
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { error: 'Please log in to continue' } }))
})

const htmlTheme = page => page.locator('html')
// The visible page colour is the app shell's (it covers the whole window).
const pageBackground = page => page.locator('.app-shell').evaluate(el => getComputedStyle(el).backgroundColor)

test('dark is the default when nothing is saved', async ({ page }) => {
  await page.goto('/discover')
  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'dark')
  const toggle = page.getByTestId('theme-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toHaveAccessibleName('Switch to light theme')
  expect(await pageBackground(page)).toBe('rgb(16, 26, 46)') // the original navy
})

test('the toggle switches to light, and the choice survives a reload', async ({ page }) => {
  await page.goto('/discover')
  const toggle = page.getByTestId('theme-toggle')
  await toggle.click()

  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggle).toHaveAccessibleName('Switch to dark theme')
  expect(await pageBackground(page)).toBe('rgb(251, 245, 230)') // cream

  await page.reload()
  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'light')
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true')

  // And back again.
  await page.getByTestId('theme-toggle').click()
  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'dark')
})

test('the saved theme is applied before the app starts (no flash of the wrong theme)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gs-theme', 'light'))
  // Hold the app's script back: the page must already be light before any Vue code runs.
  await page.route('**/src/main.js', route => new Promise(resolve => setTimeout(() => resolve(route.continue()), 500)))
  await page.goto('/discover', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.documentElement.dataset.theme !== undefined)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
})

test('a broken saved value falls back to dark', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gs-theme', 'purple'))
  await page.goto('/discover')
  await expect(htmlTheme(page)).toHaveAttribute('data-theme', 'dark')
})

test('the toggle is reachable on a phone and has a 44px touch target', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/discover')
  const toggle = page.getByTestId('theme-toggle')
  await expect(toggle).toBeVisible()
  const box = await toggle.boundingBox()
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
