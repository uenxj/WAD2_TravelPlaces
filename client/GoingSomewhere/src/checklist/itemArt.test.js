// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { ITEMS, CATEGORIES } from './catalog.js'
import { KEY_ART, ALL_ART, artFor } from './itemArt.js'

const file = (name) => new URL(`../assets/checklist/items/${name}.svg`, import.meta.url)

test('every catalogue item has a picture', () => {
  for (const key of Object.keys(ITEMS)) assert.ok(KEY_ART[key], `no picture for ${key}`)
})

test('every picture the app can use exists in src/assets/checklist/items', () => {
  for (const name of ALL_ART) assert.ok(existsSync(file(name)), `missing ${name}.svg`)
  assert.ok(existsSync(new URL('../assets/checklist/items/LICENSE.txt', import.meta.url)), 'licence notice missing')
})

test('typed items get a picture from their name, longest word first', () => {
  const cases = {
    'Spare house keys': 'key',
    'Phone charger + cable': 'electric_plug',
    'Hoodie': 'coat',
    'Swimming goggles': 'goggles',
    'Reusable water bottle': 'cup_with_straw',
    'Kindle': 'laptop',
    'Beach towel': 'roll_of_paper',
  }
  for (const [name, art] of Object.entries(cases)) assert.equal(artFor({ name, category: 'Essentials' }), art, name)
})

test('unknown names fall back to a picture for their category', () => {
  for (const c of CATEGORIES) assert.ok(existsSync(file(artFor({ name: 'Mystery thing', category: c.name }))), c.name)
})
