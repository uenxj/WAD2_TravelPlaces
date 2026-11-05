// Pure checklist logic: validation and shaping. No I/O, no Express, no DB.
// Keep CATEGORIES in sync with src/checklist/catalog.js on the client.

const CATEGORIES = ['Documents', 'Clothing', 'Electronics', 'Toiletries', 'Health', 'Essentials'];
const PRIORITIES = ['essential', 'optional'];
const SOURCES = ['default', 'custom', 'suggested'];

const TRIP_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ITEM_ID_RE = /^[a-f0-9]{24}$/i;
const SUGGESTION_KEY_RE = /^[a-z0-9-]{1,60}$/;
const NAME_MAX = 80;
const REASON_MAX = 200;
const BATCH_MAX = 50;

const isTripId = (v) => typeof v === 'string' && TRIP_ID_RE.test(v);
const isItemId = (v) => typeof v === 'string' && ITEM_ID_RE.test(v);

function checkName(raw, errors) {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push('name is required');
    return null;
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length > NAME_MAX) errors.push(`name must be at most ${NAME_MAX} characters`);
  return name;
}

function checkEnum(raw, field, allowed, errors) {
  if (!allowed.includes(raw)) errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  return raw;
}

/**
 * Validate a new item. Returns { ok, errors, value }.
 * Only name is required; the rest fall back to sensible defaults.
 */
function validateNewItem(input) {
  const errors = [];
  const value = {
    name: checkName(input?.name, errors),
    category: checkEnum(input?.category ?? 'Essentials', 'category', CATEGORIES, errors),
    priority: checkEnum(input?.priority ?? 'essential', 'priority', PRIORITIES, errors),
    source: checkEnum(input?.source ?? 'custom', 'source', SOURCES, errors),
    done: false,
    reason: null,
    suggestionKey: null,
  };

  if (input?.reason != null) {
    if (typeof input.reason !== 'string' || input.reason.length > REASON_MAX) {
      errors.push(`reason must be text of at most ${REASON_MAX} characters`);
    } else {
      value.reason = input.reason.trim() || null;
    }
  }

  // suggestionKey marks catalogue items (defaults and suggestions) so the same
  // one is never added twice to a trip. Custom items don't have one.
  if (input?.suggestionKey != null) {
    if (typeof input.suggestionKey !== 'string' || !SUGGESTION_KEY_RE.test(input.suggestionKey)) {
      errors.push('suggestionKey must be lowercase letters, digits or dashes');
    } else {
      value.suggestionKey = input.suggestionKey;
    }
  }

  return { ok: errors.length === 0, errors, value };
}

/**
 * Validate a partial update. Only name, category, priority and done can change;
 * other fields are ignored. At least one editable field must be present.
 */
function validatePatch(input) {
  const errors = [];
  const value = {};
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['body must be a JSON object'], value };
  }
  if ('name' in input) value.name = checkName(input.name, errors);
  if ('category' in input) value.category = checkEnum(input.category, 'category', CATEGORIES, errors);
  if ('priority' in input) value.priority = checkEnum(input.priority, 'priority', PRIORITIES, errors);
  if ('done' in input) {
    if (typeof input.done !== 'boolean') errors.push('done must be true or false');
    value.done = input.done;
  }
  if (!Object.keys(value).length) errors.push('nothing to update: send name, category, priority or done');
  return { ok: errors.length === 0, errors, value };
}

/** Validate a batch of catalogue items; each one must carry a suggestionKey. */
function validateBatch(input) {
  const list = input?.items;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, errors: ['items must be a non-empty array'], value: [] };
  }
  if (list.length > BATCH_MAX) {
    return { ok: false, errors: [`at most ${BATCH_MAX} items per request`], value: [] };
  }
  const errors = [];
  const value = [];
  list.forEach((raw, i) => {
    const v = validateNewItem(raw);
    if (!v.value.suggestionKey && v.ok) v.errors.push('suggestionKey is required in a batch');
    if (v.errors.length) errors.push(...v.errors.map((e) => `items[${i}]: ${e}`));
    else value.push(v.value);
  });
  return { ok: errors.length === 0, errors, value };
}

/** Convert a stored document into the shape the client sees. */
function toClient(doc) {
  return {
    id: doc._id.toHexString(),
    tripId: doc.tripId,
    name: doc.name,
    category: doc.category,
    priority: doc.priority,
    done: doc.done,
    source: doc.source,
    reason: doc.reason ?? null,
    suggestionKey: doc.suggestionKey ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

module.exports = {
  isTripId,
  isItemId,
  validateNewItem,
  validatePatch,
  validateBatch,
  toClient,
};
