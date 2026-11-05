// Run with: pnpm test:itinerary   (plain Node, no browser needed)
import test from 'node:test'
import assert from 'node:assert/strict'
import { findSameActivity, normalizeTitle } from './duplicates.js'

const items = [
  { _id: '1', title: 'Gardens by the Bay', placeId: 'W1', date: '2026-12-05', startTime: '14:00' },
  { _id: '2', title: 'gardens  by the bay', placeId: '', date: '2026-12-04', startTime: '10:00' },
  { _id: '3', title: 'Gardens by the Bay', placeId: '', date: '2026-12-06', startTime: '09:00' },
  { _id: '4', title: 'Zoo', placeId: 'W2', date: '2026-12-05', startTime: '09:00' },
]

test('the same title on other days is found, earliest day first, ignoring case and extra spaces', () => {
  const found = findSameActivity(items, { title: ' GARDENS by the bay ', date: '2026-12-07' })
  assert.deepEqual(found.map((i) => i._id), ['2', '1', '3'])
})

test('the same suggested place matches even when the title was changed', () => {
  assert.deepEqual(findSameActivity(items, { title: 'Zoo trip', placeId: 'W2', date: '2026-12-04' }).map((i) => i._id), ['4'])
})

test('a copy on the same day is not offered (that shows as a time clash instead)', () => {
  assert.deepEqual(findSameActivity(items, { title: 'Zoo', date: '2026-12-05' }), [])
})

test('different activities and empty titles match nothing', () => {
  assert.deepEqual(findSameActivity(items, { title: 'Museum', date: '2026-12-04' }), [])
  assert.deepEqual(findSameActivity(items, { title: '  ', date: '2026-12-04' }), [])
  assert.deepEqual(findSameActivity([], { title: 'Zoo', date: '2026-12-04' }), [])
})

test('normalizeTitle', () => assert.equal(normalizeTitle('  A   b '), 'a b'))
