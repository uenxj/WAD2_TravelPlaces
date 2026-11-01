// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIES, ITEMS, DEFAULT_KEYS, TRIP_TYPES, CRITICAL, SCENARIOS,
  suggestionsFor, withoutExisting, guessCategory, essentialsCheck, checkScenarios, generatePlan,
} from './catalog.js'

test('generatePlan: starter essentials plus trip-type items, each once, with reasons', () => {
  const basic = generatePlan()
  assert.equal(basic.length, DEFAULT_KEYS.length)
  assert.ok(basic.every((p) => p.source === 'default'))

  const plan = generatePlan({ tripTypes: ['beach', 'international'] })
  const keys = plan.map((p) => p.key)
  assert.equal(new Set(keys).size, keys.length, 'no duplicates')
  assert.equal(plan.find((p) => p.key === 'passport').source, 'default') // already a starter item
  const sunscreen = plan.find((p) => p.key === 'sunscreen')
  assert.equal(sunscreen.source, 'suggested')
  assert.equal(sunscreen.reason, 'Beach trip')
  assert.ok(keys.includes('adapter'))
})

test('every catalogue item uses a known category', () => {
  const names = CATEGORIES.map((c) => c.name)
  for (const [key, item] of Object.entries(ITEMS)) assert.ok(names.includes(item.category), key)
  for (const key of [...DEFAULT_KEYS, ...TRIP_TYPES.flatMap((t) => t.keys)]) assert.ok(ITEMS[key], key)
})

test('trip types suggest items once, with merged reasons', () => {
  const list = suggestionsFor({ tripTypes: ['beach', 'swimming'] })
  const swimwear = list.filter((s) => s.key === 'swimwear')
  assert.equal(swimwear.length, 1)
  assert.equal(swimwear[0].reason, 'Beach trip · Swimming trip')
})

test('itinerary activities map to suggestions with the activity as reason', () => {
  const list = suggestionsFor({ activities: [{ title: 'Sentosa beach day' }, { title: 'Museum visit' }] })
  const sunscreen = list.find((s) => s.key === 'sunscreen')
  assert.ok(sunscreen)
  assert.match(sunscreen.reason, /Sentosa beach day/)
  assert.ok(!list.some((s) => s.reason.includes('Museum')))
})

test('existing items are filtered out by key or by name', () => {
  const list = suggestionsFor({ tripTypes: ['beach'] })
  const left = withoutExisting(list, [
    { name: 'Sunscreen', suggestionKey: 'sunscreen' },
    { name: '  swimwear ', suggestionKey: null },
  ])
  assert.ok(!left.some((s) => s.key === 'sunscreen' || s.key === 'swimwear'))
  assert.equal(left.length, list.length - 2)
})

test('no trip types and no activities means no suggestions', () => {
  assert.deepEqual(suggestionsFor(), [])
})

test('guessCategory sorts typed items, longest keyword first', () => {
  const cases = {
    'Phone charger': 'Electronics',
    'Laptop + cable': 'Electronics',
    'Sun hat': 'Clothing',
    'Cardigan': 'Clothing',
    'Toiletry bag': 'Toiletries',
    'Hand sanitiser': 'Health',
    'Passport': 'Documents',
    'Boarding pass printout': 'Documents',
    'Daypack': 'Essentials',
    'Spare house keys': 'Essentials',
  }
  for (const [name, category] of Object.entries(cases)) assert.equal(guessCategory(name), category, name)
})

test('critical items and scenarios only point at real catalogue items', () => {
  for (const c of CRITICAL) assert.ok(ITEMS[c.key], c.key)
  for (const s of SCENARIOS) for (const key of s.keys) assert.ok(ITEMS[key], `${s.id}: ${key}`)
})

test('essentialsCheck finds missing, unpacked and packed items, including typed ones', () => {
  const items = [
    { name: 'Passport', suggestionKey: 'passport', done: true },
    { name: 'Phone charger + cable', suggestionKey: null, done: false },
    { name: 'Spare house keys', suggestionKey: null, done: true },
  ]
  const byKey = Object.fromEntries(essentialsCheck(items).map((e) => [e.key, e.state]))
  assert.deepEqual(byKey, {
    passport: 'packed', bookings: 'missing', wallet: 'missing',
    'phone-charger': 'unpacked', medication: 'missing', 'house-keys': 'packed',
  })
})

test('checkScenarios reports what covers each scenario', () => {
  const result = checkScenarios([
    { name: 'Compact umbrella', suggestionKey: 'umbrella', done: false },
    { name: 'Anker power bank', suggestionKey: null, done: true },
  ])
  const by = Object.fromEntries(result.map((r) => [r.id, r]))
  assert.equal(by.rain.covered, true)
  assert.equal(by.rain.by.name, 'Compact umbrella')
  assert.equal(by.battery.covered, true)
  assert.equal(by.plug.covered, false)
  assert.equal(by.plug.fixKey, 'adapter')
  assert.equal(result.filter((r) => r.covered).length, 2)
})

test('guessCategory returns null when unsure', () => {
  assert.equal(guessCategory('Souvenirs for grandma'), null)
  assert.equal(guessCategory('ab'), null)
  assert.equal(guessCategory(''), null)
})
