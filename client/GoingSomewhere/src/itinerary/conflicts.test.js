// Run with: pnpm test:itinerary   (plain Node, no browser needed)
import test from 'node:test'
import assert from 'node:assert/strict'
import { liveConflicts, addMinutes, toMinutes } from './conflicts.js'

const D = '2026-12-04'
const existing = [
  { _id: 'a', title: 'Gardens by the Bay', date: D, startTime: '09:00', endTime: '11:00', createdBy: 'bob', createdByName: 'Bob' },
  { _id: 'b', title: 'Lunch', date: D, startTime: '12:00', endTime: '13:00', createdBy: 'alice', createdByName: 'Alice' },
  { _id: 'c', title: 'Zoo', date: '2026-12-05', startTime: '09:00', endTime: '11:00', createdBy: 'bob', createdByName: 'Bob' },
]
const check = (draft, options) => liveConflicts(existing, { date: D, ...draft }, options)

test('a start time of 09:00 or 10:00 inside a 09:00-11:00 activity warns straight away', () => {
  assert.equal(check({ startTime: '09:00', endTime: '09:00' }).length, 1)
  assert.equal(check({ startTime: '10:00', endTime: '10:00' }).length, 1)
  assert.equal(check({ startTime: '10:00', endTime: '' }).length, 1)
})

test('a full range that overlaps warns, and one that only touches does not', () => {
  assert.equal(check({ startTime: '08:00', endTime: '09:30' }).length, 1)
  assert.equal(check({ startTime: '10:30', endTime: '12:30' }).map((c) => c.itemId).join(), 'a,b')
  assert.equal(check({ startTime: '11:00', endTime: '12:00' }).length, 0) // back to back is fine
  assert.equal(check({ startTime: '07:00', endTime: '09:00' }).length, 0)
})

test('only the chosen day is checked', () => {
  assert.equal(liveConflicts(existing, { date: '2026-12-06', startTime: '09:30', endTime: '10:00' }).length, 0)
  assert.equal(liveConflicts(existing, { date: '2026-12-05', startTime: '09:30', endTime: '10:00' })[0].itemId, 'c')
})

test('editing an activity does not clash with itself', () => {
  assert.equal(check({ startTime: '09:30', endTime: '10:30' }, { ignoreId: 'a' }).length, 0)
})

test('the message names the person who added it, unless it is you', () => {
  const [other] = check({ startTime: '10:00', endTime: '10:30' }, { currentUserId: 'alice' })
  assert.equal(other.message, 'Overlaps with "Gardens by the Bay" (09:00-11:00), added by Bob.')
  const [mine] = check({ startTime: '12:30', endTime: '12:45' }, { currentUserId: 'alice' })
  assert.equal(mine.message, 'Overlaps with "Lunch" (12:00-13:00).')
})

test('missing or half-typed times give no warning and never throw', () => {
  assert.deepEqual(check({ startTime: '', endTime: '' }), [])
  assert.deepEqual(check({ startTime: '9', endTime: '10' }), [])
  assert.deepEqual(liveConflicts([], { date: D, startTime: '09:00', endTime: '10:00' }), [])
})

test('addMinutes moves a time on and stops at the end of the day', () => {
  assert.equal(addMinutes('09:00', 60), '10:00')
  assert.equal(addMinutes('23:30', 60), '23:59')
  assert.equal(toMinutes('01:05'), 65)
})
