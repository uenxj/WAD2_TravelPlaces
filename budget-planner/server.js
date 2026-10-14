const path = require('path');
const { createApp } = require('./src/app');
const { createStore } = require('./src/store');
const { createRateService } = require('./src/rates');

const PORT = process.env.PORT || 3000;
const store = createStore(path.join(__dirname, 'data', 'db.json'));
const rates = createRateService();

createApp({ store, rates }).listen(PORT, () => {
  console.log(`Budget Planner running at http://localhost:${PORT}`);
});
