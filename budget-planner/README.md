# Budget Planner

Budget module for the travel planning platform (IS216 WAD2, Group 1).
Set a trip budget, split it across categories, log expenses in the home or
destination currency (converted with live exchange rates), and get warnings
when spending or planned activities push the trip over budget.

## Run it

```bash
npm install
npm test        # unit + API tests (no network needed)
npm start       # http://localhost:3000
```

Open `http://localhost:3000/?trip=my-trip` — the `trip` query parameter is the
trip id (defaults to `demo-trip`). Data is saved to `data/db.json`.

## Structure

```
server.js              starts the app
src/budgetLogic.js     pure logic: validation, summary, status, conflicts   <- the core
src/rates.js           Frankfurter exchange-rate client (1h cache, stale fallback)
src/store.js           storage (in-memory + JSON file). Swap for MongoDB/Firebase here
src/app.js             Express routes (createRouter / createApp)
public/                Vue 3 + Bootstrap 5 frontend (CDN, no build step)
test/                  node:test unit and API tests
```

## How the logic works

- **Remaining** = total − sum of every expense's `amountHome`.
- **Category status**: spent ÷ allocated. Under 80% → `ok`, 80–99% → `warning`,
  100%+ → `over`.
- **Rate saved at logging time.** Each expense stores `rateUsed` and `amountHome`
  when it is created, so old expenses never change value when the rate moves.
- **Projection** = actual spend + estimated cost of upcoming itinerary items.
  Lets the app warn "your plan is over budget" before the money is spent.
- **Conflicts** (`getConflicts`) return objects shaped for the Conflict Detector:
  `{ type: 'budget', severity, category?, message, suggestion }`. Over-budget
  categories suggest moving money from the category with the most headroom.

## API

| Method | Route | Purpose |
|---|---|---|
| `PUT` | `/api/trips/:tripId/budget` | Create or replace the budget |
| `GET` | `/api/trips/:tripId/budget` | Read the budget |
| `GET` | `/api/trips/:tripId/budget/summary` | Totals, per-category status, conflicts |
| `POST` | `/api/trips/:tripId/budget/summary` | Same, with `{ upcoming: [{ category, estimatedCost }] }` for projection |
| `GET` | `/api/trips/:tripId/expenses?category=` | List expenses |
| `POST` | `/api/trips/:tripId/expenses` | Log an expense (converts and saves the rate) |
| `PUT` | `/api/expenses/:id` | Edit an expense |
| `DELETE` | `/api/expenses/:id` | Delete an expense |
| `GET` | `/api/rates?from=JPY&to=SGD` | Exchange rate (cached) |

Example budget body:

```json
{
  "total": 2000,
  "homeCurrency": "SGD",
  "destCurrency": "JPY",
  "categories": [
    { "name": "Accommodation", "allocated": 800 },
    { "name": "Food", "allocated": 400 }
  ]
}
```

## Plugging into the team's app

If the team already has an Express server:

```js
const { createRouter } = require('./budget-planner/src/app');
const { createStore } = require('./budget-planner/src/store');
const { createRateService } = require('./budget-planner/src/rates');

app.use('/api', createRouter({ store: createStore('data/db.json'), rates: createRateService() }));
```

- **Database:** keep the same method names in `store.js` and back them with
  MongoDB/Firebase/Supabase. Routes and logic do not change.
- **Itinerary Planner:** give each itinerary item an `estimatedCost` and
  `category`, then POST the not-yet-done items to `/budget/summary` as `upcoming`.
- **Conflict Detector:** call `summarize(...).conflicts` (or `getConflicts`) and
  render them in the same pop-up as schedule and haze conflicts.
- **Auth / groups:** routes are keyed by `tripId` only. Add a middleware that
  checks the logged-in user belongs to the trip.

## E2E test journey (for the rubric)

1. Open the app, set a budget (SGD 2000, destination JPY) and save.
2. Log a JPY expense — the "≈ SGD …" preview appears and the amount converts.
3. Keep logging into one category until it passes 80% (amber), then 100% (red).
4. The warning pop-up and "Move X from Y" suggestion appear.

Useful selectors are already on the page as `data-testid` attributes
(`total-input`, `save-budget`, `expense-amount`, `expense-category`,
`add-expense`, `remaining`, `conflicts`, `expense-list`).
