// Checklist catalogue: categories, items (with the situations each one is for), default items
// and trip types. Pure data + functions (no Vue, no fetch) so it is easy to test.
// Recommendations are computed from this metadata by recommend.js.
import { recommend, activitySignals, backupSignals } from './recommend.js'

// Keep in sync with CATEGORIES in server/src/checklist/checklistLogic.js.
export const CATEGORIES = [
  { name: 'Documents', icon: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>' },
  { name: 'Clothing', icon: '<path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c0 1.5-1.5 3-4 3S8 5.5 8 4z"/>' },
  { name: 'Electronics', icon: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>' },
  { name: 'Toiletries', icon: '<rect x="7" y="8" width="10" height="13" rx="2"/><path d="M10 8V5h4v3M10 3h5"/>' },
  { name: 'Health', icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M12 10v7M8.5 13.5h7"/>' },
  { name: 'Essentials', icon: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' },
]

// Every catalogue item has a stable key. The server refuses a second item
// with the same key on one trip, which is what stops duplicate suggestions.
// `needs` lists the situations (tags from recommend.js TAGS) the item is for, with a weight:
// 3 = core for that situation, 2 = recommended, 1 = nice to have. Items without `needs`
// are general essentials that come from the starter list instead.
// `also` (optional) lists other names that mean the same thing, so an item the user typed
// themselves ("Anker power bank") counts as already on the list.
export const ITEMS = {
  passport: { name: 'Passport', category: 'Documents', priority: 'essential', needs: { abroad: 3 } },
  bookings: { name: 'Flight & hotel bookings', category: 'Documents', priority: 'essential' },
  insurance: { name: 'Travel insurance details', category: 'Documents', priority: 'essential', needs: { abroad: 2, ski: 2, hike: 1 } },
  'visa-docs': { name: 'Visa / entry documents', category: 'Documents', priority: 'essential', needs: { abroad: 3 } },
  'doc-copies': { name: 'Copies of key documents', category: 'Documents', priority: 'optional', needs: { abroad: 2, 'lost-docs': 3 }, also: ['copies', 'photocopy', 'passport copy', 'scan'] },

  clothes: { name: 'Clothes for each day', category: 'Clothing', priority: 'essential' },
  sleepwear: { name: 'Sleepwear', category: 'Clothing', priority: 'optional' },
  'walking-shoes': { name: 'Comfortable walking shoes', category: 'Clothing', priority: 'essential', needs: { city: 3, hike: 1 } },
  swimwear: { name: 'Swimwear', category: 'Clothing', priority: 'essential', needs: { beach: 3, swim: 3 } },
  sandals: { name: 'Sandals / flip-flops', category: 'Clothing', priority: 'optional', needs: { beach: 2, swim: 2, hot: 1 } },
  'hiking-shoes': { name: 'Hiking shoes', category: 'Clothing', priority: 'essential', needs: { hike: 3 } },
  'rain-jacket': { name: 'Rain jacket', category: 'Clothing', priority: 'essential', needs: { rain: 3, hike: 2 }, also: ['raincoat', 'rain jacket', 'poncho'] },
  'warm-jacket': { name: 'Warm jacket', category: 'Clothing', priority: 'essential', needs: { cold: 3, snow: 2, ski: 2 } },
  thermals: { name: 'Thermal layers', category: 'Clothing', priority: 'optional', needs: { ski: 3, cold: 2, snow: 2 } },
  'gloves-beanie': { name: 'Gloves & beanie', category: 'Clothing', priority: 'optional', needs: { cold: 3, snow: 2 } },

  'phone-charger': { name: 'Phone charger', category: 'Electronics', priority: 'essential' },
  'power-bank': { name: 'Power bank', category: 'Electronics', priority: 'optional', needs: { hike: 2, city: 1, ski: 1, battery: 3 }, also: ['power bank', 'powerbank', 'portable charger'] },
  adapter: { name: 'Travel plug adapter', category: 'Electronics', priority: 'essential', needs: { abroad: 3 }, also: ['adapter', 'adaptor'] },
  'travel-sim': { name: 'Travel SIM / eSIM', category: 'Electronics', priority: 'optional', needs: { abroad: 2 } },
  'phone-pouch': { name: 'Waterproof phone pouch', category: 'Electronics', priority: 'optional', needs: { beach: 2, swim: 2, rain: 1 } },

  toothbrush: { name: 'Toothbrush & toothpaste', category: 'Toiletries', priority: 'essential' },
  'toiletry-bag': { name: 'Toiletry bag (shampoo, soap, deodorant)', category: 'Toiletries', priority: 'essential' },
  towel: { name: 'Quick-dry towel', category: 'Toiletries', priority: 'optional', needs: { swim: 3, beach: 2 } },
  'lip-balm': { name: 'Lip balm', category: 'Toiletries', priority: 'optional', needs: { cold: 2, ski: 2, snow: 1 } },

  medication: { name: 'Personal medication', category: 'Health', priority: 'essential', needs: { unwell: 3 }, also: ['medicine', 'medication', 'prescription', 'painkiller', 'paracetamol'] },
  'first-aid': { name: 'Basic first-aid kit', category: 'Health', priority: 'optional', needs: { hike: 2, ski: 1, unwell: 3 }, also: ['first aid', 'first-aid', 'bandage', 'plaster'] },
  sunscreen: { name: 'Sunscreen', category: 'Health', priority: 'essential', needs: { beach: 3, hot: 3, ski: 2, hike: 2, snow: 1, swim: 1 }, also: ['sunscreen', 'sunblock'] },
  'insect-repellent': { name: 'Insect repellent', category: 'Health', priority: 'essential', needs: { hike: 3, beach: 1, hot: 1 } },

  wallet: { name: 'Wallet & bank cards', category: 'Essentials', priority: 'essential' },
  'house-keys': { name: 'House keys', category: 'Essentials', priority: 'essential' },
  'water-bottle': { name: 'Reusable water bottle', category: 'Essentials', priority: 'optional', needs: { hike: 3, hot: 2, city: 1 }, also: ['water bottle', 'flask'] },
  'local-cash': { name: 'Some local cash', category: 'Essentials', priority: 'optional', needs: { abroad: 2, cash: 3 }, also: ['cash', 'backup card', 'spare card'] },
  sunglasses: { name: 'Sunglasses', category: 'Essentials', priority: 'optional', needs: { beach: 2, hot: 2, ski: 2, snow: 2 } },
  daypack: { name: 'Daypack', category: 'Essentials', priority: 'essential', needs: { hike: 3, city: 2 } },
  snacks: { name: 'Trail snacks', category: 'Essentials', priority: 'optional', needs: { hike: 2, ski: 1 } },
  umbrella: { name: 'Compact umbrella', category: 'Essentials', priority: 'essential', needs: { rain: 3, city: 1 }, also: ['umbrella'] },
  'transit-card': { name: 'Transit card / pass', category: 'Essentials', priority: 'optional', needs: { city: 2 } },
  goggles: { name: 'Swimming goggles', category: 'Essentials', priority: 'optional', needs: { swim: 3, beach: 1 } },

  // Snow & ski
  'snow-boots': { name: 'Snow boots', category: 'Clothing', priority: 'essential', needs: { snow: 3, ski: 2 } },
  'ski-pants': { name: 'Ski pants', category: 'Clothing', priority: 'essential', needs: { ski: 3 } },
  'waterproof-gloves': { name: 'Waterproof gloves', category: 'Clothing', priority: 'essential', needs: { ski: 3, snow: 2 } },
  'ski-goggles': { name: 'Ski goggles', category: 'Essentials', priority: 'essential', needs: { ski: 3 } },
  'ski-gear': { name: 'Skis / board (or rental booking)', category: 'Essentials', priority: 'essential', needs: { ski: 3 } },
  'hand-warmers': { name: 'Hand warmers', category: 'Essentials', priority: 'optional', needs: { ski: 2, cold: 1, snow: 1 } },
  'lift-pass': { name: 'Lift pass', category: 'Documents', priority: 'optional', needs: { ski: 2 } },
}

// The starter list every trip can begin with.
export const DEFAULT_KEYS = [
  'passport', 'bookings', 'insurance',
  'clothes', 'sleepwear', 'walking-shoes',
  'phone-charger', 'power-bank',
  'toothbrush', 'toiletry-bag',
  'medication',
  'wallet', 'house-keys', 'water-bottle',
]

// Trip types the user picks themselves: each one is a preset of situation tags.
export const TRIP_TYPES = [
  { id: 'beach', label: 'Beach', emoji: '🏖', tags: ['beach', 'hot'] },
  { id: 'hiking', label: 'Hiking', emoji: '🥾', tags: ['hike'] },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', tags: ['swim'] },
  { id: 'international', label: 'Overseas', emoji: '🛂', tags: ['abroad'] },
  { id: 'cold', label: 'Cold climate', emoji: '❄', tags: ['cold'] },
  { id: 'rainy', label: 'Rainy season', emoji: '☔', tags: ['rain'] },
  { id: 'city', label: 'City break', emoji: '🏙', tags: ['city'] },
  { id: 'snow', label: 'Snow & ski', emoji: '⛷', tags: ['ski', 'snow'] },
]

/** Request body for one catalogue item. */
export function toNewItem(key, source, reason = null) {
  const { name, category, priority } = ITEMS[key]
  // The API stores reasons of up to 200 characters; an item with many reasons is shortened.
  const short = reason && reason.length > 200 ? reason.slice(0, 199) + '…' : reason
  return { name, category, priority, source, reason: short, suggestionKey: key }
}

/** Signals from the trip types the user picked: each type is a preset of tags. */
function tripTypeSignals(tripTypes = []) {
  return tripTypes.flatMap((id) => {
    const type = TRIP_TYPES.find((t) => t.id === id)
    return type ? type.tags.map((tag) => ({ tag, reason: `${type.label} trip` })) : []
  })
}

/**
 * Ranked suggestions for a trip, from every available source (see recommend.js):
 *   tripTypes:  ['beach', ...]              ids from TRIP_TYPES, picked by the user
 *   signals:    [{ tag, reason }, ...]      e.g. from destination / weather features, once connected
 *   activities: [{ title, date?, type?, tags? }, ...]   from the itinerary, when it exists
 * Returns [{ key, name, category, priority, score, level, reasons, reason }], best first, one per item.
 */
export function suggestionsFor({ tripTypes = [], signals = [], activities = [] } = {}) {
  const trip = [...tripTypeSignals(tripTypes), ...signals, ...activitySignals(activities)]
  return recommend([...trip, ...backupSignals(BACKUPS, trip)])
}

/**
 * A full starting list for a trip: the starter essentials, then every suggestion the trip itself
 * needs (best first, with its reasons). "What if" backups stay as optional suggestions instead.
 * Each key appears once. Returns [{ key, source: 'default' | 'suggested', reason }].
 */
export function generatePlan({ tripTypes = [], signals = [], activities = [] } = {}) {
  const plan = DEFAULT_KEYS.map((key) => ({ key, source: 'default', reason: null }))
  const seen = new Set(DEFAULT_KEYS)
  for (const s of suggestionsFor({ tripTypes, signals, activities })) {
    if (seen.has(s.key) || s.backupOnly) continue
    seen.add(s.key)
    plan.push({ key: s.key, source: 'suggested', reason: s.reason })
  }
  return plan
}

// Leaving-home checks for the final departure review (not packing items).
export const DEPARTURE_CHECKS = [
  { id: 'phone', label: 'Phone charged and with you' },
  { id: 'tickets', label: 'Tickets or boarding pass easy to reach' },
  { id: 'locked', label: 'Doors and windows locked' },
  { id: 'off', label: 'Lights, stove and appliances off' },
]

/**
 * Drop suggestions already covered by the checklist: same catalogue key, a custom item with the
 * same name ("passport" typed by hand), or one matching the item's other names in `also`
 * ("Anker power bank" covers Power bank).
 */
export function withoutExisting(suggestions, items) {
  const keys = new Set(items.map((i) => i.suggestionKey).filter(Boolean))
  const names = new Set(items.map((i) => i.name.trim().toLowerCase()))
  return suggestions.filter((s) => !keys.has(s.key) && !names.has(s.name.toLowerCase())
    && !items.some((i) => nameHas(i.name, ITEMS[s.key]?.also ?? [])))
}

// Words that hint at a category when someone types their own item.
// Matched at the start of a word; the longest match wins ("toiletry bag" -> Toiletries, not "bag").
const CATEGORY_WORDS = {
  Documents: ['passport', 'visa', 'ticket', 'boarding pass', 'booking', 'reservation', 'insurance', 'licence', 'license', 'id card', 'permit', 'itinerary', 'document', 'vaccination record'],
  Clothing: ['shirt', 't-shirt', 'pants', 'trousers', 'jeans', 'shorts', 'dress', 'skirt', 'jacket', 'coat', 'sweater', 'hoodie', 'cardigan', 'jumper', 'sock', 'underwear', 'bra', 'shoe', 'sneaker', 'boot', 'sandal', 'flip-flop', 'slipper', 'hat', 'cap', 'scarf', 'glove', 'swim', 'bikini', 'pyjama', 'pajama', 'belt', 'legging', 'outfit', 'clothes'],
  Electronics: ['charger', 'cable', 'phone', 'laptop', 'tablet', 'ipad', 'camera', 'battery', 'power bank', 'adapter', 'adaptor', 'plug', 'headphone', 'earphone', 'earbud', 'airpods', 'kindle', 'e-reader', 'usb', 'sim', 'esim', 'smartwatch', 'drone', 'gopro', 'speaker', 'keyboard', 'mouse', 'hard drive'],
  Toiletries: ['toothbrush', 'toothpaste', 'floss', 'shampoo', 'conditioner', 'soap', 'body wash', 'deodorant', 'razor', 'shaving', 'comb', 'hairbrush', 'hair tie', 'makeup', 'make-up', 'skincare', 'moisturi', 'lotion', 'perfume', 'cologne', 'towel', 'tissue', 'wipes', 'contact lens', 'tampon', 'sanitary', 'toiletr', 'nail', 'cotton'],
  Health: ['medicine', 'medication', 'pill', 'vitamin', 'bandage', 'plaster', 'first aid', 'first-aid', 'sunscreen', 'sunblock', 'repellent', 'mosquito', 'mask', 'sanitiser', 'sanitizer', 'painkiller', 'paracetamol', 'panadol', 'ibuprofen', 'inhaler', 'prescription', 'thermometer', 'ointment', 'antihistamine', 'motion sickness'],
  Essentials: ['wallet', 'cash', 'money', 'card', 'key', 'umbrella', 'bottle', 'bag', 'backpack', 'daypack', 'luggage', 'snack', 'sunglasses', 'glasses', 'pen', 'notebook', 'lock', 'pillow', 'book', 'earplug', 'eye mask'],
}
const CATEGORY_HINTS = Object.entries(CATEGORY_WORDS)
  .flatMap(([category, words]) => words.map((word) => ({ word, category })))
  .sort((a, b) => b.word.length - a.word.length)

// True if any word in `words` starts a word in `name` ("Phone charger" has "charger").
function nameHas(name, words) {
  const text = ' ' + String(name ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' '
  return words.some((w) => text.includes(' ' + w))
}

// Easy-to-forget items that can ruin a trip. Each also matches items typed by hand.
export const CRITICAL = [
  { key: 'passport', words: ['passport'] },
  { key: 'bookings', words: ['booking', 'ticket', 'boarding pass', 'reservation'] },
  { key: 'wallet', words: ['wallet', 'bank card', 'credit card'] },
  { key: 'phone-charger', words: ['charger', 'charging cable'] },
  { key: 'medication', words: ['medication', 'medicine', 'prescription', 'pills'] },
  { key: 'house-keys', words: ['house key', 'keys', 'key'] },
]

/**
 * Status of each critical item: 'missing' (not on the list), 'unpacked' or 'packed'.
 * Returns [{ key, name, state, item }].
 */
export function essentialsCheck(items) {
  return CRITICAL.map(({ key, words }) => {
    const item = items.find((i) => i.suggestionKey === key) ?? items.find((i) => nameHas(i.name, words))
    return { key, name: ITEMS[key].name, item: item ?? null, state: !item ? 'missing' : item.done ? 'packed' : 'unpacked' }
  })
}

// "What if…?" backups: things that can go wrong on any trip. Each is a tag + reason that the
// engine adds with lower strength (recommend.js backupSignals). `when` limits a backup to trips
// that already have those tags. Which items cover a backup is set in the items' `needs`.
// Supporting a new backup = one row here + that tag in some items' needs (and in TAGS).
export const BACKUPS = [
  { tag: 'rain', reason: 'Backup: if it rains all day' },
  { tag: 'battery', reason: 'Backup: if your phone dies' },
  { tag: 'unwell', reason: 'Backup: if you feel unwell' },
  { tag: 'cash', reason: 'Backup: if your card gets blocked' },
  { tag: 'lost-docs', reason: 'Backup: if you lose your passport', when: ['abroad'] },
]

/**
 * Guess the category for an item name the user typed, or null if unsure.
 * Catalogue names win first ("Daypack" -> Essentials), then keyword hints.
 */
export function guessCategory(name) {
  const text = String(name ?? '').trim().toLowerCase()
  if (text.length < 3) return null
  const known = Object.values(ITEMS).find((i) => i.name.toLowerCase() === text)
  if (known) return known.category
  const words = ' ' + text.replace(/[^a-z0-9-]+/g, ' ') + ' '
  const hit = CATEGORY_HINTS.find((h) => words.includes(' ' + h.word))
  return hit ? hit.category : null
}
