# GoingSomewhere (IS216 G3T1)

GoingSomewhere is a travel-planning web app. Visitors explore destinations on an interactive globe, take a quiz or play a country game to find somewhere to go, then sign in to plan the trip with their group: day-by-day itinerary, budget, packing list and weather.

**Live app:** <PASTE RENDER URL HERE>

**Team:** Yong Xuan Sam, Charlene, Huong, Seth, Angeline, Xuan

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

**Prerequisites:** Git, Node.js (22.18+ or 24.12+) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/uenxj/WAD2_TravelPlaces.git
cd WAD2_TravelPlaces/client/GoingSomewhere
pnpm install
```

**Option A: front end only (fastest)**

```bash
pnpm dev
```

Open the address Vite prints (http://localhost:5173). Browsing and the sample trips work. Accounts, real trips and budgets need the server below.

**Option B: full app (front end and API)**

1. Copy `server/.env.example` to `server/.env` and fill in the values (see below).
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

The unit suites use Node's built-in test runner and do not need a database. For the browser tests, install the browser once with `pnpm exec playwright install chromium`. The tests start their own test servers and the dev server.

## 5. AI / LLM usage

In line with the course policy, these are the parts of the project that were written with the help of an AI tool (Claude by Anthropic). Each was reviewed, run and understood by the team member named.

| Part | Where | Tool | Reviewed by |
| --- | --- | --- | --- |
| Budget planner (currency conversion, budget warnings, API, tests) | `server/src/app.js`, `budgetLogic.js`, `src/views/Budget.vue`, tests | Claude | Seth |
| Login, sign-up and accounts backend and front-end wiring (PR #16) | `server/src/auth/`, `src/services/auth.js`, `src/views/Login.vue`, `server/test/auth.test.js` | Claude | Seth |
| Budget linked to real trips: trip-member access check, Budget link on the trip page, destination currency lookup (PR #25) | `server/src/tripAccess.js`, `server/src/app.js`, `src/budget/destinationCurrency.js`, `src/views/Itinerary.vue`, `server/test/budgetAccess.test.js` | Claude Code | Seth |
| Country Guessing Game (game flow & logic: timer, hints, attempts, streaks, API), tests | `src/views/Play.vue`, `src/data/countries.js`, `src/public/locations/` for image files, `src/tests/e2e/guess-country.spec.js` for E2E testing | Claude | Angeline |


| Team member | AI use |
| --- | --- |
| Yong Xuan Sam (itinerary) | <fill in> |
| Charlene (weather) | <fill in> |
| Huong (checklist) | <fill in> |
| Xuan | <fill in> |

## 6. Working on the project (team rules)

**Every developer works on their own branch. Never push directly to `main`.**

1. Update `main`: `git checkout main && git pull origin main`
2. Create your branch: `git checkout -b feature/<name>`
3. Commit small, clear changes. Never commit secrets (API keys, passwords, `.env` files).
4. Before pushing, tell the team, sync with the latest `main`, and run the tests.
5. Push (`git push -u origin feature/<name>`) and open a Pull Request into `main`. Describe the change and how you tested it.
6. Notify the project owner and wait for approval before merging.
