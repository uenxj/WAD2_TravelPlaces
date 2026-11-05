import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currencyForDestination } from './destinationCurrency.js'

test('common destinations map to their currency', () => {
  assert.equal(currencyForDestination('Tokyo, Japan'), 'JPY')
  assert.equal(currencyForDestination('Singapore'), 'SGD')
  assert.equal(currencyForDestination('Paris'), 'EUR')
  assert.equal(currencyForDestination('London, UK'), 'GBP')
  assert.equal(currencyForDestination('Hong Kong, China'), 'HKD')
})

test('unknown or empty destinations give null, so the Budget page keeps its default', () => {
  assert.equal(currencyForDestination('Reykjavik'), null)
  assert.equal(currencyForDestination(''), null)
  assert.equal(currencyForDestination(undefined), null)
  assert.equal(currencyForDestination('Fukuoka'), 'JPY') // "uk" inside a word is not the UK
})
