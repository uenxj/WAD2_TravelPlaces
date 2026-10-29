import { test, expect } from 'playwright/test'

// Keep application-flow checks independent of external service availability.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:3100${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 27 }, current_units: { temperature_2m: '°C' } } }))
  await page.route('https://restcountries.com/**', route => route.abort())
})

async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('guest landing has public navigation and fits the desktop screen', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Managing your travels seamlessly')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Discover' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Trips', exact: true })).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(1)
  await noHorizontalOverflow(page)
  if (testInfo.project.name === 'desktop') {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
  }
  await page.getByRole('link', { name: 'Explore destinations' }).click()
  await expect(page).toHaveURL(/\/discover$/)
})

test('destination planning keeps its context through sign-up and cancellation', async ({ page }) => {
  await page.goto('/discover')
  await page.getByRole('searchbox', { name: 'Find a destination' }).fill('Tokyo')
  await page.getByRole('button', { name: 'Tokyo Japan' }).click()
  await page.getByRole('button', { name: 'Plan a trip here' }).click()
  await expect(page).toHaveURL(/\/login\?/)
  const redirect = new URL(page.url()).searchParams.get('redirect')
  expect(redirect).toContain('/trips/new?destination=Tokyo')
  await expect(page.getByText('Selected destination:')).toContainText('Tokyo')
  await page.reload()
  await expect(page.getByText('Selected destination:')).toContainText('Tokyo')
  await page.getByRole('button', { name: 'Create account', exact: true }).first().click()
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
  await expect(page.getByText('Selected destination:')).toContainText('Tokyo')
  await noHorizontalOverflow(page)
  await page.getByRole('link', { name: 'Continue exploring' }).click()
  await expect(page).toHaveURL(/\/discover/)
})

test('saved places and account routes require login', async ({ page }) => {
  for (const path of ['/trips', '/profile', '/budget', '/saved']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login\?/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
  }
  await page.goto('/discover?destination=paris')
  await page.getByRole('button', { name: 'Save place', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('intent')).toBe('save')
  expect(new URL(page.url()).searchParams.get('redirect')).toContain('/saved?destination=paris')
})

test('login preview never creates a session or keeps the password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('traveller@example.com')
  await page.getByLabel('Password', { exact: true }).fill('preview-password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click()
  await expect(page.getByRole('status')).toContainText('Authentication is not connected yet')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await expect(page.getByRole('link', { name: 'My Trips', exact: true })).toHaveCount(0)
  await noHorizontalOverflow(page)
})

test('quiz produces destinations that open the explorer', async ({ page }) => {
  await page.goto('/quiz')
  await page.getByLabel('What interests you most?').selectOption('culture')
  await page.getByLabel('What is your preferred pace?').selectOption('busy')
  await page.getByLabel('Where would you like to explore?').selectOption('asia')
  await page.getByRole('button', { name: 'Find my destinations' }).click()
  await expect(page.getByRole('heading', { name: 'A few places you might love' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(3)
  await page.getByRole('link', { name: 'Explore destination', exact: true }).first().click()
  await expect(page).toHaveURL(/\/discover\?destination=tokyo/)
  await expect(page.getByRole('button', { name: 'Plan a trip here' })).toBeVisible()
  await noHorizontalOverflow(page)
})

test('country game still reveals answers and leads to planning', async ({ page }) => {
  await page.goto('/play')
  await page.getByLabel('Which country is this?').fill('Japan')
  await page.getByRole('button', { name: 'Guess', exact: true }).click()
  await expect(page.getByText('The right answer is')).toBeVisible()
  await page.getByRole('button', { name: /^Explore / }).click()
  await expect(page).toHaveURL(/\/explore\//)
  await page.getByRole('link', { name: 'Plan a trip here' }).click()
  await expect(page).toHaveURL(/\/login\?/)
})

test('external cancellation links stay inside the app', async ({ page }) => {
  await page.goto('/login?from=https://example.com&redirect=//example.com')
  await expect(page.getByRole('link', { name: 'Continue exploring' })).toHaveAttribute('href', '/discover')
})

test('verified-session integration switches the header and prefills the trip form', async ({ page }) => {
  await page.goto('/login')
  // Exercise the teammate's integration seam; production UI cannot manufacture a session.
  await page.evaluate(async () => {
    const { setAuthenticatedUser } = await import('/src/services/auth.js')
    setAuthenticatedUser({ id: 'e2e-verified-user' })
  })
  await expect(page.getByRole('link', { name: 'My Trips', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  await page.getByRole('button', { name: 'Tokyo Japan' }).click()
  await page.getByRole('button', { name: 'Plan a trip here' }).click()
  await expect(page.getByRole('heading', { name: 'Create a trip' })).toBeVisible()
  await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('Tokyo')
  await expect(page.getByRole('button', { name: 'Create trip — coming soon' })).toBeDisabled()
  await noHorizontalOverflow(page)
})

test('signed-in preview shows sample trips, survives refresh and exits cleanly', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Preview signed-in experience' }).click()
  await expect(page).toHaveURL(/\/trips$/)
  await expect(page.getByRole('status')).toContainText('Preview mode')
  await expect(page.getByRole('heading', { name: 'Tokyo with friends' })).toBeVisible()
  await page.getByRole('link', { name: 'View trip →' }).first().click()
  await expect(page).toHaveURL(/\/trips\/preview\/tokyo$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A day of discovery' })).toBeVisible()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Budget Planner' })).toBeVisible()
  await page.getByRole('button', { name: 'Packing', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Packing checklist' })).toBeVisible()
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Preview traveller' })).toBeVisible()
  await noHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Exit preview' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('link', { name: 'My Trips', exact: true })).toHaveCount(0)
  await page.goto('/trips')
  await expect(page).toHaveURL(/\/login\?/)
})

test('preview honours destination context and cannot enter the live budget planner', async ({ page }) => {
  await page.goto('/trips/new?destination=Tokyo')
  await page.getByRole('button', { name: 'Preview signed-in experience' }).click()
  await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('Tokyo')
  await page.goto('/budget')
  await expect(page).toHaveURL(/\/login\?/)
  await expect(page.getByRole('heading', { name: 'Budget Planner', exact: true })).toHaveCount(0)
})

test('trip budget saves expenses, converts currency, reloads and keeps trips separate', async ({ page, request }) => {
  // Reset only the isolated E2E server's two preview-trip budgets.
  for (const id of ['preview-tokyo', 'preview-paris']) {
    const expenses = await (await request.get(`http://127.0.0.1:3100/api/trips/${id}/expenses`)).json()
    for (const expense of expenses) await request.delete(`http://127.0.0.1:3100/api/expenses/${expense.id}`)
    await request.put(`http://127.0.0.1:3100/api/trips/${id}/budget`, { data: { total: id === 'preview-tokyo' ? 2000 : 3000, homeCurrency: 'SGD', destCurrency: id === 'preview-tokyo' ? 'JPY' : 'EUR' } })
  }
  await page.goto('/login')
  await page.getByRole('button', { name: 'Preview signed-in experience' }).click()
  await page.getByRole('link', { name: 'View trip →' }).first().click()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByTestId('total')).toHaveText('SGD 2,000.00')
  await page.getByTestId('edit-budget').click()
  await page.getByTestId('total-input').fill('2500')
  await page.getByTestId('save-budget').click()
  await expect(page.getByTestId('total')).toHaveText('SGD 2,500.00')
  await page.getByTestId('expense-amount').fill('1000')
  await page.getByTestId('expense-currency').selectOption('JPY')
  await page.getByTestId('expense-category').selectOption('Food')
  await page.getByRole('textbox', { name: 'Expense note' }).fill('Group lunch')
  await expect(page.getByTestId('conversion-preview')).toContainText('SGD 10.00')
  await page.getByTestId('add-expense').click()
  await expect(page.getByTestId('spent')).toHaveText('SGD 10.00')
  await page.reload()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByTestId('expense-list')).toContainText('Group lunch')
  await expect(page.getByTestId('spent')).toHaveText('SGD 10.00')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Trips', exact: true }).click()
  await page.getByRole('link', { name: 'View trip →' }).last().click()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByTestId('total')).toHaveText('SGD 3,000.00')
  await expect(page.getByTestId('spent')).toHaveText('SGD 0.00')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Trips', exact: true }).click()
  await page.getByRole('link', { name: 'View trip →' }).first().click()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByTestId('spent')).toHaveText('SGD 0.00')
  await expect(page.getByTestId('empty')).toBeVisible()
  await noHorizontalOverflow(page)
})
