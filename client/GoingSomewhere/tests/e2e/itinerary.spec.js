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

  await page.getByRole('link', { name: 'Back to My Trips' }).click()
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

test('shows clashes that already exist (for example two travellers adding at the same moment)', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  const tripId = new URL(page.url()).pathname.split('/').pop()
  const { startDate } = await (await page.request.get(`${API}/api/trips/${tripId}`)).json()
  for (const [title, startTime, endTime] of [['Museum', '10:00', '12:00'], ['Lunch', '11:00', '13:00']]) {
    const res = await page.request.post(`${API}/api/trips/${tripId}/items`, { data: { title, date: startDate, startTime, endTime } })
    expect(res.status()).toBe(201) // the server still saves it and reports the clash
  }
  await page.reload()

  await expect(page.getByTestId('conflict-summary')).toContainText('2 activities have conflicts')
  await expect(page.getByTestId('conflict-message')).toHaveCount(2) // one on each clashing item
  const tab = page.getByTestId('day-tab').first()
  const badge = tab.locator('.badge')
  await expect(badge).toHaveText('2')

  // The badge is fully visible: inside its tab and inside the scrolling strip, not cut off.
  const [b, t, nav] = await Promise.all([badge.boundingBox(), tab.boundingBox(), page.getByTestId('day-tabs').boundingBox()])
  for (const box of [t, nav]) {
    expect(b.x).toBeGreaterThanOrEqual(box.x)
    expect(b.y).toBeGreaterThanOrEqual(box.y)
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width)
    expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height)
  }

  // An activity that already clashes can still have its title corrected (only changing the time is blocked).
  await page.getByTestId('edit-item-btn').first().click()
  await page.getByTestId('item-title-input').fill('Museum visit')
  await expect(page.getByTestId('save-item-btn')).toBeEnabled()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expect(page.getByTestId('item-title').first()).toHaveText('Museum visit')
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
  await expect(page.getByTestId('member-list').getByRole('listitem').filter({ hasText: 'Ava Tan' })).toContainText('Organiser')

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
  await expect(page.getByTestId('trip-row')).toBeVisible()
  await noHorizontalOverflow(page)
})


test('trip dialogs contain keyboard focus and return it to the trigger', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  const edit = page.getByTestId('edit-trip-btn')
  await edit.click()
  const dialog = page.getByRole('dialog', { name: 'Edit trip details' })
  await expect(page.getByTestId('edit-trip-name')).toBeFocused()
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus()
  await page.keyboard.press('Tab')
  // Chromium can visit browser chrome after the last control in a native dialog.
  // It must never move focus into the inert application behind the dialog.
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  // await page.keyboard.press('Shift+Tab')
  // await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
  // Same browser-chrome quirk going backwards: Chromium can pass through the browser UI before wrapping
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Shift+Tab')
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(edit).toBeFocused()
  await page.getByTestId('add-item-btn').click()
  await expect(page.getByTestId('item-title-input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('add-item-btn')).toBeFocused()
})

test('the itinerary and its dialogs reflow at 320px with a long trip title', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await signUp(page)
  await createTrip(page, { name: 'A winter adventure with all our friends and family in Singapore' })
  await noHorizontalOverflow(page)
  await page.getByTestId('edit-trip-btn').click()
  await expect(page.getByTestId('edit-trip-name')).toBeVisible()
  await noHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Back to My Trips' }).click()
  await expect(page.getByTestId('trip-row')).toBeVisible()
  await noHorizontalOverflow(page)
})

// ---- clashes shown while filling in the form, and "already planned on another day" ----

// After every dialog is closed the page must scroll again (the body is not left with overflow: hidden).
async function expectPageScrolls(page) {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
  await page.evaluate(() => { document.body.style.minHeight = '3000px' }) // make sure there is something to scroll
  await page.mouse.wheel(0, 400)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.evaluate(() => { document.body.style.minHeight = '' })
}

async function openAddForm(page, { title = '', start, end } = {}) {
  await page.getByTestId('add-item-btn').click()
  if (title) await page.getByTestId('item-title-input').fill(title)
  if (start) await page.getByTestId('item-start-input').fill(start)
  if (end) await page.getByTestId('item-end-input').fill(end)
}

test('the form warns about a clash as soon as a start time falls inside an existing activity', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Museum', start: '09:00', end: '11:00' })

  await openAddForm(page, { title: 'Coffee' })
  // The form opens on 09:00-10:00, which already clashes with the museum, so it says so straight away.
  await expect(page.getByTestId('live-conflicts')).toContainText('Overlaps with "Museum" (09:00-11:00)')
  await page.getByTestId('item-start-input').fill('12:00')
  await expect(page.getByTestId('item-end-input')).toHaveValue('13:00') // the end time moved on by itself
  await expect(page.getByTestId('live-conflicts')).toBeHidden()

  await page.getByTestId('item-start-input').fill('10:00') // inside 09:00-11:00: warns before anything is saved
  await page.getByTestId('item-end-input').fill('10:30')
  await expect(page.getByTestId('live-conflicts')).toContainText('Overlaps with "Museum" (09:00-11:00)')

  await page.getByTestId('item-start-input').fill('09:00')
  await expect(page.getByTestId('live-conflict')).toHaveCount(1)

  await page.getByTestId('item-start-input').fill('11:00') // right after it ends: no clash
  await expect(page.getByTestId('live-conflicts')).toBeHidden()

  await page.getByTestId('item-start-input').fill('10:00')
  await expect(page.getByTestId('live-conflicts')).toBeVisible()
  await page.getByTestId('item-date-input').selectOption({ index: 1 }) // another day is free
  await expect(page.getByTestId('live-conflicts')).toBeHidden()
  await noHorizontalOverflow(page)
})

test('a clash has to be fixed before the activity can be added', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Museum', start: '09:00', end: '11:00' })
  await openAddForm(page, { title: 'Coffee', start: '10:00' })
  await expect(page.getByTestId('live-conflicts')).toContainText('Change the day or time to continue')
  await expect(page.getByTestId('save-item-btn')).toBeDisabled()
  await page.getByTestId('item-title-input').press('Enter') // Enter cannot sneak it through either
  await expect(page.getByTestId('item-modal')).toBeVisible()
  await expect(page.getByTestId('item-row')).toHaveCount(1)

  await page.getByTestId('item-start-input').fill('11:00')
  await expect(page.getByTestId('live-conflicts')).toBeHidden()
  await expect(page.getByTestId('save-item-btn')).toBeEnabled()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expect(page.getByTestId('item-row')).toHaveCount(2)
  await expect(page.getByTestId('conflict-notice')).toBeHidden()
})

test('the form names the travel buddy whose activity it clashes with', async ({ page, browser, baseURL }) => {
  await signUp(page, 'Ava Tan')
  await createTrip(page)
  const tripId = new URL(page.url()).pathname.split('/').pop()

  const context = await browser.newContext({ baseURL })
  const benPage = await context.newPage()
  const benEmail = await signUp(benPage, 'Ben Lim')
  await page.getByTestId('member-input').fill(benEmail)
  await page.getByTestId('add-member-btn').click()
  await expect(page.getByTestId('member-list')).toContainText('Ben Lim')

  // Ben adds an activity while Ava already has the page open
  const first = await benPage.request.get(`${API}/api/trips/${tripId}`)
  const { startDate } = await first.json()
  const added = await benPage.request.post(`${API}/api/trips/${tripId}/items`, {
    data: { title: 'Sunrise hike', date: startDate, startTime: '09:00', endTime: '11:00' },
  })
  expect(added.status()).toBe(201)

  await openAddForm(page, { title: 'Brunch', start: '10:00' })
  await expect(page.getByTestId('live-conflicts')).toContainText('Overlaps with "Sunrise hike" (09:00-11:00), added by Ben Lim.')
  await context.close()
})

test('adding an activity that is already planned on another day offers to move it', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Gardens by the Bay', start: '10:00', end: '12:00' })

  await page.getByTestId('day-tab').nth(1).click()
  await openAddForm(page, { title: 'gardens by the bay', start: '14:00', end: '15:00' })
  await page.getByTestId('save-item-btn').click()

  const prompt = page.getByTestId('duplicate-modal')
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText('is already planned on')
  await expect(page.getByTestId('duplicate-match')).toHaveCount(1)
  await expect(page.getByTestId('duplicate-match')).toContainText('Day 1')
  await expect(page.getByTestId('duplicate-match')).toContainText('10:00-12:00')
  await noHorizontalOverflow(page)

  await page.getByTestId('move-activity-btn').click()
  await expect(prompt).toBeHidden()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expectPageScrolls(page)

  // The one activity now lives on day 2 at the new time, with its original title; day 1 is empty again.
  await expect(page.getByTestId('item-row')).toHaveCount(1)
  await expect(page.getByTestId('item-title')).toHaveText('Gardens by the Bay')
  await expect(page.getByTestId('item-row')).toContainText('14:00')
  await page.getByTestId('day-tab').first().click()
  await expect(page.getByTestId('empty-day')).toBeVisible()
})

test('or to duplicate it, which keeps both copies', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Gardens by the Bay', start: '10:00', end: '12:00' })

  await page.getByTestId('day-tab').nth(1).click()
  await openAddForm(page, { title: 'Gardens by the Bay', start: '14:00', end: '15:00' })
  await page.getByTestId('save-item-btn').click()
  await page.getByTestId('duplicate-activity-btn').click()
  await expect(page.getByTestId('duplicate-modal')).toBeHidden()
  await expectPageScrolls(page)
  await expect(page.getByTestId('item-row')).toHaveCount(1)
  await expect(page.getByTestId('item-row')).toContainText('14:00')
  await page.getByTestId('day-tab').first().click()
  await expect(page.getByTestId('item-row')).toHaveCount(1)
  await expect(page.getByTestId('item-row')).toContainText('10:00')

  // A third day now finds both copies and lets you choose which one to move
  await page.getByTestId('day-tab').nth(2).click()
  await openAddForm(page, { title: 'Gardens by the Bay', start: '09:00', end: '10:00' })
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('duplicate-match')).toHaveCount(2)
})

test('"Go back" keeps what was typed so another day or time can be chosen', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Gardens by the Bay', start: '10:00', end: '12:00' })

  await page.getByTestId('day-tab').nth(1).click()
  await openAddForm(page, { title: 'Gardens by the Bay', start: '14:00', end: '15:00' })
  await page.getByTestId('save-item-btn').click()
  await page.getByTestId('duplicate-cancel-btn').click()
  await expect(page.getByTestId('duplicate-modal')).toBeHidden()
  await expect(page.getByTestId('item-modal')).toBeVisible()
  await expect(page.getByTestId('item-title-input')).toHaveValue('Gardens by the Bay')
  await expect(page.getByTestId('item-start-input')).toHaveValue('14:00')
  await page.getByTestId('item-start-input').fill('16:00')
  await page.getByTestId('item-end-input').fill('17:00')
  await page.getByTestId('save-item-btn').click() // still another day, so it asks again
  await expect(page.getByTestId('duplicate-modal')).toBeVisible()
  await page.getByTestId('duplicate-activity-btn').click()
  await expect(page.getByTestId('item-row')).toHaveCount(1)
  await expect(page.getByTestId('item-row')).toContainText('16:00')
})

test('an activity with the same name cannot be added twice on one day, and the form says so', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  await addItem(page, { title: 'Gardens by the Bay', start: '10:00', end: '12:00' })

  // Same title (ignoring capitals and spaces), same day, a different time: still the same activity
  await openAddForm(page, { title: ' gardens  BY the bay', start: '14:00', end: '15:00' })
  const notice = page.getByTestId('same-day-duplicate')
  await expect(notice).toContainText('An activity with this name is already on this day.')
  await expect(notice).toContainText('"Gardens by the Bay" is already planned on this day (10:00-12:00).')
  await expect(page.getByTestId('save-item-btn')).toBeDisabled()
  await page.getByTestId('item-title-input').press('Enter') // Enter cannot sneak it through
  await expect(page.getByTestId('item-modal')).toBeVisible()
  await expect(page.getByTestId('item-row')).toHaveCount(1)

  // Another day is fine (it gets the move-or-duplicate question instead), and so is a different activity
  await page.getByTestId('item-date-input').selectOption({ index: 1 })
  await expect(notice).toBeHidden()
  await expect(page.getByTestId('save-item-btn')).toBeEnabled()
  await page.getByTestId('item-date-input').selectOption({ index: 0 })
  await expect(notice).toBeVisible()
  await page.getByTestId('item-title-input').fill('Gardens by the Bay night show')
  await expect(notice).toBeHidden()
  await expect(page.getByTestId('save-item-btn')).toBeEnabled()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expect(page.getByTestId('item-row')).toHaveCount(2)
})

test('a country-only destination shows weather when the primary lookup is unavailable', async ({ page }) => {
  await signUp(page)
  await createTrip(page, { name: 'Swiss winter', destination: 'Switzerland' })
  await expect(page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })).toBeVisible()
  await expect(page.getByText('Weather is for a representative location in Switzerland.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
  await noHorizontalOverflow(page)
})

test('an existing trip retries missing location data and can recover without editing its details', async ({ page }) => {
  await signUp(page)
  await createTrip(page, { name: 'Keep this Swiss trip', destination: 'Switzerland' })
  const path = new URL(page.url()).pathname
  await page.route(`**/api${path}`, async route => {
    const response = await route.fetch({ url: `${API}/api${path}` })
    const trip = await response.json()
    await route.fulfill({ json: { ...trip, center: null, timezone: '' } })
  })
  let attempts = 0
  await page.route(`**/api${path}/location`, async route => {
    attempts++
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Could not look up this destination. Retry, or choose a city and country in Edit trip.' } })
    await route.fulfill({ response: await route.fetch({ url: `${API}/api${path}/location` }) })
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Retry location', exact: true })).toBeVisible()
  expect(attempts).toBe(1)
  await page.getByRole('button', { name: 'Retry location', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })).toBeVisible()
  await expect(page.getByTestId('trip-title')).toHaveText('Keep this Swiss trip')
  expect(attempts).toBe(2)
  await expect(page.getByRole('button', { name: 'Retry location', exact: true })).toHaveCount(0)
})

async function mockDestinationSearch(page) {
  await page.route('https://geocoding-api.open-meteo.com/**', route => {
    const name = new URL(route.request().url()).searchParams.get('name').toLowerCase()
    const results = name.includes('bern')
      ? [{ id: 2, name: 'Bern', admin1: 'Bern', country: 'Switzerland', latitude: 46.948, longitude: 7.4474, timezone: 'Europe/Zurich', feature_code: 'PPLC' }]
      : name.includes('switzerland')
        ? [{ id: 3, name: 'Switzerland', country: 'Switzerland', latitude: 47.00016, longitude: 8.01427, timezone: 'Europe/Zurich', feature_code: 'PCLI' }]
        : [{ id: 1, name: 'Zurich', admin1: 'Zurich', country: 'Switzerland', latitude: 47.3769, longitude: 8.5417, timezone: 'Europe/Zurich', feature_code: 'PPLA' }]
    return route.fulfill({ json: { results } })
  })
}
async function fillTripBasics(page, name) {
  await page.goto('/trips/new')
  await page.getByTestId('trip-name').fill(name)
  await page.getByTestId('trip-start').fill(ymd(30))
  await page.getByTestId('trip-end').fill(ymd(32))
}

test('destination suggestions save the selected city and replace it when editing', async ({ page }) => {
  await signUp(page)
  await mockDestinationSearch(page)
  await fillTripBasics(page, 'Choose a Swiss city')
  await page.getByTestId('trip-destination').fill('Zurich')
  await page.getByRole('option', { name: /Zurich, Switzerland/ }).click()
  await expect(page.getByTestId('trip-destination')).toHaveValue('Zurich, Switzerland')
  await page.getByTestId('create-trip-btn').click()
  await expect(page.getByTestId('trip-title')).toHaveText('Choose a Swiss city')
  const tripId = new URL(page.url()).pathname.split('/').at(-1)
  let saved = await (await page.request.get(`${API}/api/trips/${tripId}`)).json()
  expect(saved.center).toEqual({ lat: 47.3769, lng: 8.5417 })
  expect(saved.timezone).toBe('Europe/Zurich')
  await page.getByTestId('edit-trip-btn').click()
  await page.getByTestId('edit-trip-destination').fill('Bern')
  await page.getByRole('option', { name: /Bern, Switzerland/ }).click()
  await page.getByTestId('save-trip-btn').click()
  await expect(page.getByTestId('trip-modal')).toBeHidden()
  saved = await (await page.request.get(`${API}/api/trips/${tripId}`)).json()
  expect(saved.destination).toBe('Bern, Switzerland')
  expect(saved.center).toEqual({ lat: 46.948, lng: 7.4474 })
  await noHorizontalOverflow(page)
})

test('country suggestions support keyboard selection and explain representative weather', async ({ page }) => {
  await signUp(page)
  await mockDestinationSearch(page)
  await fillTripBasics(page, 'Swiss country trip')
  const destination = page.getByTestId('trip-destination')
  await destination.fill('Switzerland')
  await expect(page.getByRole('option', { name: 'Switzerland', exact: true })).toBeVisible()
  await destination.press('ArrowDown')
  await destination.press('Enter')
  await expect(page.getByText('Country selected. Choose a city for more local weather conditions.')).toBeVisible()
  await expect(destination).toHaveAttribute('aria-expanded', 'false')
  await page.getByTestId('create-trip-btn').click()
  await expect(page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })).toBeVisible()
  await expect(page.locator('.location-context')).toContainText('representative location in Switzerland')
})

test('editing selected destination text clears its coordinates and free text still works during search failure', async ({ page }) => {
  await signUp(page)
  await mockDestinationSearch(page)
  await fillTripBasics(page, 'Changed my destination')
  const destination = page.getByTestId('trip-destination')
  await destination.fill('Zurich')
  await page.getByRole('option', { name: /Zurich, Switzerland/ }).click()
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.abort())
  await destination.fill('Singapore')
  await expect(page.getByText(/Location search is unavailable/)).toBeVisible()
  await page.getByTestId('trip-name').click()
  await page.getByTestId('create-trip-btn').click()
  await expect(page.getByTestId('trip-title')).toHaveText('Changed my destination')
  const tripId = new URL(page.url()).pathname.split('/').at(-1)
  const saved = await (await page.request.get(`${API}/api/trips/${tripId}`)).json()
  expect(saved.destination).toBe('Singapore')
  expect(saved.center).toEqual({ lat: 1.29, lng: 103.85 })
})

test('an older backend gives a useful location recovery message instead of a raw 404', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  const path = new URL(page.url()).pathname
  await page.route(`**/api${path}`, async route => {
    const response = await route.fetch({ url: `${API}/api${path}` })
    await route.fulfill({ json: { ...await response.json(), center: null, timezone: '' } })
  })
  await page.route(`**/api${path}/location`, route => route.fulfill({ status: 404, contentType: 'text/html', body: '<pre>Cannot POST location</pre>' }))
  await page.reload()
  await expect(page.getByText('Location lookup could not be refreshed. Open Edit trip, choose a destination, and save to try again.')).toBeVisible()
  await expect(page.getByText('Request failed (404)', { exact: true })).toHaveCount(0)
})

test('the same suggested place can be added again on one day under a different name', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  const suggestion = () => page.getByRole('listitem').filter({ hasText: 'Gardens by the Bay' }).getByRole('button', { name: 'Add' })
  await page.getByTestId('top-places-toggle').click()
  await expect(page.getByTestId('top-places-area')).toContainText('Singapore')
  await suggestion().click()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-row')).toHaveCount(1)

  await suggestion().click()
  await page.getByTestId('item-start-input').fill('18:00')
  await page.getByTestId('item-end-input').fill('19:00')
  // Same name as the first copy: blocked until it is renamed
  await expect(page.getByTestId('same-day-duplicate')).toContainText('is already planned on this day')
  await expect(page.getByTestId('save-item-btn')).toBeDisabled()
  await page.getByTestId('item-title-input').fill('Evening at the gardens') // same place, new name
  await expect(page.getByTestId('same-day-duplicate')).toBeHidden()
  await expect(page.getByTestId('save-item-btn')).toBeEnabled()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expect(page.getByTestId('item-row')).toHaveCount(2)
})

test('a suggested place renamed before adding is a different activity: no "already planned" question on another day', async ({ page }) => {
  await signUp(page)
  await createTrip(page)
  const suggestion = () => page.getByRole('listitem').filter({ hasText: 'Gardens by the Bay' }).getByRole('button', { name: 'Add' })
  await page.getByTestId('top-places-toggle').click()
  await expect(page.getByTestId('top-places-area')).toContainText('Singapore')
  await suggestion().click()
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('item-row')).toHaveCount(1)

  await page.getByTestId('day-tab').nth(1).click()
  await suggestion().click() // same place, same name, other day: asks
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('duplicate-modal')).toBeVisible()
  await page.getByTestId('duplicate-cancel-btn').click()

  await page.getByTestId('item-title-input').fill('Evening at the gardens') // renamed: a different activity
  await page.getByTestId('save-item-btn').click()
  await expect(page.getByTestId('duplicate-modal')).toBeHidden()
  await expect(page.getByTestId('item-modal')).toBeHidden()
  await expect(page.getByTestId('item-title')).toHaveText('Evening at the gardens')
  await page.getByTestId('day-tab').first().click()
  await expect(page.getByTestId('item-title')).toHaveText('Gardens by the Bay') // the original is untouched
})

test('each trip stamp shows the country curved round the ring, and long names still fit', async ({ page }) => {
  await signUp(page)
  const names = ['Switzerland', 'São Gonçalo, Rio de Janeiro, Brazil', 'tokyo', 'Kinshasa, Democratic Republic of the Congo']
  for (const [i, destination] of names.entries()) {
    const res = await page.request.post(`${API}/api/trips`, { data: { name: `Stamp ${i + 1}`, destination, startDate: ymd(30), endDate: ymd(32) } })
    expect(res.status()).toBe(201)
  }
  await page.goto('/trips')
  const stamps = page.getByTestId('stamp-mark')
  await expect(stamps).toHaveCount(4)
  const texts = await stamps.locator('textPath').allTextContents()
  expect(texts.sort()).toEqual(['BRAZIL', 'DEMOCRATIC REPUBLIC OF…', 'SWITZERLAND', 'TOKYO'].sort())

  // Every label is shorter than the ring it is written on (a full circle is about 170 units long).
  const lengths = await page.evaluate(() => [...document.querySelectorAll('[data-testid=stamp-mark] textPath')].map((tp) => tp.getComputedTextLength()))
  for (const length of lengths) expect(length).toBeLessThan(140)
  await noHorizontalOverflow(page)
})
