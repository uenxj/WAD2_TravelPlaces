# Authentication UI handoff

## Implemented guest flow

- `/`: landing page with Discover, Log in and Explore destinations.
- `/discover`: existing interactive globe, searchable city buttons, quiz/game links and Saved places.
- `/quiz`: three-question client-side recommendation quiz using the existing destination collection.
- `/play` and `/explore/:country`: country game and a path from its answer to planning.
- Plan a trip here opens `/trips/new?destination=...&country=...&from=...`.
- Guests visiting `/trips`, `/trips/new`, `/saved`, `/profile` or `/budget` are redirected to `/login`.
- Login's `redirect` query retains the complete intended local path, including destination. `from` is the cancellation path. Both survive refresh and switching login/sign-up modes.
- Save place retains the destination ID and uses `intent=save`. No place has actually been saved.
- Login/sign-up forms are explicitly previews. Submit performs native validation, clears the password and shows an unavailable status. No credentials are transmitted or persisted; no fake session is created.

## Authentication teammate

1. Integrate your actual identity provider in `src/services/auth.js`. Restore the verified session before the initial router navigation (await initialization in `src/main.js` before `app.use(router)`).
2. Implement login/sign-up in `src/views/Login.vue`. Await verification, call `setAuthenticatedUser(verifiedUser)`, then `router.replace(safeReturnPath(route.query.redirect))`. Clear credentials and display actionable provider errors without exposing sensitive data. Add password recovery once the provider supports it.
3. Subscribe to session changes and clear the user on logout. Do not use a localStorage boolean or route query to authenticate users.
4. `AppHeader.vue` automatically switches to Discover / My Trips / + New trip / Profile when a verified user exists.
5. Enforce authentication and trip membership on the backend for every private read/write. The Vue guard only controls navigation; it does not secure APIs. The existing budget API has not been given authentication by this UI change.
6. Connect AccountPage's placeholder areas to the actual trip/profile/save backend. Trip creation is deliberately disabled until storage exists. After save-intent login, persist the selected place and confirm it only after the server succeeds.

Existing budget and game implementations remain. `/budget` now requires an authenticated UI session; no budget logic was changed. Existing Discover drag/drop, pins and weather lookup remain, with city buttons as a touch/keyboard alternative. Missing city photos use a neutral inline illustration rather than a broken image.

## Browser checks

Run from `client/GoingSomewhere`:

```sh
pnpm install
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts Vite automatically, or reuses an existing development server. Tests cover the guest landing, destination/login/cancel flow, account-route guards, saved-place intent, login preview, quiz recommendations, game-to-planning flow, local return links, and the verified-session integration seam at desktop and mobile widths. External weather and country requests are controlled in these tests. They do not verify a real authentication provider or persistent trip storage.

## Signed-in visual preview

The login page now offers **Preview signed-in experience**. `services/preview.js` keeps a separate tab-scoped preview flag; it never populates `user` or creates a verified session. A persistent banner provides Exit preview. My Trips, the sample trip sections and profile show explicitly labelled sample data. Trip creation and saving places remain unavailable. The Budget section now embeds the existing planner and uses the real budget API with separate `preview-tokyo` and `preview-paris` IDs. Budget edits persist to the local JSON store. The standalone `/budget` route still requires a verified session. Remove the preview entry or keep it as a demo when implementing real authentication.

## Connected budget planner

Open Preview → My Trips → View trip → Budget. Start the backend with `pnpm server` in a second terminal alongside `pnpm dev`. The Vite proxy forwards `/api` to port 3000. Budgets and expenses persist in `server/data/db.json` (ignored by Git). Existing `demo-trip` data is untouched.

`Budget.vue` accepts `tripId`, `destinationCurrency` and `embedded` props. Pass the real trip ID when integrating real itineraries; it no longer captures the global browser URL at module load. The standalone page retains `/budget?trip=...` support.

E2E tests start an isolated backend on port 3100 using the real Express routes and a temporary JSON store, with deterministic test exchange rates. No test budgets are written to the local app's data file. Budget tests verify editing, expense conversion, reload persistence, separation between trips and deletion.
