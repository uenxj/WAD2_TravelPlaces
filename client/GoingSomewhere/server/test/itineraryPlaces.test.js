const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { getTopPlaces, clearPlacesCache, insideGeometry, PlacesError } = require('../src/itinerary/places');

const realFetch = globalThis.fetch
let calls
beforeEach(() => { clearPlacesCache(); calls = []; process.env.OPENTRIPMAP_KEY = 'test-key'; process.env.NOMINATIM_DELAY_MS = '0' })
afterEach(() => { globalThis.fetch = realFetch })

// nominatimByQuery: { 'kyoto, japan': [results] }. Any query not listed returns no results.
function mockFetch(otmPlaces, nominatimByQuery = { singapore: [{ display_name: 'Singapore', importance: 1, boundingbox: ['1.2', '1.5', '103.6', '104.0'] }] }) {
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('nominatim')) {
      const q = new URL(url).searchParams.get('q').toLowerCase()
      return Response.json(nominatimByQuery[q] || [])
    }
    return Response.json(otmPlaces)
  }
}

const place = (xid, name, rate, kinds = 'museums') => ({ xid, name, rate, kinds, point: { lat: 1.3, lon: 103.8 } })

test('returns best-rated places first, drops unnamed and duplicates, caps at the limit', async () => {
  mockFetch([
    place('a', 'Low', 1), place('b', 'Top', 7), place('c', '', 7),
    place('d', 'Top', 3), place('e', 'Mid', 3, 'gardens_and_parks,natural'),
  ])
  const { places: out } = await getTopPlaces('Singapore', { limit: 2 })
  assert.deepEqual(out.map((p) => p.name), ['Top', 'Mid'])
  assert.equal(out[1].setting, 'outdoor')
  assert.equal(out[0].lat, 1.3)
  assert.equal(out[0].lng, 103.8)
})

test('uses the bounding box and API key, and caches repeat lookups', async () => {
  mockFetch([place('a', 'A', 3)])
  await getTopPlaces('Singapore')
  await getTopPlaces('  singapore ')
  assert.equal(calls.length, 2) // one Nominatim + one OpenTripMap, second lookup came from cache
  assert.match(calls[1], /lon_min=103\.6/)
  assert.match(calls[1], /lat_max=1\.5/)
  assert.match(calls[1], /apikey=test-key/)
})

test('explains a missing API key', async () => {
  delete process.env.OPENTRIPMAP_KEY
  await assert.rejects(getTopPlaces('Japan'), (e) => e instanceof PlacesError && e.status === 503)
})

test('rejects an empty destination', async () => {
  await assert.rejects(getTopPlaces('  '), (e) => e instanceof PlacesError && e.status === 400)
})

const kyoto = [{ display_name: 'Kyoto, Kyoto Prefecture, 600-8216, Japan', importance: 0.7, boundingbox: ['34.85', '35.15', '135.60', '135.90'] }]

test('"City, Country" searches only that city and reports the matched area', async () => {
  mockFetch([place('a', 'Kinkaku-ji', 7)], { 'kyoto, japan': kyoto })
  const { area, places } = await getTopPlaces('Kyoto, Japan')
  assert.equal(area, 'Kyoto, Japan')
  assert.equal(places[0].name, 'Kinkaku-ji')
  assert.match(calls[0], /featuretype=settlement/)
  assert.match(calls[1], /lat_min=34\.85/) // Kyoto's box, not Japan's
})

test('also understands the reversed order "Japan, Kyoto"', async () => {
  mockFetch([place('a', 'Kinkaku-ji', 7)], { 'kyoto, japan': kyoto })
  const { area } = await getTopPlaces('Japan, Kyoto')
  assert.equal(area, 'Kyoto, Japan')
})

test('ignores a match that does not contain every part the user typed', async () => {
  mockFetch([], { 'kyoto, france': [{ display_name: 'Kyoto Garden, London, United Kingdom', importance: 0.9, boundingbox: ['1', '2', '3', '4'] }] })
  await assert.rejects(getTopPlaces('Kyoto, France'), (e) => e instanceof PlacesError && e.status === 404)
})

test('asks Nominatim for English names, so "Tokyo, Japan" still matches (it answers in Japanese otherwise)', async () => {
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('nominatim')) {
      const english = new URL(url).searchParams.get('accept-language') === 'en'
      return Response.json([{ display_name: english ? 'Tokyo, Japan' : '東京都, 日本', importance: 0.8, boundingbox: ['35.5', '35.9', '139.4', '139.9'] }])
    }
    return Response.json([place('a', 'Senso-ji', 7)])
  }
  const { area, places } = await getTopPlaces('Tokyo, Japan')
  assert.equal(area, 'Tokyo, Japan')
  assert.equal(places[0].name, 'Senso-ji')
})

test('ignores accents when matching, e.g. "Sao Paulo, Brazil"', async () => {
  mockFetch([place('a', 'Ibirapuera Park', 7)], {
    'sao paulo, brazil': [{ display_name: 'São Paulo, Brazil', importance: 0.8, boundingbox: ['-24', '-23', '-47', '-46'] }],
  })
  const { area } = await getTopPlaces('Sao Paulo, Brazil')
  assert.equal(area, 'São Paulo, Brazil')
})

// ---- limiting results to the city ----
const placeAt = (xid, name, rate, lat, lon) => ({ xid, name, rate, kinds: 'museums', point: { lat, lon } })
const square = { type: 'Polygon', coordinates: [[[135.6, 34.85], [135.9, 34.85], [135.9, 35.15], [135.6, 35.15], [135.6, 34.85]]] }

function mockCity(rank, otm) {
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('nominatim')) {
      return Response.json([{
        display_name: 'Kyoto, Kyoto Prefecture, Japan', importance: 0.7, place_rank: rank,
        lat: '35.0', lon: '135.75', boundingbox: ['34.85', '35.15', '135.60', '135.90'], geojson: square,
      }])
    }
    return Response.json(otm)
  }
}

test('a city is searched by radius around its centre and places outside the boundary are dropped', async () => {
  mockCity(16, [placeAt('a', 'Kinkaku-ji', 7, 35.04, 135.73), placeAt('b', 'Osaka Castle', 7, 34.69, 135.52)])
  const { places } = await getTopPlaces('Kyoto, Japan')
  assert.match(calls[1], /\/places\/radius\?/)
  assert.match(calls[1], /lat=35/)
  const radius = Number(new URL(calls[1]).searchParams.get('radius'))
  assert.ok(radius >= 3000 && radius <= 25000)
  assert.deepEqual(places.map((p) => p.name), ['Kinkaku-ji'])
})

test('a state-level match uses the bounding box but still filters by the boundary', async () => {
  mockCity(8, [placeAt('a', 'Kinkaku-ji', 7, 35.04, 135.73), placeAt('b', 'Osaka Castle', 7, 34.69, 135.52)])
  const { places } = await getTopPlaces('Kyoto, Japan')
  assert.match(calls[1], /\/places\/bbox\?/)
  assert.deepEqual(places.map((p) => p.name), ['Kinkaku-ji'])
})

test('if the boundary filter would remove everything, all places are kept', async () => {
  mockCity(16, [placeAt('b', 'Osaka Castle', 7, 34.69, 135.52)])
  const { places } = await getTopPlaces('Kyoto, Japan')
  assert.deepEqual(places.map((p) => p.name), ['Osaka Castle'])
})

test('insideGeometry handles polygons with holes and multipolygons', () => {
  const withHole = { type: 'Polygon', coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ] }
  assert.equal(insideGeometry(2, 2, withHole), true)
  assert.equal(insideGeometry(5, 5, withHole), false) // inside the hole
  assert.equal(insideGeometry(20, 20, withHole), false)
  const multi = { type: 'MultiPolygon', coordinates: [withHole.coordinates, [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]] }
  assert.equal(insideGeometry(25, 25, multi), true)
  assert.equal(insideGeometry(null, null, null), true)
})

// ---- single names such as "Kyoto" or "Japan" ----
test('a single name like "Kyoto" is limited to the city just like "Kyoto, Japan"', async () => {
  mockCity(16, [placeAt('a', 'Kinkaku-ji', 7, 35.04, 135.73), placeAt('b', 'Osaka Castle', 7, 34.69, 135.52)])
  const { area, places } = await getTopPlaces('Kyoto')
  assert.equal(area, 'Kyoto, Japan')
  assert.match(calls[0], /polygon_geojson=1/)
  assert.doesNotMatch(calls[0], /featuretype/)
  assert.match(calls[1], /\/places\/radius\?/)
  assert.deepEqual(places.map((p) => p.name), ['Kinkaku-ji'])
})

test('a country is searched by bounding box, then cut to its outline so neighbouring countries are dropped', async () => {
  // stand-in outline for Switzerland; Annecy (France) is inside the country's bounding box but outside its outline
  const swiss = { type: 'Polygon', coordinates: [[[7, 46], [10, 46], [10, 47.5], [7, 47.5], [7, 46]]] }
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('nominatim')) {
      return Response.json([{ display_name: 'Switzerland', importance: 1, place_rank: 4, lat: '46.8', lon: '8.2', boundingbox: ['45.8', '47.8', '5.9', '10.5'], geojson: swiss }])
    }
    return Response.json([placeAt('a', 'Chapel Bridge', 7, 47.05, 8.31), placeAt('b', 'Annecy Old Town', 7, 45.9, 6.12)])
  }
  const { places } = await getTopPlaces('Switzerland')
  assert.match(calls[1], /\/places\/bbox\?/)
  assert.deepEqual(places.map((p) => p.name), ['Chapel Bridge'])
})

test('prefers a city over a station or shop that shares its name', async () => {
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('nominatim')) {
      return Response.json([
        { display_name: 'Kyoto Station, Shimogyo, Kyoto, Japan', importance: 0.9, category: 'railway', place_rank: 30, lat: '34.98', lon: '135.76', boundingbox: ['34.98', '34.99', '135.75', '135.76'] },
        { display_name: 'Kyoto, Kyoto Prefecture, Japan', importance: 0.6, category: 'boundary', place_rank: 16, lat: '35.0', lon: '135.75', boundingbox: ['34.85', '35.15', '135.60', '135.90'] },
      ])
    }
    return Response.json([placeAt('a', 'Kinkaku-ji', 7, 35.04, 135.73)])
  }
  const { area } = await getTopPlaces('Kyoto')
  assert.equal(area, 'Kyoto, Japan')
  assert.match(calls[1], /\/places\/radius\?/)
})
