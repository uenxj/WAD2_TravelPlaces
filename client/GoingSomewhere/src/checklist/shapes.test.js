// Run with: pnpm test:checklist
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ITEMS, CATEGORIES } from './catalog.js'
import { SHAPES, KEY_SHAPES, shapeFor } from './shapes.js'

test('every catalogue item has its own drawn shape', () => {
  for (const key of Object.keys(ITEMS)) {
    assert.ok(KEY_SHAPES[key], `no shape for ${key}`)
    assert.ok(SHAPES[KEY_SHAPES[key]], `shape ${KEY_SHAPES[key]} not drawn`)
  }
})

test('typed items get a shape from their name, longest word first', () => {
  const cases = {
    'Spare house keys': 'keys',
    'Phone charger + cable': 'charger',
    'Hoodie': 'jacket',
    'Swimming goggles': 'goggles',
    'Travel plug adapter': 'adapter',
    'Reusable water bottle': 'waterbottle',
    'Kindle': 'laptop',
  }
  for (const [name, shape] of Object.entries(cases)) assert.equal(shapeFor({ name, category: 'Essentials' }), shape, name)
})

test('unknown names fall back to a shape for their category', () => {
  for (const c of CATEGORIES) {
    const shape = shapeFor({ name: 'Mystery thing', category: c.name })
    assert.ok(SHAPES[shape], `${c.name} -> ${shape}`)
  }
})
