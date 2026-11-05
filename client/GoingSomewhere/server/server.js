const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}


const { createApp } = require('./src/app');
const { createStore } = require('./src/store');
const { createRateService } = require('./src/rates');
const { createMongo } = require('./src/mongo');
const { createChecklistDb } = require('./src/checklist/checklistDb');
const { mountChecklist } = require('./src/checklist/checklistRoutes');
const { createMongoStore } = require('./src/budgetMongoStore');
const { createAuthStore, createMemoryAuthStore } = require('./src/auth/authStore');
const { mountAuth } = require('./src/auth/authRoutes');
const { createMongoStore: createItineraryMongoStore, createLocalStore: createItineraryLocalStore } = require('./src/itinerary/itineraryStore');
const { mountItinerary } = require('./src/itinerary/itineraryRoutes');

const PORT = process.env.PORT || 3000;
const mongo = createMongo(); // one shared MongoDB connection (MONGODB_URI)

// Budget data: the shared team MongoDB when MONGODB_URI is set, otherwise the local JSON file.
const store = process.env.MONGODB_URI
  ? createMongoStore({ database: mongo.database })
  : createStore(path.join(__dirname, 'data', 'db.json'));
console.log(`Budget data: ${process.env.MONGODB_URI ? 'MongoDB' : 'local JSON file (server/data/db.json)'}`);
const rates = createRateService();
const app = createApp({ store, rates });

// A real trip's checklist (a trip from the itinerary) is only for that trip's members. Other ids,
// such as the sample trips (preview-…) and demo-trip, stay open as before.
async function checklistAccess(req, tripId) {
  const trip = await itineraryStore.trips.get(tripId);
  if (!trip) return null;
  const user = await auth.authenticate(req);
  if (!user) return { status: 401, error: 'Please log in to continue' };
  if (!trip.memberIds.includes(user.id)) return { status: 403, error: 'You are not in this trip.' };
  return null;
}
const checklistDb = createChecklistDb({ mongo });
mountChecklist(app, { db: checklistDb, access: checklistAccess });
checklistDb.collection().then(
  () => console.log('Checklist connected to MongoDB'),
  (err) => console.warn(`Checklist: ${err.message}${err.cause ? ` (${err.cause.message})` : ''}`),
);

// Accounts: stored in the same MongoDB. Without MONGODB_URI they live in memory only (handy for
// local testing, but every account is lost when the server restarts).
if (!process.env.MONGODB_URI) console.warn('Accounts: MONGODB_URI is not set, so accounts are kept in memory and lost on restart.');
const authStore = process.env.MONGODB_URI
  ? createAuthStore({ database: mongo.database })
  : createMemoryAuthStore();
const auth = mountAuth(app, { store: authStore, secureCookie: process.env.NODE_ENV === 'production' });

// Trips and their itinerary (activities, conflict warnings, suggested places). Same MongoDB when MONGODB_URI is
// set, otherwise server/data/itinerary.json. Every route needs a signed-in user, so this goes after mountAuth.
const itineraryStore = process.env.MONGODB_URI
  ? createItineraryMongoStore({ database: mongo.database })
  : createItineraryLocalStore(path.join(__dirname, 'data', 'itinerary.json'));
mountItinerary(app, { store: itineraryStore, requireAuth: auth.requireAuth, users: authStore });
if (!process.env.OPENTRIPMAP_KEY) console.warn('Itinerary: OPENTRIPMAP_KEY is not set, so the "Suggested places" panel is switched off.');

// Any page that isn't an API call returns the Vue app, so refreshing /discover works
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Budget Planner running at http://localhost:${PORT}`);
});
