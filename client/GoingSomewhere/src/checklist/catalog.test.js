// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIES, ITEMS, DEFAULT_KEYS, TRIP_TYPES, CRITICAL, BACKUPS,
  suggestionsFor, withoutExisting, guessCategory, essentialsCheck, generatePlan,
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
  for (const key of DEFAULT_KEYS) assert.ok(ITEMS[key], key)
  for (const t of TRIP_TYPES) assert.ok(t.tags.length, `${t.id} has tags`)
})

test('trip types suggest items once, with merged reasons', () => {
  const list = suggestionsFor({ tripTypes: ['beach', 'swimming'] })
  const swimwear = list.filter((s) => s.key === 'swimwear')
  assert.equal(swimwear.length, 1)
  assert.equal(swimwear[0].reason, 'Beach trip · Swimming trip')
})

test('itinerary activities map to suggestions with the activity as reason', () => {
  const list = suggestionsFor({ activities: [{ title: 'Sentosa beach day' }, { title: 'Dinner with friends' }] })
  const sunscreen = list.find((s) => s.key === 'sunscreen')
  assert.ok(sunscreen)
  assert.match(sunscreen.reason, /Sentosa beach day/)
  assert.ok(!list.some((s) => s.reason.includes('Dinner')))
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

test('with nothing picked, only the always-on backups are suggested', () => {
  const list = suggestionsFor()
  assert.ok(list.length > 0)
  assert.ok(list.every((s) => s.backupOnly && s.reasons.every((r) => r.startsWith('Backup:'))))
  assert.ok(!list.some((s) => s.key === 'doc-copies'), 'lost-passport backup only applies abroad')
  assert.ok(list.every((s) => s.level === 'Nice to have'))
})

test('backups rank below what the trip needs and stay out of the generated list', () => {
  const list = suggestionsFor({ tripTypes: ['international'] })
  const adapter = list.findIndex((s) => s.key === 'adapter')
  const copies = list.find((s) => s.key === 'doc-copies')
  const cash = list.findIndex((s) => s.key === 'local-cash')
  assert.ok(adapter < list.findIndex((s) => s.key === 'power-bank'), 'trip need before backup-only item')
  assert.deepEqual(copies.reasons, ['Overseas trip', 'Backup: if you lose your passport'])
  assert.ok(cash >= 0)
  const plan = generatePlan({ tripTypes: ['international'] }).map((p) => p.key)
  assert.ok(plan.includes('adapter') && plan.includes('doc-copies'))
  assert.ok(!plan.includes('umbrella') && !plan.includes('first-aid'), 'backup-only items are not auto-added')
})

test('items typed by hand count as covering a suggestion (via `also`)', () => {
  const left = withoutExisting(suggestionsFor(), [
    { name: 'Anker power bank', suggestionKey: null },
    { name: 'Raincoat', suggestionKey: null },
  ])
  assert.ok(!left.some((s) => s.key === 'power-bank' || s.key === 'rain-jacket'))
  assert.ok(left.some((s) => s.key === 'umbrella'))
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

test('critical items point at real items, and every backup is covered by some item', () => {
  for (const c of CRITICAL) assert.ok(ITEMS[c.key], c.key)
  for (const b of BACKUPS) assert.ok(Object.values(ITEMS).some((i) => i.needs?.[b.tag]), b.tag)
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

test('guessCategory returns null when unsure', () => {
  assert.equal(guessCategory('Souvenirs for grandma'), null)
  assert.equal(guessCategory('ab'), null)
  assert.equal(guessCategory(''), null)
})
