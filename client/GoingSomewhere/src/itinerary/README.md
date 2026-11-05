# Itinerary planner

Trips and day-by-day activities for signed-in users, at `/trips`, `/trips/new` and `/trips/:tripId`.
Signed-out visitors still see the sample pages (preview mode) at the same URLs.

## Where things are
| Area | Path |
| --- | --- |
| API, logic, storage | `server/src/itinerary/` (`itineraryRoutes.js`, `itineraryLogic.js`, `itineraryStore.js`, `geocode.js`, `places.js`, `externalChecks.js`) |
| Pages | `src/views/Trips.vue`, `NewTrip.vue`, `Itinerary.vue` |
| Components | `src/components/itinerary/` |
| Client helpers | `src/itinerary/` (`api.js`, `dates.js`, `activity.js`, `session.js`) |
| Tests | `server/test/itinerary*.test.js`, `src/itinerary/*.test.js`, `tests/e2e/itinerary.spec.js` |

## Setup
- Needs the same sign-in as the rest of the app (cookie `gs_session`). Every `/api/trips*`, `/api/items*` and `/api/places` route requires it.
- Storage: MongoDB collections `itinerary_trips` and `itinerary_items` when `MONGODB_URI` is set; otherwise a JSON file at `server/data/itinerary.json` (git-ignored).
- `OPENTRIPMAP_KEY` (in `server/.env`, and in the Render environment) powers "Suggested places". Without it that panel reports it is unavailable; the rest works.
- `MONGODB_DNS_SERVERS` (optional, comma separated) works around networks that block SRV lookups for `mongodb+srv://`.

## Hand-offs to other features
- **Budget / packing:** a trip's `_id` is the `tripId` those features already use, so pass it to attach them to a real trip.
- **Weather:** every activity from `GET /api/trips/:tripId/items` carries `item.weather` (coordinates, `setting`, local start/end, timezone). `Itinerary.vue` passes it to `ActivityConditions` through `toConditionsActivity()`.
- **Route planner:** plug into `server/src/itinerary/externalChecks.js` (`getWeatherFlag`, `getRouteFlag`) to add conflicts.

## Tests
```
pnpm test:itinerary                      # server + client unit tests, no database needed
MONGODB_URI=... pnpm test:itinerary      # also runs the real-MongoDB suite (uses a throwaway database)
pnpm exec playwright test tests/e2e/itinerary.spec.js
```

## Destination lookup recovery

Country, region and city names are accepted. Trip creation and destination edits use Nominatim; if it fails or returns unusable coordinates/timezone, the server tries Open-Meteo geocoding. Empty/failed lookups are not cached. Exact country matches take precedence over towns with the same name in backup results. `GEOCODE_DISABLED=true` disables both providers.

A saved trip with missing coordinates or timezone automatically attempts `POST /api/trips/:tripId/location` when its Itinerary opens. The endpoint requires trip membership, updates only location metadata, and leaves details/activities intact. If both lookups fail, the page offers **Retry location** and **Edit trip**. Editing also repairs older trips that have coordinates but no timezone.

`destinationScope: 'country'` identifies representative country coordinates. The day summary explains this and suggests choosing a city for local conditions; these coordinates do not describe the weather everywhere in a country. Activities with their own coordinates continue to use their own locations.

### Destination picker

Create Trip and Edit Trip share an accessible city/country autocomplete powered by the existing Open-Meteo location search. Suggestions include the region and country to distinguish names. Selecting a suggestion submits `destinationLocation` with its matching label, coordinates, IANA timezone and country/place scope. The server validates the selection and saves these fields directly without repeating the text lookup. Changing the destination text clears the selection; free-text creation/editing still works if search is unavailable, using the provider fallback described above.

Older backend processes must restart after pulling this change. A missing location-recovery route now produces a recovery instruction rather than a raw “Request failed (404)” message. Frontend and backend changes should be deployed together.
