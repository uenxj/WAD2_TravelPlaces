import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewActivities } from './review.js'
import { planningIssues } from '../planning/review.js'
import { getActivityConditions, parsePsi } from './api.js'
import { psiCategory } from './conditions.js'

const now = new Date('2026-11-04T02:00:00Z')
const activity = { id: 'garden', name: 'Garden walk', date: '2026-11-04', startTime: '10:00', endTime: '12:00', latitude: 35.68, longitude: 139.69, timezone: 'Asia/Tokyo', environment: 'outdoor' }
const clear = () => ({ weather: { kind: 'forecast', precipitationChance: 0, feelsHigh: 20, feelsLow: 15, codes: [0], wind: 5 }, air: { kind: 'forecast', aqi: 40 }, psi: { kind: 'not-applicable' } })

test('day warnings follow actual outdoor slots, not rainy hours elsewhere in the day', async () => {
  const activities = [
    { ...activity, id: 'indoor', name: 'Breakfast', startTime: '06:00', endTime: '07:00', environment: 'indoor' },
    activity,
    { ...activity, id: 'evening', name: 'Evening walk', startTime: '18:00', endTime: '19:00' },
  ]
  const seen = []
  const result = await reviewActivities(activities, { now, getConditions: async a => {
    seen.push([a.startTime, a.latitude, a.longitude])
    const conditions = clear()
    conditions.weather.precipitationChance = a.startTime === '10:00' ? 0 : 90
    return conditions
  } })
  assert.equal(seen.length, 3)
  assert.equal(result.issues.length, 1)
  assert.deepEqual(result.issues[0].activityIds, ['evening'])
  assert.match(result.issues[0].title, /Evening walk.*18:00/)
  assert.equal(result.outdoorCount, 2)
})

test('different venue coordinates and mixed activities are checked individually', async () => {
  const result = await reviewActivities([activity, { ...activity, id: 'other', name: 'Waterfront', startTime: '14:00', endTime: '15:00', latitude: 1.35, longitude: 103.82, environment: 'mixed' }], {
    now, getConditions: async a => ({ ...clear(), air: { kind: 'forecast', aqi: a.latitude === 1.35 ? 170 : 40 } }),
  })
  assert.equal(result.issues.length, 1)
  assert.deepEqual(result.issues[0].activityIds, ['other'])
  assert.equal(result.issues[0].source, 'air-quality')
})

test('missing forecasts and seasonal estimates remain incomplete without invented activity danger', async () => {
  const result = await reviewActivities([activity, { ...activity, id: 'missing', startTime: '14:00', endTime: '15:00' }], {
    now, getConditions: async a => {
      if (a.id === 'missing') throw new Error('missing coordinates')
      return { weather: { kind: 'seasonal', low: 0, wetDayPercent: 80 }, air: { kind: 'unavailable' } }
    },
  })
  assert.equal(result.incompleteCount, 2)
  assert.equal(result.issues.length, 0)
})

test('schedule checks use end-exclusive overlap and respect separate agendas', () => {
  assert.equal(planningIssues([activity, { ...activity, id: 'next', startTime: '12:00', endTime: '13:00' }]).length, 0)
  const result = planningIssues([activity, { ...activity, id: 'clash', name: 'Museum', startTime: '11:00', endTime: '13:00' }])
  assert.equal(result[0].source, 'schedule')
  assert.deepEqual(result[0].activityIds, ['garden', 'clash'])
  assert.equal(planningIssues([{ ...activity, agendaId: 'alex' }, { ...activity, id: 'other', agendaId: 'sam' }]).length, 0)
})

test('cross-timezone agendas are disclosed rather than compared as matching local clocks', () => {
  const issues = planningIssues([activity, { ...activity, id: 'paris', timezone: 'Europe/Paris' }])
  assert.equal(issues.length, 1)
  assert.equal(issues[0].level, 'info')
  assert.match(issues[0].title, /timezone/)
})

test('budget, schedule and weather can be returned as one issue contract', () => {
  const issues = planningIssues([ { ...activity, estimatedCostHome: 100, completed: true }, { ...activity, id: 'museum', estimatedCostHome: 120 } ], {
    budget: { total: 200, spentTotal: 100, homeCurrency: 'SGD' },
    weatherIssues: [{ id: 'air:garden', source: 'air-quality', title: 'Poor air quality', activityIds: ['garden'] }],
  })
  assert.deepEqual(new Set(issues.map(issue => issue.source)), new Set(['schedule', 'budget', 'air-quality']))
  assert.match(issues.find(issue => issue.source === 'budget').text, /220.00/)
})

const singapore = { ...activity, latitude: 1.35, longitude: 103.7, timezone: 'Asia/Singapore', countryCode: 'SG' }
function psiData(value = 120, timestamp = '2026-11-04T01:30:00Z') {
  return { code: 0, data: { regionMetadata: [
    { name: 'west', labelLocation: { latitude: 1.35, longitude: 103.7 } },
    { name: 'east', labelLocation: { latitude: 1.35, longitude: 103.94 } },
  ], items: [{ timestamp, readings: { psi_twenty_four_hourly: { west: value, east: 50 } } }] } }
}

test('Singapore PSI uses a recent nearest-region observation and rejects stale or null readings', () => {
  assert.equal(parsePsi(psiData(), singapore, now).value, 120)
  assert.equal(parsePsi(psiData(), singapore, now).region, 'west')
  assert.equal(parsePsi(psiData(null), singapore, now).kind, 'unavailable')
  assert.equal(parsePsi(psiData(120, '2026-11-03T12:00:00Z'), singapore, now).kind, 'unavailable')
  assert.equal(psiCategory(101), 'Unhealthy')
  assert.equal(psiCategory(201), 'Very unhealthy')
  assert.equal(psiCategory(301), 'Hazardous')
})

test('PSI warnings apply to activities happening now, never future slots or indoor activities', async () => {
  const activities = [
    { ...singapore, id: 'now', startTime: '09:00', endTime: '11:00' },
    { ...singapore, id: 'later', startTime: '14:00', endTime: '15:00' },
    { ...singapore, id: 'indoors', environment: 'indoor', startTime: '09:00', endTime: '11:00', agendaId: 'other' },
  ]
  const review = await reviewActivities(activities, { now, getConditions: async () => ({ ...clear(), psi: parsePsi(psiData(), singapore, now) }) })
  const psiIssues = review.issues.filter(issue => issue.source === 'psi')
  assert.equal(psiIssues.length, 1)
  assert.deepEqual(psiIssues[0].activityIds, ['now'])
})

test('future Singapore activities never request or reuse current PSI as a forecast', async t => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url)
    return { ok: true, json: async () => ({ hourly: {}, daily: {} }) }
  })
  const result = await getActivityConditions({ ...singapore, date: '2026-11-05' }, now)
  assert.equal(result.psi.kind, 'unavailable')
  assert.ok(urls.every(url => !url.includes('data.gov.sg')))
})


test('precipitation warnings distinguish rain from snow using local forecast codes', async () => {
  for (const [code, expected] of [[61, 'Rain'], [73, 'Snow'], [null, 'Precipitation']]) {
    const result = await reviewActivities([activity], { now, getConditions: async () => ({ ...clear(), weather: { kind: 'forecast', precipitationChance: 90, codes: code === null ? [] : [code] } }) })
    assert.match(result.issues[0].title, new RegExp(`${expected} may affect`))
  }
})
