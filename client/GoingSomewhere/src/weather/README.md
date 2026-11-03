# Weather and air quality integration

Open `/weather` from a Discover destination card. Weather links are intentionally absent from all navigation bars. Use city search for international locations, choose an activity date/time and indoor/outdoor setting. Preview → My Trips → View trip → Itinerary has one day summary and compact conditions for each activity. Day buttons cover all six Tokyo dates and seven Paris dates, with 54 illustrative activities in `src/data/sampleTrips.js`. Preview locations are city-centre approximations, not actual venue coordinates.

## Itinerary builder handoff

Pass a reactive activity object to `src/components/ActivityConditions.vue`:

```vue
<!-- Overview: use the day location, date, 00:00–23:59 and outdoor setting.
     Pass the actual activities so warnings use their individual time slots. -->
<ActivityConditions
  :activity="daySummary"
  :activities="day.activities"
  :planned-activities="trip.activities"
  :trip-id="trip.id"
  :external-issues="routeIssues"
  @planning-issues="handlePlanningIssues"
/>
<!-- Each itinerary row: temperature and air quality for the activity hours. -->
<ActivityConditions :activity="activity" compact />
```

```js
const activity = {
  id: 'activity-123',
  name: 'Shinjuku Gyoen',
  latitude: 35.6852,
  longitude: 139.7100,
  date: '2026-12-12',
  startTime: '14:00',
  endTime: '16:00',
  timezone: 'Asia/Tokyo',
  environment: 'outdoor', // indoor | outdoor | mixed
}
```

Save these itinerary inputs in the trip's MongoDB document when the itinerary builder is ready. This module does not create a second trip store or write sample activities into MongoDB. Changing the activity's date, time, coordinates, timezone or setting updates its panel. Keep times local to the destination, use IANA timezones, and split overnight activities into two dates. DST gaps/duplicates may yield partial hourly coverage, which is disclosed.

## Data and limits

- Day 0–15 (destination-local today): Open-Meteo daily and hourly weather forecast. Slot summaries include every hourly interval overlapping the activity, excluding the end boundary. Fetch dates are interpreted in the destination timezone.
- Later dates: ERA5 reanalysis for the previous 10 complete calendar years, filtered to the selected month. The day summary displays the mean daily minimum/maximum and historical fraction of days with at least 1 mm precipitation. For activity rows, the same archive request includes hourly temperatures: average each local hour across the selected month in all ten years, then show the range of those hourly means overlapping the activity. Require at least 20 samples per year for each hour; otherwise label the fallback as the typical daily range. The UI heading is Weather Forecast, with a short Historical monthly average label for advance dates. Require at least 20 complete days per year. This is a recent historical sample, not an official 30-year climate normal, exact-date forecast, or future precipitation probability. Use the Historical Weather API, not the Climate API's future daily model output as a forecast.
- Air quality: request up to 7 days of US AQI, PM2.5 and PM10 from Open-Meteo/CAMS. Regional model coverage can end earlier; missing and partial coverage are explicitly shown. Display peak available values during the slot. Particle peaks may occur at different hours. No long-range AQI is invented.
- US AQI is labelled consistently worldwide. Singapore PSI is integrated separately through the official NEA/data.gov.sg endpoint. It is never inferred by relabelling AQI. For Singapore activities dated today, display the latest 24-hour PSI from the nearest regional reporting point, including observation time. Reject observations older than two hours, future timestamps and missing values; other dates show that PSI is an observation rather than a forecast. Particle readings do not prove haze or its cause.
- Past activities are not forecast. Invalid inputs, null readings, sparse history, provider failures and incomplete hours are handled without claiming favourable conditions.

The application calls public APIs directly from the browser, as Discover already did; no new credentials or `.env` settings are needed. Use is subject to provider terms/rate limits. Historical requests include daily and hourly data over ten years and may take longer than forecasts. Identical requests across the day summary and activities share one response. A bounded, in-memory cache deduplicates concurrent requests: weather 30 minutes, air 15 minutes, history/geocoding 24 hours. Reopening a panel rechecks expiry; Refresh bypasses cache. Separate weather/air results survive partial provider outages. Older component requests cannot overwrite a newly selected activity. Activity changes, reopening the panel and Refresh trigger re-evaluation; there are no background push notifications or scheduled updates. Refresh refreshes the day’s locations before recomputing activity risks.

## Planning hints

Planning advice appears only in the day summary. With the activities prop, warnings are computed from each actual outdoor or mixed activity’s coordinates, date and time slot. Indoor activities are excluded from weather/AQI warnings. Seasonal preparation advice, including cold mornings and indoor alternatives, stays in the overview once. Compact rows show conditions without repeating the advice. A component without an activities prop retains its standalone summary behaviour for compatibility. Weather thresholds (project defaults, not official warning criteria): precipitation probability ≥60%, apparent heat ≥35°C, apparent cold ≤0°C, wind ≥40 km/h, thunderstorm weather codes ≥95. US AQI >100 prompts review, with stronger presentation above 150. Seasonal cold/warm/rain patterns produce preparation advice only. No warning is a guarantee of safety, and incomplete forecasts never imply good conditions. Provider references remain in this document. The source footer, retrieval timestamps and long index explanation are omitted from the cards.

## Verification and sources

`pnpm test:weather` checks timezones, overlapping hours, validation, thresholds, independent forecast windows, null/partial data, seasonal aggregation, caching and provider failures. `pnpm test:e2e -- tests/e2e/weather.spec.js` checks browser interactions with controlled provider responses. `pnpm build` checks the production bundle.

- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/historical-weather-api
- https://open-meteo.com/en/docs/air-quality-api
- https://open-meteo.com/en/docs/geocoding-api

## Itinerary atmosphere

`ItineraryAtmosphere.vue` adds a decorative CSS layer behind itinerary content. `atmosphere.js` selects a theme from the trip location, local month and hemisphere: Tokyo's winter has snow, spring has petals, autumn has leaves, and summer/tropical trips have a warm glow. Country palettes distinguish Japan and France. These seasonal effects are labelled Seasonal atmosphere and are not predictions of snowfall or rain.

The day summary emits its conditions to the itinerary page. Available forecast weather codes override seasonal decoration with snow, rain, clouds or sunshine; switching days clears the previous day's weather before applying new results. The decoration makes no additional API requests and is hidden in other trip tabs. Reduced-motion styling, reduced particle count on phones and pointer-transparent layers leave itinerary controls usable. The animation has no manual pause control.


## Shared planning checks and real-itinerary integration

The preview now supports **Edit activity** for time and indoor/outdoor changes. Edits stay in memory and reset on reload; they are not represented as saved group trips. Real itinerary/authentication storage is still the teammate’s implementation. This module deliberately accepts that canonical trip data through props instead of creating a competing trip database.

- `activities`: the selected day's activities, with stable IDs, names, coordinates, local date/times, IANA timezone and environment. The service supports different venue coordinates even though the sample trips use city centres. Full-day cards describe the overview location; each activity check uses that activity's own coordinates.
- `plannedActivities`: all trip activities for projected budget checks. Optional `estimatedCostHome` must represent remaining estimated cost in the budget’s home currency, and `completed: true` excludes completed activities. Missing estimates are disclosed. Currency conversion belongs to the existing currency/budget service; do not mix currencies in this field.
- `tripId`: reads the existing budget summary endpoint without writing to it. Alternatively pass a `budget` object containing numeric `total`, `spentTotal` and `homeCurrency` to reuse your builder’s loaded state. Missing budgets and failed budget reads are disclosed independently of weather results.
- `externalIssues`: additional route/schedule/team checks supplied by other modules. All issues share `{ id, source, level, title, text, activityIds }`.
- `planning-issues`: emits null when a new check starts, then `{ entries, issues, outdoorCount, incompleteCount, coverage }`. Keep this derived review in shared planning state to surface weather, air quality, schedule and budget concerns together. It is not a durable weather snapshot.
- Basic schedule checks detect overlapping same-day local time ranges within the same timezone and agenda. Optional `agendaId` separates traveller calendars. Adjacent end/start times do not clash. Different timezones produce a review notice; cross-timezone travel durations and route optimisation remain the itinerary builder’s responsibility.
- Singapore PSI warnings are based on recent observations and only apply to outdoor activities happening now. They are never projected onto a later activity. Forecast AQI is evaluated separately for upcoming slots.

`src/weather/review.js` performs activity-level conditions checks and returns the shared issue contract. `src/planning/review.js` combines those weather issues with schedule, budget and externally supplied checks. Provider failures, missing forecast horizons and partial data produce incomplete coverage rather than an all-clear claim.

Official PSI API: https://api-open.data.gov.sg/v2/real-time/api/psi
PSI category reference: https://www.nea.gov.sg/our-services/pollution-control/air-pollution/managing-haze
