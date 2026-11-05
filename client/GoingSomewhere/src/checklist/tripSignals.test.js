// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEATHER_RULES, weatherSignals, destinationSignals, tripSignals } from './tripSignals.js'
import { TAGS } from './recommend.js'
import { suggestionsFor } from './catalog.js'

const tokyo = { destination: 'Tokyo, Japan', center: { lat: 35.68, lng: 139.69 }, timezone: 'Asia/Tokyo' }
const singapore = { destination: 'Singapore', center: { lat: 1.29, lng: 103.85 }, timezone: 'Asia/Singapore' }
const forecast = (w) => ({ kind: 'forecast', codes: [], ...w })

test('weather rules use known tags', () => {
  for (const rule of WEATHER_RULES) assert.ok(TAGS.includes(rule.tag), rule.tag)
})

test('going abroad only outside Singapore, and only when the destination was found', () => {
  assert.deepEqual(destinationSignals(tokyo), [{ tag: 'abroad', reason: 'Going abroad: Tokyo, Japan' }])
  assert.deepEqual(destinationSignals(singapore), [])
  assert.deepEqual(destinationSignals({ destination: 'Atlantis', center: null, timezone: '' }), [])
})

test('forecast: one signal per tag, counting the days it applies to', () => {
  const days = [
    { date: '2026-12-12', weather: forecast({ high: 8, low: 2, precipitationChance: 80, codes: [73] }) },
    { date: '2026-12-13', weather: forecast({ high: 9, low: 3, precipitationChance: 10 }) },
  ]
  assert.deepEqual(weatherSignals(days), [
    { tag: 'rain', reason: 'Forecast: rainy on 1 of 2 days' },
    { tag: 'cold', reason: 'Forecast: cold (10°C or below) on 2 of 2 days' },
    { tag: 'snow', reason: 'Forecast: snowy on 1 of 2 days' },
  ])
})

test('far-off trips use the monthly average; missing numbers never count', () => {
  const days = [
    { date: '2027-07-01', weather: { kind: 'seasonal', high: 32, low: 26, wetDayPercent: 55 } },
    { date: '2027-07-02', weather: { kind: 'seasonal', high: null, low: null, wetDayPercent: null } },
  ]
  assert.deepEqual(weatherSignals(days), [
    { tag: 'rain', reason: 'Usually rainy in July (10-year average)' },
    { tag: 'hot', reason: 'Usually hot (30°C or more) in July (10-year average)' },
  ])
})

test('tripSignals reads each upcoming day through the weather module and skips failures', async () => {
  const now = new Date('2026-12-10T03:00:00Z')
  const asked = []
  const getConditions = async (day) => {
    asked.push(day.date)
    if (day.date === '2026-12-13') throw new Error('offline')
    return { weather: forecast({ high: 6, low: -1, precipitationChance: 0 }) }
  }
  const trip = { ...tokyo, startDate: '2026-12-09', endDate: '2026-12-13' }
  const { signals, weatherDays } = await tripSignals(trip, { now, getConditions })
  assert.deepEqual(asked, ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13']) // the 9th is past
  assert.equal(weatherDays, 3)
  assert.deepEqual(signals.map((s) => s.tag), ['abroad', 'cold'])
})

test('a trip whose destination was not found gets no weather lookups', async () => {
  let called = false
  const trip = { destination: 'Atlantis', center: null, timezone: '', startDate: '2026-12-10', endDate: '2026-12-11' }
  const result = await tripSignals(trip, { getConditions: async () => { called = true } })
  assert.deepEqual(result, { signals: [], weatherDays: 0 })
  assert.equal(called, false)
})

test('end to end: a cold, snowy Tokyo forecast puts warm clothes at the top', () => {
  const signals = [
    ...destinationSignals(tokyo),
    ...weatherSignals([{ date: '2026-12-12', weather: forecast({ high: 3, low: -2, precipitationChance: 90, codes: [73] }) }]),
  ]
  const list = suggestionsFor({ signals })
  const get = (key) => list.find((s) => s.key === key)
  assert.match(get('passport').reason, /Going abroad: Tokyo, Japan/)
  assert.match(get('thermals').reason, /Forecast: cold/)
  assert.ok(!get('swimwear'))
})
