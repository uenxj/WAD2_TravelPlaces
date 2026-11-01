const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}


const { createApp } = require('./src/app');
const { createStore } = require('./src/store');
const { createRateService } = require('./src/rates');
const { createChecklistDb } = require('./src/checklist/checklistDb');
const { mountChecklist } = require('./src/checklist/checklistRoutes');

const PORT = process.env.PORT || 3000;
const store = createStore(path.join(__dirname, 'data', 'db.json'));
const rates = createRateService();
const app = createApp({ store, rates });

const checklistDb = createChecklistDb();
mountChecklist(app, { db: checklistDb });
checklistDb.collection().then(
  () => console.log('Checklist connected to MongoDB'),
  (err) => console.warn(`Checklist: ${err.message}${err.cause ? ` (${err.cause.message})` : ''}`),
);

app.listen(PORT, () => {
  console.log(`Budget Planner running at http://localhost:${PORT}`);
});
