const express = require('express');
const { ObjectId } = require('mongodb');
const logic = require('./checklistLogic');
const { isConnectionError } = require('./checklistDb');

/**
 * Checklist API (all JSON; errors are { error, details? } like the budget API):
 *   GET    /api/trips/:tripId/checklist          -> [item]
 *   POST   /api/trips/:tripId/checklist          -> item            (one custom item)
 *   POST   /api/trips/:tripId/checklist/batch    -> { added, skipped } (defaults / suggestions, never duplicated)
 *   PATCH  /api/checklist/:id                    -> item            (name, category, priority, done)
 *   DELETE /api/checklist/:id                    -> 204
 *
 * `db` is the object from createChecklistDb(); tests can pass their own.
 */
function createChecklistRouter({ db }) {
  const router = express.Router();

  function requireTripId(req, res) {
    if (logic.isTripId(req.params.tripId)) return req.params.tripId;
    res.status(400).json({ error: 'Invalid trip id', details: ['use 1-64 letters, digits, - or _'] });
    return null;
  }

  function requireItemId(req, res) {
    if (logic.isItemId(req.params.id)) return new ObjectId(req.params.id);
    res.status(400).json({ error: 'Invalid item id' });
    return null;
  }

  router.get('/trips/:tripId/checklist', async (req, res) => {
    const tripId = requireTripId(req, res);
    if (!tripId) return;
    const col = await db.collection();
    const docs = await col.find({ tripId }).sort({ createdAt: 1, _id: 1 }).toArray();
    res.json(docs.map(logic.toClient));
  });

  router.post('/trips/:tripId/checklist', async (req, res) => {
    const tripId = requireTripId(req, res);
    if (!tripId) return;
    const v = logic.validateNewItem(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid item', details: v.errors });

    const col = await db.collection();
    const now = new Date();
    const doc = { tripId, ...v.value, createdAt: now, updatedAt: now };
    try {
      const { insertedId } = await col.insertOne(doc);
      res.status(201).json(logic.toClient({ ...doc, _id: insertedId }));
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'This item is already on the checklist' });
      throw err;
    }
  });

  // Upsert by suggestionKey with $setOnInsert: an item that already exists is
  // left untouched (keeps its done state and edits), so repeating the call is safe.
  router.post('/trips/:tripId/checklist/batch', async (req, res) => {
    const tripId = requireTripId(req, res);
    if (!tripId) return;
    const v = logic.validateBatch(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid items', details: v.errors });

    const col = await db.collection();
    const now = new Date();
    const ops = v.value.map((item) => ({
      updateOne: {
        filter: { tripId, suggestionKey: item.suggestionKey },
        update: { $setOnInsert: { tripId, ...item, createdAt: now, updatedAt: now } },
        upsert: true,
      },
    }));

    let upsertedIds;
    try {
      ({ upsertedIds } = await col.bulkWrite(ops, { ordered: false }));
    } catch (err) {
      // Two requests racing on the same key: the loser gets a duplicate-key
      // error for that item, which just means "already there".
      const writeErrors = err.writeErrors ?? [];
      const onlyDuplicates = writeErrors.length > 0 && writeErrors.every((e) => e.code === 11000);
      if (!onlyDuplicates) throw err;
      upsertedIds = err.result?.upsertedIds ?? {};
    }

    const ids = Object.values(upsertedIds);
    const added = ids.length
      ? await col.find({ _id: { $in: ids } }).sort({ createdAt: 1, _id: 1 }).toArray()
      : [];
    res.json({ added: added.map(logic.toClient), skipped: v.value.length - added.length });
  });

  // $set only the fields sent, so ticking an item never overwrites a rename.
  router.patch('/checklist/:id', async (req, res) => {
    const _id = requireItemId(req, res);
    if (!_id) return;
    const v = logic.validatePatch(req.body);
    if (!v.ok) return res.status(400).json({ error: 'Invalid update', details: v.errors });

    const col = await db.collection();
    const doc = await col.findOneAndUpdate(
      { _id },
      { $set: { ...v.value, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!doc) return res.status(404).json({ error: 'Item not found' });
    res.json(logic.toClient(doc));
  });

  router.delete('/checklist/:id', async (req, res) => {
    const _id = requireItemId(req, res);
    if (!_id) return;
    const col = await db.collection();
    const { deletedCount } = await col.deleteOne({ _id });
    if (!deletedCount) return res.status(404).json({ error: 'Item not found' });
    res.status(204).end();
  });

  router.use(handleChecklistError);
  return router;
}

function handleChecklistError(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.status === 503 || isConnectionError(err)) {
    console.error('[checklist]', err.message, err.cause?.message || '');
    return res.status(503).json({ error: 'Checklist storage is unavailable. Please try again shortly.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[checklist]', err);
  res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
}

/**
 * Mount the checklist API on an existing Express app (after its JSON body parser).
 * The extra error handler covers errors raised before our router runs, such as
 * malformed JSON, but only for checklist URLs so other features are unaffected.
 */
function mountChecklist(app, { db }) {
  app.use('/api', createChecklistRouter({ db }));
  app.use(['/api/trips/:tripId/checklist', '/api/checklist'], handleChecklistError);
}

module.exports = { createChecklistRouter, mountChecklist };
