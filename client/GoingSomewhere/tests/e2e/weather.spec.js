import { test, expect } from 'playwright/test'

function today(timezone = 'Asia/Tokyo') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = key => parts.find(p => p.type === key).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const hours = date => Array.from({ length: 24 }, (_, i) => `${date}T${String(i).padStart(2, '0')}:00`)

test.beforeEach(async ({ page }) => {
  await page.route('**/api/trips/*/budget/summary', route => route.fulfill({ status: 404, json: { error: 'No budget set' } }))
  await page.route('https://api-open.data.gov.sg/**', route => route.abort())
  await page.route('https://api.open-meteo.com/**', route => {
    const date = new URL(route.request().url()).searchParams.get('start_date') ?? today()
    return route.fulfill({ json: {
      daily: { temperature_2m_min: [12], temperature_2m_max: [29] },
      hourly: { time: hours(date), temperature_2m: hours(date).map((_, i) => i < 12 ? 12 : 24), apparent_temperature: hours(date).map(() => 25),
        precipitation_probability: hours(date).map((_, i) => i < 12 ? 80 : 10), weather_code: hours(date).map(() => 61), wind_speed_10m: hours(date).map(() => 12) },
    } })
  })
  await page.route('https://air-quality-api.open-meteo.com/**', route => {
    const timezone = new URL(route.request().url()).searchParams.get('timezone')
    const time = hours(today(timezone))
    return route.fulfill({ json: { hourly: { time, us_aqi: time.map((_, i) => i < 12 ? 170 : 65), pm2_5: time.map(() => 65), pm10: time.map(() => 90) } } })
  })
  await page.route('https://archive-api.open-meteo.com/**', route => {
    const url = new URL(route.request().url())
    const startYear = Number(url.searchParams.get('start_date').slice(0, 4))
    const endYear = Number(url.searchParams.get('end_date').slice(0, 4))
    const time = []
    for (let year = startYear; year <= endYear; year++) for (let month = 1; month <= 12; month++) for (let day = 1; day <= 28; day++) time.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    const historicalHours = time.filter(date => ['03', '12'].includes(date.slice(5, 7))).flatMap(date => hours(date))
    return route.fulfill({ json: { hourly: { time: historicalHours, temperature_2m: historicalHours.map(date => Number(date.slice(11, 13)) < 12 ? 5 : 11) }, daily: { time, temperature_2m_min: time.map(() => 4), temperature_2m_max: time.map(() => 12), precipitation_sum: time.map((_, i) => i % 2 ? 2 : 0) } } })
  })
})

test('day summary holds advice while activity conditions follow their time slot', async ({ page }) => {
  await page.goto('/weather')
  const summary = page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })
  const slot = page.getByRole('region', { name: 'Conditions during Tokyo', exact: true })
  await expect(summary.getByText('Weather Forecast', { exact: true })).toBeVisible()
  await expect(summary.getByText(/Rain may affect this activity/)).toBeVisible()
  await expect(summary.getByText(/Poor air quality during this activity/)).toBeVisible()
  await expect(slot.getByText('≈ 12–24°C', { exact: true })).toBeVisible()
  await page.getByLabel('Start time', { exact: true }).fill('13:00')
  await expect(slot.getByText('≈ 24°C', { exact: true })).toBeVisible()
  await expect(slot.getByText('Moderate · US AQI 65', { exact: true })).toBeVisible()
  await expect(summary.getByText(/Poor air quality during this activity/)).toHaveCount(0)
  await expect(summary.getByText(/Rain may affect this activity/)).toHaveCount(0)
  await expect(slot.getByRole('list')).toHaveCount(0)
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Weather & air quality' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('advance planning shows historical estimates and never invents future AQI', async ({ page }) => {
  await page.goto('/weather')
  await page.getByLabel('Activity date').fill(`${new Date().getFullYear() + 1}-12-12`)
  await expect(page.getByText('Weather Forecast', { exact: true })).toBeVisible()
  await expect(page.getByText('4–12°C', { exact: true })).toBeVisible()
  await expect(page.getByText('Air quality forecast not available yet.', { exact: false })).toBeVisible()
  await expect(page.getByText('Cold mornings and evenings', { exact: true })).toBeVisible()
  await expect(page.getByText(/Poor air quality during this activity/)).toHaveCount(0)
  await expect(page.getByText('Cold mornings and evenings', { exact: true })).toHaveCount(1)
  await expect(page.getByText(/Based on .* days in/)).toHaveCount(0)
  await expect(page.getByText(/Retrieved /)).toHaveCount(0)
})

test('air failure preserves weather and can be retried; invalid times explain the issue', async ({ page }) => {
  await page.route('https://air-quality-api.open-meteo.com/**', route => route.fulfill({ status: 503, json: {} }))
  await page.goto('/weather')
  await expect(page.getByRole('alert')).toContainText('Could not load conditions')
  await expect(page.getByText('Weather Forecast', { exact: true })).toBeVisible()
  await page.unroute('https://air-quality-api.open-meteo.com/**')
  await page.route('https://air-quality-api.open-meteo.com/**', route => route.fulfill({ json: { hourly: { time: hours(today()), us_aqi: hours(today()).map(() => 40) } } }))
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.getByText('Good', { exact: true })).toBeVisible()
  await page.getByLabel('End time', { exact: true }).fill('08:00')
  await expect(page.getByRole('alert')).toContainText('End time must be after start time')
})

test('international city search keeps coordinates and timezone with the selected result', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{ id: 1, name: 'Kyoto', admin1: 'Kyoto', country: 'Japan', latitude: 35.02, longitude: 135.76, timezone: 'Asia/Tokyo' }] } }))
  await page.goto('/weather')
  await page.getByRole('searchbox', { name: 'Search a city' }).fill('Kyoto')
  await page.getByRole('button', { name: 'Find location', exact: true }).click()
  await page.getByRole('button', { name: 'Kyoto · Kyoto · Japan', exact: true }).click()
  await expect(page.getByText('Kyoto, Japan', { exact: true })).toBeVisible()
  await expect(page.getByText('Weather Forecast', { exact: true })).toBeVisible()
})

test('sample trips have a daily summary, compact activity conditions and every itinerary day', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('travel-ui-preview', 'on'))
  await page.goto('/trips/preview/tokyo')
  await expect(page.getByRole('heading', { name: 'A day of discovery' })).toBeVisible()
  const days = page.getByRole('navigation', { name: 'Itinerary days', exact: true })
  await expect(days.getByRole('button')).toHaveCount(6)
  await expect(page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })).toHaveCount(1)
  await expect(page.getByRole('region', { name: /^Conditions during / })).toHaveCount(4)
  await expect(page.getByText('Cold mornings and evenings', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Conditions during Explore Asakusa and Sensō-ji', exact: true }).getByText('≈ 5°C', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conditions during Lunch with the group', exact: true }).getByText('≈ 11°C', { exact: true })).toBeVisible()
  for (let day = 1; day <= 6; day++) {
    await days.getByRole('button', { name: new RegExp(`^Day ${day} `) }).click()
    await expect(page.getByRole('region', { name: /^Conditions during / }).first()).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'One last taste of Tokyo' })).toBeVisible()
  await page.goto('/trips/preview/paris')
  const parisDays = page.getByRole('navigation', { name: 'Itinerary days', exact: true })
  await expect(parisDays.getByRole('button')).toHaveCount(7)
  for (let day = 1; day <= 7; day++) {
    await parisDays.getByRole('button', { name: new RegExp(`^Day ${day} `) }).click()
    await expect(page.getByRole('region', { name: /^Conditions during / }).first()).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'A slow Paris goodbye' })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Conditions during / })).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('itinerary atmosphere follows the destination and respects reduced motion', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('travel-ui-preview', 'on'))
  await page.goto('/trips/preview/tokyo')
  await expect(page.locator('.itinerary-atmosphere')).toHaveAttribute('data-effect', 'snow')
  await expect(page.getByText('Winter in Tokyo', { exact: false })).toBeVisible()
  await expect(page.locator('.itinerary-atmosphere')).toHaveCSS('pointer-events', 'none')
  await expect(page.getByRole('button', { name: /Pause animation|Play animation/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Day summary', exact: true })).toHaveCount(0)
  await expect(page.locator('.atmosphere-particle').first()).toHaveCSS('animation-play-state', 'running')
  await page.getByRole('navigation', { name: 'Itinerary days' }).getByRole('button', { name: /^Day 2 / }).click()
  await expect(page.getByRole('heading', { name: 'Gardens, shrines & city lights', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await expect(page.locator('.itinerary-atmosphere')).toHaveCount(0)
  await page.goto('/trips/preview/paris')
  await expect(page.locator('.itinerary-atmosphere')).toHaveAttribute('data-effect', 'petals')
  await expect(page.getByText('Spring in Paris', { exact: false })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.atmosphere-particle').first()).toHaveCSS('animation-name', 'none')
})

test('overnight conditions do not flag daytime plans, and indoor settings remove outdoor warnings', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => {
    const date = new URL(route.request().url()).searchParams.get('start_date') ?? today()
    return route.fulfill({ json: {
      daily: { temperature_2m_min: [15], temperature_2m_max: [25] },
      hourly: { time: hours(date), temperature_2m: hours(date).map(() => 20), apparent_temperature: hours(date).map(() => 20),
        precipitation_probability: hours(date).map((_, i) => i === 3 ? 90 : 0), weather_code: hours(date).map((_, i) => i === 3 ? 95 : 0), wind_speed_10m: hours(date).map(() => 5) },
    } })
  })
  await page.route('https://air-quality-api.open-meteo.com/**', route => route.fulfill({ json: { hourly: { time: hours(today()), us_aqi: hours(today()).map(() => 40) } } }))
  await page.goto('/weather')
  const summary = page.getByRole('region', { name: 'Day weather and air quality summary', exact: true })
  await expect(summary.getByText(/Peak precipitation probability: 90%/)).toBeVisible()
  await expect(summary.getByRole('list', { name: 'Day planning advice' })).toHaveCount(0)
  await page.getByLabel('Start time', { exact: true }).fill('02:00')
  await page.getByLabel('End time', { exact: true }).fill('04:00')
  await expect(summary.getByText(/Tokyo · 02:00–04:00: Thunderstorms forecast/)).toBeVisible()
  await page.getByLabel('Activity setting').selectOption('indoor')
  await expect(summary.getByRole('list', { name: 'Day planning advice' })).toHaveCount(0)
  await expect(summary.getByText('All activities are indoors.', { exact: false })).toBeVisible()
})

test('editing a sample activity automatically surfaces its schedule conflict alongside budget checks', async ({ page }) => {
  await page.route('**/api/trips/*/budget/summary', route => route.fulfill({ json: { total: 20, spentTotal: 30, homeCurrency: 'SGD' } }))
  await page.addInitScript(() => sessionStorage.setItem('travel-ui-preview', 'on'))
  await page.goto('/trips/preview/tokyo')
  await expect(page.getByText('Trip budget may be exceeded', { exact: true })).toBeVisible()
  const museum = page.locator('.weather-activity').filter({ has: page.getByRole('heading', { name: 'Tokyo National Museum', exact: true }) })
  await museum.getByRole('button', { name: 'Edit activity', exact: true }).click()
  await museum.getByLabel('Start time', { exact: true }).fill('12:45')
  await museum.getByRole('button', { name: 'Update activity', exact: true }).click()
  await expect(page.getByText('Activities overlap', { exact: true })).toBeVisible()
  await expect(page.getByText(/Lunch with the group.*overlaps Tokyo National Museum/)).toBeVisible()
  await expect(page.getByText('Trip budget may be exceeded', { exact: true })).toBeVisible()
  await museum.getByRole('button', { name: 'Edit activity', exact: true }).click()
  await museum.getByLabel('Start time', { exact: true }).fill('14:30')
  await museum.getByRole('button', { name: 'Update activity', exact: true }).click()
  await expect(page.getByText('Activities overlap', { exact: true })).toHaveCount(0)
})

test('Singapore PSI is labelled as an observation and is not reused for future dates', async ({ page }) => {
  let calls = 0
  await page.route('https://api-open.data.gov.sg/**', route => {
    calls++
    return route.fulfill({ json: { code: 0, data: {
      regionMetadata: [{ name: 'central', labelLocation: { latitude: 1.35, longitude: 103.82 } }],
      items: [{ timestamp: new Date(Date.now() - 30 * 60000).toISOString(), readings: { psi_twenty_four_hourly: { central: 120 } } }],
    } } })
  })
  await page.goto('/weather?destination=singapore')
  await expect(page.getByText('Singapore PSI · NEA observation', { exact: true })).toBeVisible()
  await expect(page.getByText('120 · Unhealthy', { exact: true })).toBeVisible()
  const currentCalls = calls
  const later = new Date(`${today('Asia/Singapore')}T12:00:00Z`)
  later.setUTCDate(later.getUTCDate() + 1)
  await page.getByLabel('Activity date').fill(later.toISOString().slice(0, 10))
  await expect(page.getByText('Singapore PSI is an observation, not a forecast for this date.', { exact: true })).toBeVisible()
  await expect(page.getByText('120 · Unhealthy', { exact: true })).toHaveCount(0)
  expect(calls).toBe(currentCalls)
})
