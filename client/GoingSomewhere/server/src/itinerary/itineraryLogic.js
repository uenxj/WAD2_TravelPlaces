// Pure itinerary logic: dates, validation, conflict detection and the weather shape.
// No I/O, no Express, no DB, so it is easy to unit test.

// An activity's setting: 'indoor', 'outdoor' or 'both' (Indoor & Outdoor). The only field stored for it.
const SETTINGS = ['indoor', 'outdoor', 'both'];
const ITEM_TYPES = ['place', 'event', 'transport', 'custom'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const NAME_MAX = 80;
const DESTINATION_MAX = 100;
const TITLE_MAX = 120;
const ADDRESS_MAX = 200;
const NOTES_MAX = 1000;

// ---- dates (plain 'YYYY-MM-DD' strings everywhere) ------------------------------------------

/** Today's date as 'YYYY-MM-DD' in the app's timezone (Singapore unless APP_TIMEZONE is set). */
function todayString(now = new Date()) {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Singapore';
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** True only for real calendar dates ("2026-02-30" is rejected). */
function isRealDate(value) {
  if (!DATE_RE.test(String(value))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDays(value, days) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- activity setting -------------------------------------------------------------------------

const settingOf = (item) => (SETTINGS.includes(item?.setting) ? item.setting : 'indoor');

/** Can the weather affect this activity? True for 'outdoor' and 'both'. The one place that rule lives. */
const isWeatherExposed = (item) => settingOf(item) !== 'indoor';

// ---- conflict detection -----------------------------------------------------------------------
//
// detectConflicts(items, options) -> { [itemId]: Conflict[] }
// Conflict = { type, severity: 'error' | 'warning', message, withItemId? }
//
// options (all optional):
//   getTravelMinutes(fromItem, toItem) -> Promise<number|null>   (Route Planner)
//   getWeatherFlag(item) -> Promise<{unsafe, reason}|null>        (Weather / Haze)

function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

function overlaps(a, b) {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

// Who added an item, for messages: the member's name when the route resolved it, otherwise the id.
const author = (item) => item.createdByName || item.createdBy;

async function detectConflicts(items, options = {}) {
  const result = {};
  const add = (item, conflict) => {
    const id = String(item._id);
    if (!result[id]) result[id] = [];
    result[id].push(conflict);
  };

  // 1. Per-item checks: weather/haze
  for (const item of items) {
    if (isWeatherExposed(item) && options.getWeatherFlag) {
      const flag = await options.getWeatherFlag(item);
      if (flag?.unsafe) {
        add(item, {
          type: 'weather',
          severity: 'warning',
          message: `Outdoor activity may be unsafe or uncomfortable: ${flag.reason || 'bad weather/haze'}.`,
        });
      }
    }
  }

  // 2. Group items by day for time-based checks
  const byDate = {};
  for (const item of items) (byDate[item.date] ||= []).push(item);

  for (const dayItems of Object.values(byDate)) {
    dayItems.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    // Overlaps (also catches clashes between different group members)
    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const a = dayItems[i];
        const b = dayItems[j];
        if (!overlaps(a, b)) continue;
        const crossMember = a.createdBy !== b.createdBy;
        const type = crossMember ? 'group-overlap' : 'overlap';
        add(a, {
          type,
          severity: 'error',
          message: `Overlaps with "${b.title}" (${b.startTime}-${b.endTime})${crossMember ? `, added by ${author(b)}` : ''}.`,
          withItemId: String(b._id),
        });
        add(b, {
          type,
          severity: 'error',
          message: `Overlaps with "${a.title}" (${a.startTime}-${a.endTime})${crossMember ? `, added by ${author(a)}` : ''}.`,
          withItemId: String(a._id),
        });
      }
    }

    // Not enough time to travel between consecutive items
    if (options.getTravelMinutes) {
      for (let i = 0; i < dayItems.length - 1; i++) {
        const a = dayItems[i];
        const b = dayItems[i + 1];
        if (overlaps(a, b)) continue; // already reported
        const gap = toMinutes(b.startTime) - toMinutes(a.endTime);
        const travel = await options.getTravelMinutes(a, b);
        if (travel != null && gap < travel) {
          add(b, {
            type: 'travel-time',
            severity: 'warning',
            message: `Only ${gap} min after "${a.title}" but travelling there takes about ${travel} min.`,
            withItemId: String(a._id),
          });
        }
      }
    }
  }

  return result;
}

// ---- weather shape ------------------------------------------------------------------------------
//
// item.weather = what the weather features need to look an activity up:
//   {
//     id:              same as item._id
//     coordinates:     { lat, lng } | null        null = nothing to look up, skip this item
//     coordinatesFrom: 'activity' | 'destination' | null
//     timezone:        'Asia/Singapore' | null    IANA name of the destination
//     startLocal:      '2026-11-07T10:00'         local time at the activity, NO offset on purpose
//     endLocal:        '2026-11-07T12:00'
//     setting:         'indoor' | 'outdoor' | 'both'
//   }
// It is worked out every time items are read, so nothing extra is stored on items.

// tz-lookup turns lat/lng into a timezone name without any network call. If it is not installed
// (pnpm install in client/GoingSomewhere) we keep going with empty timezones instead of crashing.
let tzlookup = null;
try {
  tzlookup = require('tz-lookup');
} catch {
  // not installed
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const hasCoords = (p) => Number.isFinite(num(p?.lat)) && Number.isFinite(num(p?.lng));

function timezoneFor(lat, lng) {
  if (!tzlookup || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  try {
    return tzlookup(Number(lat), Number(lng)) || null;
  } catch {
    return null;
  }
}

function toWeatherActivity(item, trip = {}) {
  const own = hasCoords(item.location);
  const fallback = hasCoords(trip.center);
  const point = own ? item.location : fallback ? trip.center : null;
  const coordinates = point ? { lat: Number(point.lat), lng: Number(point.lng) } : null;
  return {
    id: String(item._id),
    coordinates,
    coordinatesFrom: own ? 'activity' : fallback ? 'destination' : null,
    timezone: (coordinates && timezoneFor(coordinates.lat, coordinates.lng)) || trip.timezone || null,
    startLocal: `${item.date}T${item.startTime}`,
    endLocal: `${item.date}T${item.endTime}`,
    setting: settingOf(item),
  };
}

// ---- validation ---------------------------------------------------------------------------------

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Check trip details for create and edit. Returns an error message, or null when they are fine.
 * `existing` is the saved trip when editing: a trip that has already started keeps its dates.
 */
function validateTrip({ name, destination, startDate, endDate } = {}, existing = null) {
  if (!text(name) || !text(destination) || !isRealDate(startDate) || !isRealDate(endDate)) {
    return 'Name, destination, start date and end date are required.';
  }
  if (text(name).length > NAME_MAX) return `Trip name must be at most ${NAME_MAX} characters.`;
  if (text(destination).length > DESTINATION_MAX) return `Destination must be at most ${DESTINATION_MAX} characters.`;
  if (endDate < startDate) return 'End date must be on or after the start date.';
  // Dates cannot be moved into the past. A trip that has already started keeps the dates it already has.
  const today = todayString();
  if (startDate < today && startDate !== existing?.startDate) return 'Start date cannot be in the past.';
  if (endDate < today && endDate !== existing?.endDate) return 'End date cannot be in the past.';
  return null;
}

/** Check an activity against its trip. Returns an error message, or null when it is fine. */
function validateItem(body = {}, trip) {
  const { title, type, date, startTime, endTime, cost, setting, notes } = body;
  if (!text(title)) return 'Title is required.';
  if (text(title).length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters.`;
  if (type !== undefined && type !== '' && !ITEM_TYPES.includes(type)) return 'Choose a valid activity type.';
  if (!DATE_RE.test(date)) return 'Pick a valid date.';
  if (date < trip.startDate || date > trip.endDate) return 'Date must be within the trip dates.';
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return 'Start and end times are required.';
  if (toMinutes(endTime) <= toMinutes(startTime)) return 'End time must be after the start time.';
  if (cost != null && cost !== '' && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) return 'Cost must be 0 or more.';
  if (setting !== undefined && setting !== '' && !SETTINGS.includes(setting)) return 'Choose indoor, outdoor, or indoor & outdoor.';
  if (notes != null && String(notes).length > NOTES_MAX) return `Notes must be at most ${NOTES_MAX} characters.`;
  return null;
}

/** A location from the client -> { address, lat?, lng? }, or null when it is not an object. */
function cleanLocation(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const out = { address: String(loc.address ?? '').trim().slice(0, ADDRESS_MAX) };
  const lat = num(loc.lat);
  const lng = num(loc.lng);
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    out.lat = lat;
    out.lng = lng;
  }
  return out;
}

/**
 * Only allow these fields from the client (so it cannot overwrite createdBy, tripId, etc.), and drop
 * the ones it did not send so an update never wipes them out.
 *   cost not sent    -> an edit keeps the saved cost (new items default to 0)
 *   setting not sent -> new items are 'indoor', an edit keeps the saved value
 */
function pickItemFields(body) {
  const { title, type, placeId, location, date, startTime, endTime, cost, setting, notes } = body;
  const fields = {
    title: String(title).trim(),
    type: ITEM_TYPES.includes(type) ? type : undefined,
    placeId: typeof placeId === 'string' ? placeId.slice(0, 100) : undefined,
    location,
    date,
    startTime,
    endTime,
    cost: cost === '' || cost == null ? undefined : Number(cost),
    setting: SETTINGS.includes(setting) ? setting : undefined,
    notes: notes == null ? undefined : String(notes),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

module.exports = {
  SETTINGS,
  ITEM_TYPES,
  todayString,
  isRealDate,
  addDays,
  settingOf,
  isWeatherExposed,
  toMinutes,
  overlaps,
  detectConflicts,
  hasCoords,
  timezoneFor,
  toWeatherActivity,
  validateTrip,
  validateItem,
  cleanLocation,
  pickItemFields,
};
