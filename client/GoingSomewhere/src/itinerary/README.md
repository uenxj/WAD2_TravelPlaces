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

## Clashes and repeats while adding an activity
- **Live clash warning:** the Add/Edit activity form checks the chosen day and times against every activity already in the trip
  (including other travellers' ones, named "added by ...") as the day, start or end time changes. While it clashes the Add button
  is disabled until the day or time is changed. (Editing an activity that already clashed only blocks changes to its day or
  time, so its title and notes can still be corrected.) The server still saves and reports clashes that slip through, such as two
  people adding at the same moment. Logic: `src/itinerary/conflicts.js`.
- **Same activity on another day:** adding an activity that is already planned on a different day (same suggested place, or the
  same title ignoring case and spaces) opens a prompt: move the existing one to the chosen day and time, add it again as a
  duplicate, or go back. Logic: `src/itinerary/duplicates.js`; prompt: `components/itinerary/DuplicateActivityModal.vue`.
  Editing an existing activity never shows the prompt.
- **Same activity twice on one day:** not allowed. The form says "\"X\" is already planned on this day (10:00-12:00)" and the Add
  button stays disabled until another day or title is chosen. (Editing only blocks changing the day or title.)

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
