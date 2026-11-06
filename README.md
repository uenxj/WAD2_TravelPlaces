# GoingSomewhere (IS216 G3T1)

GoingSomewhere is a travel-planning web app. Visitors explore destinations on an interactive globe, take a quiz or play a country game to find somewhere to go, then sign in to plan the trip with their group: day-by-day itinerary, budget, packing list and weather.

**Live app:** https://wad2-travelplaces-1.onrender.com/

If the link doesn't load, message Jing Xuan on Slack and I'll boot up the server.

**Team:** Yong Xuan, Sam, Charlene, Huong, Seth, Angeline, Jing Xuan

## 1. Features

| Feature | What it does | Main code |
| --- | --- | --- |
| Discover, quiz and country game | Interactive globe, destination search, a short recommendation quiz, and a country guessing game that leads into planning | `src/views/Discover.vue`, `Quiz.vue`, `Play.vue`, `Explore.vue` |
| Accounts | Sign up, log in and log out. Passwords are hashed (scrypt) and the session is an HttpOnly cookie | `server/src/auth/`, `src/services/auth.js`, `src/views/Login.vue` |
| Trips and itinerary | Create trips, invite members, add activities by day, and see conflicts (overlaps, travel time, weather). "Suggested places" uses OpenTripMap | `server/src/itinerary/`, `src/views/Itinerary.vue` |
| Budget planner | Set a trip budget, log expenses, convert currencies with live rates, warnings at 80% and 100% of the budget | `server/src/app.js`, `server/src/budgetLogic.js`, `src/views/Budget.vue` |
| Packing checklist | Per-trip packing lists with recommendations based on destination and weather | `server/src/checklist/`, `src/views/Checklist.vue` |
| Weather | Forecast and past weather per activity (Open-Meteo), plus Singapore PSI | `src/weather/`, `src/views/Weather.vue` |

Real trips are private: the itinerary, budget and checklist APIs only answer to signed-in members of that trip. Signed-out visitors can still browse and use the sample ("preview") trips.

## 2. Run it locally

**Prerequisites:** Git, Node.js (22.18+ or 24.12+), nodemon and [pnpm](https://pnpm.io).

Installing nodemon
```bash
pnpm add -D nodemon
```

Downloading dependencies
```bash
git clone https://github.com/uenxj/WAD2_TravelPlaces.git
cd WAD2_TravelPlaces/client/GoingSomewhere
pnpm install
```

**Option A: front end only (fastest)**

```bash
pnpm dev
```

Open the address Vite prints (http://localhost:5173). Browsing and the sample trips work. Accounts, real trips and budgets need the server below. Errors will be shown because backend connection is needed for some features.

**Option B: full app (front end and API)**


1. Place .env file at server/.env and client/GoingSomewhere/.env
2. Start the API in one terminal:

   ```bash
   pnpm server
   ```
3. Start the front end in another terminal:

   ```bash
   pnpm dev
   ```

**Environment variables (`server/.env`, never committed)**

| Variable | Needed? | Purpose |
| --- | --- | --- |
| `MONGODB_URI`, `MONGODB_DB` | Optional | Shared MongoDB database for accounts, budgets, trips and checklists. If it is not set, the app falls back to local JSON files under `server/data/` (git-ignored) and in-memory accounts, which reset when the server restarts |
| `OPENTRIPMAP_KEY` | Optional | Turns on the "Suggested places" panel. Free key from https://dev.opentripmap.org. Without it only that panel is off |
| `MONGODB_DNS_SERVERS` | Optional | Only if your network cannot resolve `mongodb+srv://` addresses |

**Production build:** `pnpm build` creates `dist/`, and `pnpm server` then serves both the API and the built site from one port.

## 3. Deployment

Hosted on Render as a single web service.

- Root directory: `client/GoingSomewhere`
- Build command: `pnpm install && pnpm build`
- Start command: `pnpm server`
- Environment: `MONGODB_URI`, `MONGODB_DB` and `OPENTRIPMAP_KEY` are set in the Render dashboard, not in the repo.

## 4. Tests

Run from `client/GoingSomewhere`.

| Command | What it covers |
| --- | --- |
| `pnpm test:auth` | Sign-up, login, sessions, password hashing, rate limiting |
| `pnpm test:budget` | Budget storage, trip-member access rules (401/403), destination currency lookup |
| `pnpm test:itinerary` | Trips, items, conflict detection, places and weather checks |
| `pnpm test:checklist` | Checklist logic, recommendations, trip access |
| `pnpm test:weather` | Weather module |
| `pnpm test:guess-country` | Country Guessing Game game flow logic |
| `pnpm test:e2e` | Browser tests with Playwright on desktop (1440 wide) and mobile (375 wide) sizes |
| `pnpm test:e2e discover` | Test discovery features |


The unit suites use Node's built-in test runner and do not need a database. For the browser tests, install the browser once with `pnpm exec playwright install chromium`. The tests start their own test servers and the dev server.

## 5. AI / LLM usage

In line with the course policy, these are the parts of the project that were written with the help of an AI tool (Claude by Anthropic). Each was reviewed, run and understood by the team member named.

| Part | Where | Tool | Reviewed by |
| --- | --- | --- | --- |
| Budget planner (currency conversion, budget warnings, API, tests) | `server/src/app.js`, `budgetLogic.js`, `src/views/Budget.vue`, tests | Claude | Seth |
| Login, sign-up and accounts backend and front-end wiring (PR #16) | `server/src/auth/`, `src/services/auth.js`, `src/views/Login.vue`, `server/test/auth.test.js` | Claude | Seth |
| Budget linked to real trips: trip-member access check, Budget link on the trip page, destination currency lookup (PR #25) | `server/src/tripAccess.js`, `server/src/app.js`, `src/budget/destinationCurrency.js`, `src/views/Itinerary.vue`, `server/test/budgetAccess.test.js` | Claude Code | Seth |
| Country Guessing Game (game flow & logic: timer, hints, attempts, streaks, API), tests | `src/views/Play.vue`, `src/data/countries.js`, `src/tests/e2e/guess-country.spec.js` for E2E testing | Claude | Angeline |
| Explore page (led from game page): additional country information | `src/views/Explore.vue`, `src/data/locations.js`| Claude | Angeline |
| Light/dark theme (tokens, toggle, colour replacement) and its theme test | `src/styles/app.css`, `src/composables/useTheme.js`, `src/components/AppHeader.vue`, `index.html`, colour values in the page and component styles, `tests/e2e/theme.spec.js` | Claude Code | Seth |
| Packing recommendations: metadata-driven, itinerary-based suggestions (approach discussed with ChatGPT) | `src/checklist/catalog.js`, `recommend.js`, `tripSignals.js` | ChatGPT, Claude Code | Huong |
| Interactive suitcase (design ideas from ChatGPT) | `components/checklist/SuitcaseStage.vue` | ChatGPT, Claude Code | Huong |
| Checklist and recommendation tests, mock data | `server/test/checklist.test.js`, `src/checklist/*.test.js` | ChatGPT, Claude Code | Huong |
| Trips and activities API: create/edit/delete trips and activities, invite members, trip-member access checks, storage (MongoDB or JSON file fallback) | `server/src/itinerary/itineraryRoutes.js`, `itineraryLogic.js`, `itineraryStore.js` | Claude | Yong Xuan Sam |
| Destination lookup (Nominatim) and "Suggested places" (OpenTripMap) | `server/src/itinerary/geocode.js`, `places.js`, `src/components/itinerary/SuggestedPlaces.vue` | Claude | Yong Xuan Sam |
| Itinerary pages and day-by-day view (trip list, new trip, activity cards and form) | `src/views/Trips.vue`, `NewTrip.vue`, `Itinerary.vue`, `src/components/itinerary/TripList.vue`, `ActivityCard.vue`, `ActivityFormModal.vue`, `NewTripForm.vue`, `EditTripModal.vue`, `ModalShell.vue`, `src/itinerary/api.js`, `dates.js`, `activity.js`, `session.js` | Claude | Yong Xuan Sam |
| Clash detection (overlapping times, shown live in the form and blocked), duplicate-activity prompt, same name not allowed twice on one day | `src/itinerary/conflicts.js`, `duplicates.js`, `src/components/itinerary/DuplicateActivityModal.vue`, `ActivityFormModal.vue` | Claude | Yong Xuan Sam |
| Itinerary tests (server, client unit and end-to-end) | `server/test/itinerary*.test.js`, `itineraryHelpers.js`, `itineraryPlaces.test.js`, `src/itinerary/*.test.js`, `tests/e2e/itinerary.spec.js`, `tests/e2e/itinerary-server.cjs` | Claude | Yong Xuan Sam |
| Knowing how to use e2e for testing API, knowing how to use API, troubleshooting UI | test/e2e/discover.spec.js | Claude | Xuan|
| Weather, air quality and PSI checks (Open-Meteo, data.gov.sg), weather page, activity conditions and itinerary atmosphere (PR #15) | `src/weather/`, `src/views/Weather.vue`, `src/components/ActivityConditions.vue`, `ItineraryAtmosphere.vue`, `src/data/sampleTrips.js` | CODEX | Charlene |
| Weather tests (unit and end-to-end) | `src/weather/*.test.js`, `tests/e2e/weather.spec.js` | CODEX | Charlene |
| Quiz, landing page and Profile page changes | `src/views/Quiz.vue`, `Home.vue`, `AccountPage.vue` | CODEX | Charlene |



