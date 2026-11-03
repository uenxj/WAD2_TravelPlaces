import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityHours, aqiCategory, daysAhead, localDate, planningHints, validateActivity } from './conditions.js'
import { getActivityConditions, summariseSeason, typicalSlot } from './api.js'
import { SAMPLE_TRIPS } from '../data/sampleTrips.js'

const now = new Date('2026-11-03T16:00:00Z') // Already November 4 in Tokyo.
const activity = { id: 'a', latitude: 35.68, longitude: 139.69, timezone: 'Asia/Tokyo', date: '2026-11-04', startTime: '09:30', endTime: '11:00', environment: 'outdoor' }
const response = data => ({ ok: true, json: async () => data })
const hourly = (date, extra = {}) => ({ time: ['09:00', '10:00', '11:00'].map(t => `${date}T${t}`), temperature_2m: [12, 15, 40], apparent_temperature: [11, 14, 42], precipitation_probability: [10, 80, 100], weather_code: [0, 61, 95], wind_speed_10m: [5, 10, 60], ...extra })

test('destination timezone controls today, including the date line', () => {
  assert.equal(localDate('Asia/Tokyo', now), '2026-11-04')
  assert.equal(localDate('America/Los_Angeles', now), '2026-11-03')
  assert.equal(daysAhead(activity, now), 0)
})

test('half-hour activities include overlapping hours and exclude the end', () => {
  assert.deepEqual(activityHours(hourly(activity.date), activity), [0, 1])
})

test('invalid dates, coordinates, timezones and overnight activities are rejected', () => {
  for (const changes of [{ date: '2026-02-30' }, { latitude: null }, { longitude: 181 }, { timezone: '//Tokyo' }, { startTime: '23:00', endTime: '02:00' }, { environment: 'unknown' }]) {
    assert.throws(() => validateActivity({ ...activity, ...changes }))
  }
  assert.doesNotThrow(() => validateActivity({ ...activity, date: '2028-02-29' }))
})

test('AQI categories use US AQI boundaries and keep missing data unavailable', () => {
  for (const [value, expected] of [[null, 'Unavailable'], [0, 'Good'], [50, 'Good'], [51, 'Moderate'], [100, 'Moderate'], [101, 'Unhealthy for sensitive groups'], [151, 'Unhealthy'], [201, 'Very unhealthy'], [301, 'Hazardous']]) assert.equal(aqiCategory(value), expected)
})

test('outdoor warnings combine weather and pollution, while indoor warnings are suppressed', () => {
  const weather = { kind: 'forecast', precipitationChance: 80, feelsHigh: 38, feelsLow: 20, wind: 45, codes: [95] }
  const air = { kind: 'forecast', aqi: 180 }
  assert.equal(planningHints(activity, weather, air).length, 5)
  assert.deepEqual(planningHints({ ...activity, environment: 'indoor' }, weather, air), [])
  assert.equal(planningHints({ ...activity, environment: 'mixed' }, weather, air).length, 5)
  assert.deepEqual(planningHints(activity, { kind: 'unavailable' }, { kind: 'unavailable' }), [])
})

test('seasonal guidance produces preparation advice rather than forecast alerts', () => {
  const hints = planningHints(activity, { kind: 'seasonal', low: 3, high: 12, wetDayPercent: 40 }, {})
  assert.equal(hints.length, 2)
  assert.ok(hints.every(hint => hint.level === 'info'))
})

function history(startYear, endYear) {
  const time = []
  for (let year = startYear; year <= endYear; year++) for (let day = 1; day <= 30; day++) time.push(`${year}-12-${String(day).padStart(2, '0')}`)
  return { time, temperature_2m_min: time.map(() => 4), temperature_2m_max: time.map(() => 12), precipitation_sum: time.map((_, i) => i % 2 ? 2 : 0) }
}

test('seasonal averages use the requested month and reject sparse or null historical data', () => {
  const daily = history(2016, 2025)
  const season = summariseSeason(daily, 12, 2016, 2025)
  assert.equal(season.kind, 'seasonal')
  assert.equal(season.low, 4)
  assert.equal(season.high, 12)
  assert.equal(season.wetDayPercent, 50)
  assert.equal(season.sampleDays, 300)
  assert.equal(summariseSeason(daily, 1, 2016, 2025).kind, 'unavailable')
  daily.temperature_2m_min.fill(null, 0, 30)
  assert.equal(summariseSeason(daily, 12, 2016, 2025).kind, 'unavailable')
})

test('advance activity temperatures reflect historical hours rather than repeating daily extremes', () => {
  const time = []
  for (let year = 2016; year <= 2025; year++) for (let day = 1; day <= 30; day++) for (const hour of [9, 10, 15, 16]) time.push(`${year}-12-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`)
  const hourly = { time, temperature_2m: time.map(value => Number(value.slice(11, 13)) < 12 ? 5 : 11) }
  const morning = { ...activity, date: '2026-12-12', startTime: '09:00', endTime: '11:00' }
  assert.deepEqual(typicalSlot(hourly, morning, 2016, 2025), { slotLow: 5, slotHigh: 5 })
  assert.deepEqual(typicalSlot(hourly, { ...morning, startTime: '15:00', endTime: '17:00' }, 2016, 2025), { slotLow: 11, slotHigh: 11 })
  assert.deepEqual(typicalSlot(hourly, { ...morning, startTime: '12:00', endTime: '13:00' }, 2016, 2025), { slotLow: null, slotHigh: null })
})

test('sample itineraries cover every trip day with valid activities and distinct IDs', () => {
  assert.equal(SAMPLE_TRIPS[0].days.length, 6)
  assert.equal(SAMPLE_TRIPS[1].days.length, 7)
  const ids = new Set()
  for (const trip of SAMPLE_TRIPS) {
    trip.days.forEach((day, index) => {
      assert.equal(Date.parse(day.date) - Date.parse(trip.startDate), index * 86400000)
      assert.ok(day.activities.length >= 4)
      for (const activity of day.activities) {
        validateActivity(activity)
        assert.equal(activity.date, day.date)
        assert.ok(!ids.has(activity.id))
        ids.add(activity.id)
      }
    })
  }
})

test('forecast selects the activity hours, deduplicates requests, and refresh bypasses cache', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async url => {
    calls++
    return response(url.includes('air-quality-api') ? { hourly: hourly(activity.date, { us_aqi: [45, 160, 400], pm2_5: [8, 55, 200], pm10: [10, 80, 300] }) } : { hourly: hourly(activity.date), daily: { temperature_2m_min: [8], temperature_2m_max: [18] } })
  })
  const [a, b] = await Promise.all([getActivityConditions(activity, now), getActivityConditions(activity, now)])
  assert.equal(calls, 2)
  assert.deepEqual(a, b)
  assert.equal(a.weather.slotHigh, 15)
  assert.equal(a.weather.precipitationChance, 80)
  assert.equal(a.weather.partial, false)
  assert.equal(a.air.aqi, 160)
  await getActivityConditions(activity, now, { refresh: true })
  assert.equal(calls, 4)
})

test('weather and air forecast windows switch independently at their boundaries', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url)
    const parsed = new URL(url)
    if (url.includes('archive-api')) return response({ daily: history(2016, 2025) })
    const date = parsed.searchParams.get('start_date') ?? '2026-11-10'
    return response({ hourly: hourly(date, { us_aqi: [50, 60, 70] }), daily: {} })
  })
  const run = date => getActivityConditions({ ...activity, latitude: 34, date }, now)
  const day6 = await run('2026-11-10')
  assert.equal(day6.air.kind, 'forecast')
  const day7 = await run('2026-11-11')
  assert.equal(day7.weather.kind, 'forecast')
  assert.equal(day7.air.kind, 'unavailable')
  const day15 = await run('2026-11-19')
  assert.equal(day15.weather.kind, 'forecast')
  const day16 = await run('2026-11-20')
  assert.notEqual(day16.weather.kind, 'forecast')
  assert.ok(calls.some(url => url.includes('archive-api')))
  const december = await run('2026-12-12')
  assert.equal(december.weather.kind, 'seasonal')
  assert.equal(december.air.kind, 'unavailable')
})

test('null air readings never become good AQI, and weather survives air failure', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('air-quality-api')) return response({ hourly: hourly(activity.date, { us_aqi: [null, null, null] }) })
    return response({ hourly: hourly(activity.date), daily: {} })
  })
  const result = await getActivityConditions({ ...activity, latitude: 33 }, now)
  assert.equal(result.weather.kind, 'forecast')
  assert.equal(result.air.kind, 'unavailable')
  globalThis.fetch.mock.mockImplementation(async url => {
    if (url.includes('air-quality-api')) throw new Error('offline')
    return response({ hourly: hourly(activity.date), daily: {} })
  })
  const failed = await getActivityConditions({ ...activity, latitude: 32 }, now)
  assert.equal(failed.weather.kind, 'forecast')
  assert.equal(failed.air.kind, 'error')
})

test('partial time coverage is disclosed and past trips do not call forecast APIs', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return response({ hourly: { time: [`${activity.date}T09:00`], temperature_2m: [12], us_aqi: [65] }, daily: {} })
  })
  const partial = await getActivityConditions({ ...activity, latitude: 31 }, now)
  assert.equal(partial.weather.partial, true)
  assert.equal(partial.air.partial, true)
  const previousCalls = calls
  const past = await getActivityConditions({ ...activity, date: '2026-11-03' }, now)
  assert.equal(calls, previousCalls)
  assert.equal(past.weather.kind, 'unavailable')
})
