import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itineraryAtmosphere } from './atmosphere.js'

const tokyo = { place: 'Tokyo, Japan', latitude: 35.67 }
test('destination and itinerary month choose seasonal atmosphere without fabricating a forecast', () => {
  const winter = itineraryAtmosphere(tokyo, '2026-12-12')
  assert.equal(winter.effect, 'snow')
  assert.equal(winter.label, 'Winter in Tokyo')
  assert.equal(winter.source, 'seasonal')
  assert.equal(winter.region, 'japan')
  const paris = itineraryAtmosphere({ place: 'Paris, France', latitude: 48.85 }, '2027-03-08')
  assert.equal(paris.effect, 'petals')
  assert.equal(paris.region, 'france')
})
test('southern and tropical destinations avoid a northern winter snow theme', () => {
  assert.equal(itineraryAtmosphere({ place: 'Sydney, Australia', latitude: -33.86 }, '2026-12-12').effect, 'sunshine')
  assert.equal(itineraryAtmosphere({ place: 'Sydney, Australia', latitude: -33.86 }, '2026-06-12').label, 'Winter in Sydney')
  assert.equal(itineraryAtmosphere({ place: 'Singapore, Singapore', latitude: 1.35 }, '2026-12-12').effect, 'sunshine')
})
test('real forecast weather overrides seasonal decoration, including clear winter days', () => {
  for (const [codes, effect] of [[[0], 'sunshine'], [[3], 'clouds'], [[61], 'rain'], [[73], 'snow'], [[95], 'rain']]) {
    const theme = itineraryAtmosphere(tokyo, '2026-12-12', { kind: 'forecast', codes })
    assert.equal(theme.effect, effect)
    assert.equal(theme.source, 'forecast')
  }
})
test('missing and failed forecasts retain the appropriate seasonal theme', () => {
  assert.equal(itineraryAtmosphere(tokyo, '2026-12-12', { kind: 'error' }).effect, 'snow')
  assert.equal(itineraryAtmosphere(tokyo, '2026-12-12', { kind: 'forecast', codes: [] }).source, 'seasonal')
  assert.equal(itineraryAtmosphere(tokyo, '').effect, 'clouds')
})
