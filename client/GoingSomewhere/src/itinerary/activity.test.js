import test from 'node:test'
import assert from 'node:assert/strict'
import { toConditionsActivity } from './activity.js'
import { validateActivity } from '../weather/conditions.js'

const item = (extra = {}) => ({
  _id: 'a1', title: 'Fushimi Inari', date: '2026-12-12', startTime: '09:00', endTime: '11:00', setting: 'outdoor',
  weather: { coordinates: { lat: 34.9671, lng: 135.7727 }, timezone: 'Asia/Tokyo' },
  ...extra,
})

test('an itinerary activity becomes the object the weather module reads, and passes its validation', () => {
  const a = toConditionsActivity(item())
  assert.deepEqual(a, {
    id: 'a1', name: 'Fushimi Inari', latitude: 34.9671, longitude: 135.7727,
    date: '2026-12-12', startTime: '09:00', endTime: '11:00', timezone: 'Asia/Tokyo', environment: 'outdoor',
  })
  assert.doesNotThrow(() => validateActivity(a))
})

test('"Indoor & Outdoor" is called mixed by the weather module', () => {
  const a = toConditionsActivity(item({ setting: 'both' }))
  assert.equal(a.environment, 'mixed')
  assert.doesNotThrow(() => validateActivity(a))
})

test('an activity with no setting is treated as indoor', () => {
  assert.equal(toConditionsActivity(item({ setting: undefined })).environment, 'indoor')
})

test('no coordinates or no timezone: nothing to look up', () => {
  assert.equal(toConditionsActivity(item({ weather: { coordinates: null, timezone: 'Asia/Tokyo' } })), null)
  assert.equal(toConditionsActivity(item({ weather: { coordinates: { lat: 1, lng: 2 }, timezone: null } })), null)
  assert.equal(toConditionsActivity(item({ weather: undefined })), null)
})
