// Real account and itinerary routes for the itinerary E2E tests: accounts in memory, trips in a temporary JSON
// file, and the two outside services (Nominatim and OpenTripMap) answered locally, so no network is needed.
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const express = require('express')
const { mountAuth } = require('../../server/src/auth/authRoutes.js')
const { createMemoryAuthStore } = require('../../server/src/auth/authStore.js')
const { createLocalStore } = require('../../server/src/itinerary/itineraryStore.js')
const { mountItinerary } = require('../../server/src/itinerary/itineraryRoutes.js')

process.env.NOMINATIM_DELAY_MS = '0'
process.env.OPENTRIPMAP_KEY = 'e2e-key'

const SINGAPORE = { display_name: 'Singapore', lat: '1.29', lon: '103.85', importance: 1, place_rank: 4, boundingbox: ['1.2', '1.5', '103.6', '104.0'] }
const PLACES = [
  { xid: 'W1', name: 'Gardens by the Bay', rate: 7, point: { lat: 1.2816, lon: 103.8636 }, kinds: 'gardens_and_parks,urban_environment' },
  { xid: 'W2', name: 'National Museum', rate: 5, point: { lat: 1.2966, lon: 103.8485 }, kinds: 'museums,cultural' },
]

const realFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  const target = String(url)
  if (target.includes('nominatim.openstreetmap.org')) {
    const q = new URL(target).searchParams.get('q').toLowerCase()
    if (q === 'switzerland') return Response.json({}, { status: 503 })
    return Response.json(q.startsWith('singapore') ? [SINGAPORE] : [])
  }
  if (target.includes('geocoding-api.open-meteo.com')) {
    const name = new URL(target).searchParams.get('name').toLowerCase()
    return Response.json({ results: name === 'switzerland' ? [{ name: 'Switzerland', latitude: 47.00016, longitude: 8.01427, timezone: 'Europe/Zurich', feature_code: 'PCLI' }] : [] })
  }
  if (target.includes('api.opentripmap.com')) return Response.json(PLACES)
  return realFetch(url, options)
}

const directory = mkdtempSync(join(tmpdir(), 'travel-itinerary-e2e-'))
const app = express()
app.use(express.json())
const authStore = createMemoryAuthStore()
const auth = mountAuth(app, { store: authStore })
mountItinerary(app, { store: createLocalStore(join(directory, 'itinerary.json')), requireAuth: auth.requireAuth, users: authStore })
const server = app.listen(3101, '127.0.0.1')

function cleanup() { server.close(() => { rmSync(directory, { recursive: true, force: true }); process.exit(0) }) }
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
