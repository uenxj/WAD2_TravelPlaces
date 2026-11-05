import { test, expect } from 'playwright/test'

// The itinerary service for these tests: tests/e2e/itinerary-server.cjs (real routes, outside lookups stubbed).
const API = 'http://127.0.0.1:3101'

// Trip dates cannot be in the past, so tests use dates relative to today.
const ymd = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.beforeEach(async ({ page }) => {
  // The dev-only Vue devtools button floats over the bottom of phone screens and blocks clicks
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".vue-devtools__anchor{display:none!important}";
      document.head.appendChild(s);
    });
  });
  // Send the app's API calls to the itinerary test service, and keep outside providers out of it.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `${API}${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.route('**/api/trips/*/budget/summary', route => route.fulfill({ status: 404, json: { error: 'No budget set' } }))
  for (const host of ['https://api.open-meteo.com/**', 'https://archive-api.open-meteo.com/**', 'https://air-quality-api.open-meteo.com/**', 'https://api-open.data.gov.sg/**', 'https://restcountries.com/**']) {
    await page.route(host, route => route.abort())
  }
})

let counter = 0
// A new account, signed in. Each test gets its own person, so tests can run in any order and be re-run.
async function signUp(page, name = 'Ava Tan') {
  const email = `ava-${Date.now()}-${counter++}@example.com`
  const res = await page.request.post(`${API}/api/auth/signup`, { data: { name, email, password: 'correct horse battery' } })
  expect(res.status()).toBe(201)
  return email
}

async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function createTrip(page, { name = `Test trip ${Date.now()}-${counter++}`, destination = 'Singapore' } = {}) {
  await page.goto('/trips/new')
  await page.getByTestId('trip-name').fill(name)
  await page.getByTestId('trip-destination').fill(destination)
  await page.getByTestId('trip-start').fill(ymd(30))
  await page.getByTestId('trip-end').fill(ymd(32))
  await page.getByTestId('create-trip-btn').click()
  await expect(page.getByTestId('trip-title')).toHaveText(name)
  return name
}

async function addItem(page, { title, start, end }) {
  await page.getByTestId('add-item-btn').click()
  await page.getByTestId('item-title-input').fill(title)
  await page.getByTestId('item-start-input').fill(start)
  await page.getByTestId('item-end-input').fill(end)
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-modal')).toBeHidden()
}

test('a signed-in traveller creates a trip and finds it in My Trips', async ({ page }) => {
  await signUp(page)
  await page.goto('/trips')
  await expect(page.getByTestId('no-trips')).toBeVisible()
  await noHorizontalOverflow(page)

  const name = await createTrip(page)
  await noHorizontalOverflow(page)
  await expect(page.getByTestId('empty-day')).toBeVisible()

  await page.getByRole('link', { name: '← My Trips' }).click()
  await expect(page.getByTestId('trip-row').filter({ hasText: name })).toBeVisible()
  await page.getByTestId('trip-row').filter({ hasText: name }).getByTestId('trip-link').click()
  await expect(page.getByTestId('trip-title')).toHaveText(name)
})

test('the trip page links to this trip\'s Budget, next to the Packing list', async ({ page }) => {
  await signUp(page)
  await createTrip(page, { destination: 'Singapore' })
  const tripId = new URL(page.url()).pathname.split('/').pop()

  await expect(page.getByTestId('packing-link')).toBeVisible()
  const budget = page.getByTestId('budget-link')
  await expect(budget).toBeVisible()
  await expect(budget).toHaveText('Budget')
  // Same trip id as the packing list, plus the destination's currency.
  await expect(budget).toHaveAttribute('href', `/budget?trip=${tripId}&currency=SGD`)
  await noHorizontalOverflow(page)
})

test('create, edit and delete an itinerary item', async ({ page }) => {
  await signUp(page)
  await createTrip(page)

  await addItem(page, { title: 'Gardens by the Bay', start: '10:00', end: '12:00' })
  await expect(page.getByTestId('item-title')).toHaveText('Gardens by the Bay')
  await noHorizontalOverflow(page)

  await page.getByTestId('edit-item-btn').click()
  await page.getByTestId('item-title-input').fill('Cloud Forest')
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-title')).toHaveText('Cloud Forest')

  page.once('dialog', d => d.accept())
  await page.getByTestId('delete-item-btn').click()
  await expect(page.getByTestId('empty-day')).toBeVisible()
})

test('warns when two activities overlap', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Museum', start: '10:00', end: '12:00' })
  await addItem(page, { title: 'Lunch', start: '11:00', end: '13:00' })

  await expect(page.getByTestId('conflict-notice')).toContainText('Overlaps with "Museum"')
  await expect(page.getByTestId('conflict-message')).toHaveCount(2) // one on each clashing item
  await expect(page.getByTestId('day-tab').first().locator('.badge')).toHaveText('2')
})

test('rejects an end time before the start time', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await page.getByTestId('add-item-btn').click()
  await page.getByTestId('item-title-input').fill('Backwards')
  await page.getByTestId('item-start-input').fill('15:00')
  await page.getByTestId('item-end-input').fill('14:00')
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('form-error')).toContainText('End time must be after')
})

test('the trip owner adds a travel buddy by email', async ({ page, browser, baseURL }) => {
  await signUp(page, 'Ava Tan')
  await createTrip(page)
  await addItem(page, { title: 'Beach', start: '10:00', end: '12:00' })

  await page.getByTestId('member-input').fill('nobody@example.com')
  await page.getByTestId('add-member-btn').click()
  await expect(page.getByRole('status').filter({ hasText: 'No account uses that email' })).toBeVisible()

  // Ben has an account and is added by email
  const context = await browser.newContext({ baseURL })
  const benPage = await context.newPage()
  const benEmail = await signUp(benPage, 'Ben Lim')
  await page.getByTestId('member-input').fill(benEmail)
  await page.getByTestId('add-member-btn').click()
  await expect(page.getByTestId('member-list')).toContainText('Ben Lim')
  await expect(page.getByTestId('member-list')).toContainText('You · organiser')

  await context.close()
})

test('Plan a trip here opens the form with the destination filled in, and Cancel goes back', async ({ page }) => {
  await signUp(page)
  await page.goto('/trips/new?destination=Kyoto&country=Japan&from=%2Fdiscover')
  await expect(page.getByTestId('trip-destination')).toHaveValue('Kyoto, Japan')
  await page.getByRole('link', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/discover$/)
})

test('a visitor who is not signed in is sent to log in', async ({ page }) => {
  await page.goto('/trips/some-trip-id')
  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/trips/some-trip-id')
})

test('a trip belongs to its travellers: someone else gets a clear message', async ({ page, browser, baseURL }) => {
  await signUp(page)
  await createTrip(page)
  const tripPath = new URL(page.url()).pathname

  const context = await browser.newContext({ baseURL })
  const other = await context.newPage()
  await other.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    await route.fulfill({ response: await route.fetch({ url: `${API}${url.pathname}${url.search}` }) })
  })
  await signUp(other, 'Cara Ng')
  await other.goto(tripPath)
  await expect(other.getByRole('alert')).toContainText('You are not in this trip')
  await context.close()
})

test('a suggested place fills in the activity, and the weather conditions panel follows it', async ({ page }) => {
  await signUp(page)
  await createTrip(page)

  await page.getByTestId('top-places-toggle').click()
  await expect(page.getByTestId('top-places-area')).toContainText('Singapore')
  await page.getByRole('listitem').filter({ hasText: 'Gardens by the Bay' }).getByRole('button', { name: 'Add' }).click()
  await expect(page.getByTestId('item-title-input')).toHaveValue('Gardens by the Bay')
  await expect(page.getByTestId('item-setting-input')).toHaveValue('outdoor') // gardens_and_parks -> outdoor
  await page.getByTestId('save-item-btn').click()

  await expect(page.getByTestId('item-title')).toHaveText('Gardens by the Bay')
  // The weather module is given this activity's own coordinates and the destination timezone.
  await expect(page.getByRole('region', { name: 'Conditions during Gardens by the Bay', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })).toBeVisible()
})

test('the trips pages fit a phone screen', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'A rather long activity title that has to wrap on a narrow screen without overflowing', start: '10:00', end: '12:00' })
  await noHorizontalOverflow(page)
  await page.goto('/trips')
  await noHorizontalOverflow(page)
})
