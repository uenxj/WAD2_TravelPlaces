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

const PORT = process.env.PORT || 3000;
const mongo = createMongo(); // one shared MongoDB connection (MONGODB_URI)

// Budget data: the shared team MongoDB when MONGODB_URI is set, otherwise the local JSON file.
const store = process.env.MONGODB_URI
  ? createMongoStore({ database: mongo.database })
  : createStore(path.join(__dirname, 'data', 'db.json'));
console.log(`Budget data: ${process.env.MONGODB_URI ? 'MongoDB' : 'local JSON file (server/data/db.json)'}`);
const rates = createRateService();
const app = createApp({ store, rates });

const checklistDb = createChecklistDb({ mongo });
mountChecklist(app, { db: checklistDb });
checklistDb.collection().then(
  () => console.log('Checklist connected to MongoDB'),
  (err) => console.warn(`Checklist: ${err.message}${err.cause ? ` (${err.cause.message})` : ''}`),
);

app.listen(PORT, () => {
  console.log(`Budget Planner running at http://localhost:${PORT}`);
});
