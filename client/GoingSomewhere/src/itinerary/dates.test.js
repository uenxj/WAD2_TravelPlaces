// Run with: pnpm test:itinerary   (plain Node, no browser needed)
import test from 'node:test'
import assert from 'node:assert/strict'
import { todayLocal, tripDays, longDate, dateRange } from './dates.js'

test('todayLocal is a YYYY-MM-DD string for the local calendar date', () => {
  const d = new Date()
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  assert.match(todayLocal(), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(todayLocal(), expected)
})

test('tripDays lists every day from start to end, across a month end', () => {
  const days = tripDays({ startDate: '2026-11-29', endDate: '2026-12-02' })
  assert.deepEqual(days.map((d) => d.date), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  assert.equal(days[0].label, 'Sun, 29 Nov')
})

test('tripDays for a one-day trip is that one day', () => {
  assert.equal(tripDays({ startDate: '2026-11-07', endDate: '2026-11-07' }).length, 1)
})

test('dates are formatted from the calendar date, whatever the local timezone is', () => {
  assert.equal(longDate('2026-11-07'), '7 Nov 2026')
  assert.equal(dateRange('2026-11-07', '2026-11-09'), '7 Nov – 9 Nov 2026')
  assert.equal(dateRange('2026-11-07', '2026-11-07'), '7 Nov 2026')
})
