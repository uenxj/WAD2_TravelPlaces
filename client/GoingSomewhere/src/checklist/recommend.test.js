// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAGS, TAG_WORDS, tagActivity, activitySignals, backupSignals, recommend } from './recommend.js'
import { ITEMS, TRIP_TYPES, suggestionsFor } from './catalog.js'

test('all metadata uses known tags and weights 1-3', () => {
  for (const [key, item] of Object.entries(ITEMS)) {
    for (const [tag, w] of Object.entries(item.needs ?? {})) {
      assert.ok(TAGS.includes(tag), `${key}: unknown tag ${tag}`)
      assert.ok([1, 2, 3].includes(w), `${key}: weight ${w}`)
    }
  }
  for (const t of TRIP_TYPES) for (const tag of t.tags) assert.ok(TAGS.includes(tag), `${t.id}: ${tag}`)
  for (const tag of Object.keys(TAG_WORDS)) assert.ok(TAGS.includes(tag), tag)
  for (const tag of TAGS) {
    assert.ok(Object.values(ITEMS).some((i) => i.needs?.[tag]), `no item is for "${tag}"`)
  }
})

test('structured itinerary tags/type are used as given; titles are the fallback', () => {
  assert.deepEqual(tagActivity({ title: 'Day 3', type: 'hike' }), ['hike'])
  assert.deepEqual(tagActivity({ title: 'Free time', tags: ['beach', 'swim', 'unknown'] }), ['beach', 'swim'])
  assert.deepEqual(tagActivity({ title: 'Snorkelling at Sentosa' }).sort(), ['beach', 'swim'])
  assert.deepEqual(tagActivity({ title: 'Skiing in Niseko' }), ['ski'])
  assert.deepEqual(tagActivity({ title: 'Dinner with friends' }), [])
  assert.deepEqual(tagActivity({ title: 'Kiski village' }), [], 'words match at the start only')
})

test('activitySignals keep the activity and date in the reason', () => {
  assert.deepEqual(activitySignals([{ title: 'Museum visit', date: '2026-12-12' }, { title: '' }]),
    [{ tag: 'city', reason: 'Itinerary: “Museum visit” on 2026-12-12' }])
})

test('scores rank core needs first and merge reasons for the same item', () => {
  const list = recommend([{ tag: 'hike', reason: 'Itinerary: “Hike”' }, { tag: 'hot', reason: 'Hot' }])
  // sunscreen: hot 3 + hike 2 (+ essential), water bottle: hike 3 + hot 2
  assert.deepEqual(list.slice(0, 2).map((s) => s.key), ['sunscreen', 'water-bottle'])
  assert.ok(list.find((s) => s.key === 'hiking-shoes').score > list.find((s) => s.key === 'first-aid').score)
  const sunscreen = list.find((s) => s.key === 'sunscreen')
  assert.deepEqual(sunscreen.reasons, ['Hot', 'Itinerary: “Hike”'])
  assert.ok(list.every((s, i) => i === 0 || list[i - 1].score >= s.score), 'sorted by score')
  assert.equal(new Set(list.map((s) => s.key)).size, list.length)
})

test('independent evidence for the same tag counts more, but is capped', () => {
  const once = recommend([{ tag: 'snow', reason: 'A' }]).find((s) => s.key === 'snow-boots').score
  const twice = recommend([{ tag: 'snow', reason: 'A' }, { tag: 'snow', reason: 'B' }]).find((s) => s.key === 'snow-boots').score
  const many = recommend(['A', 'B', 'C', 'D', 'E'].map((r) => ({ tag: 'snow', reason: r }))).find((s) => s.key === 'snow-boots').score
  const same = recommend([{ tag: 'snow', reason: 'A' }, { tag: 'snow', reason: 'A' }]).find((s) => s.key === 'snow-boots').score
  assert.ok(twice > once && many <= once * 1.5 + 0.5 && same === once)
})

test('example: Japan in December with skiing (destination/weather given as plain inputs)', () => {
  // In the app these signals will come from the trips and weather features once they exist.
  const list = suggestionsFor({
    signals: [
      { tag: 'abroad', reason: 'Going abroad: Japan' },
      { tag: 'cold', reason: 'Cold in December' },
      { tag: 'snow', reason: 'Snowy in December' },
    ],
    activities: [{ title: 'Skiing in Niseko', date: '2026-12-14' }],
  })
  const get = (key) => list.find((s) => s.key === key)
  assert.equal(new Set(list.map((s) => s.key)).size, list.length, 'one entry per item')
  assert.match(get('passport').reason, /Going abroad: Japan/)
  assert.match(get('ski-goggles').reason, /Itinerary: “Skiing in Niseko” on 2026-12-14/)
  assert.equal(get('thermals').reasons.length, 3) // ski activity + cold + snow
  assert.equal(get('thermals').level, 'Top pick')
  assert.ok(list.findIndex((s) => s.key === 'thermals') < 5)
  assert.ok(!get('swimwear'))
  // no rain on this trip: the umbrella is only a low-ranked "what if" backup
  assert.ok(get('umbrella').backupOnly && get('umbrella').level === 'Nice to have')
  assert.match(get('doc-copies').reason, /Backup: if you lose your passport/)
})

test('backups: weaker than real needs, and `when` limits them to matching trips', () => {
  const backups = [
    { tag: 'rain', reason: 'Backup: rain' },
    { tag: 'lost-docs', reason: 'Backup: passport', when: ['abroad'] },
  ]
  assert.deepEqual(backupSignals(backups, []).map((s) => s.tag), ['rain'])
  assert.deepEqual(backupSignals(backups, [{ tag: 'abroad' }]).map((s) => s.tag), ['rain', 'lost-docs'])
  const asBackup = recommend(backupSignals(backups, [])).find((s) => s.key === 'umbrella')
  const asNeed = recommend([{ tag: 'rain', reason: 'Rainy season trip' }]).find((s) => s.key === 'umbrella')
  assert.ok(asBackup.score < asNeed.score && asBackup.backupOnly && !asNeed.backupOnly)
})

test('unknown tags and empty context give nothing', () => {
  assert.deepEqual(recommend([]), [])
  assert.deepEqual(recommend([{ tag: 'volcano-surfing', reason: 'x' }]), [])
})
