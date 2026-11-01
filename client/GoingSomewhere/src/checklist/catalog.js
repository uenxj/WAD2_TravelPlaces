// Checklist catalogue: categories, default items and trip-type suggestions.
// Pure data + functions (no Vue, no fetch) so it is easy to test and to feed
// from other features later, e.g. the itinerary planner.

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
export const ITEMS = {
  passport: { name: 'Passport', category: 'Documents', priority: 'essential' },
  bookings: { name: 'Flight & hotel bookings', category: 'Documents', priority: 'essential' },
  insurance: { name: 'Travel insurance details', category: 'Documents', priority: 'essential' },
  'visa-docs': { name: 'Visa / entry documents', category: 'Documents', priority: 'essential' },
  'doc-copies': { name: 'Copies of key documents', category: 'Documents', priority: 'optional' },

  clothes: { name: 'Clothes for each day', category: 'Clothing', priority: 'essential' },
  sleepwear: { name: 'Sleepwear', category: 'Clothing', priority: 'optional' },
  'walking-shoes': { name: 'Comfortable walking shoes', category: 'Clothing', priority: 'essential' },
  swimwear: { name: 'Swimwear', category: 'Clothing', priority: 'essential' },
  sandals: { name: 'Sandals / flip-flops', category: 'Clothing', priority: 'optional' },
  'hiking-shoes': { name: 'Hiking shoes', category: 'Clothing', priority: 'essential' },
  'rain-jacket': { name: 'Rain jacket', category: 'Clothing', priority: 'essential' },
  'warm-jacket': { name: 'Warm jacket', category: 'Clothing', priority: 'essential' },
  thermals: { name: 'Thermal layers', category: 'Clothing', priority: 'optional' },
  'gloves-beanie': { name: 'Gloves & beanie', category: 'Clothing', priority: 'optional' },

  'phone-charger': { name: 'Phone charger', category: 'Electronics', priority: 'essential' },
  'power-bank': { name: 'Power bank', category: 'Electronics', priority: 'optional' },
  adapter: { name: 'Travel plug adapter', category: 'Electronics', priority: 'essential' },
  'travel-sim': { name: 'Travel SIM / eSIM', category: 'Electronics', priority: 'optional' },
  'phone-pouch': { name: 'Waterproof phone pouch', category: 'Electronics', priority: 'optional' },

  toothbrush: { name: 'Toothbrush & toothpaste', category: 'Toiletries', priority: 'essential' },
  'toiletry-bag': { name: 'Toiletry bag (shampoo, soap, deodorant)', category: 'Toiletries', priority: 'essential' },
  towel: { name: 'Quick-dry towel', category: 'Toiletries', priority: 'optional' },
  'lip-balm': { name: 'Lip balm', category: 'Toiletries', priority: 'optional' },

  medication: { name: 'Personal medication', category: 'Health', priority: 'essential' },
  'first-aid': { name: 'Basic first-aid kit', category: 'Health', priority: 'optional' },
  sunscreen: { name: 'Sunscreen', category: 'Health', priority: 'essential' },
  'insect-repellent': { name: 'Insect repellent', category: 'Health', priority: 'essential' },

  wallet: { name: 'Wallet & bank cards', category: 'Essentials', priority: 'essential' },
  'house-keys': { name: 'House keys', category: 'Essentials', priority: 'essential' },
  'water-bottle': { name: 'Reusable water bottle', category: 'Essentials', priority: 'optional' },
  'local-cash': { name: 'Some local cash', category: 'Essentials', priority: 'optional' },
  sunglasses: { name: 'Sunglasses', category: 'Essentials', priority: 'optional' },
  daypack: { name: 'Daypack', category: 'Essentials', priority: 'essential' },
  snacks: { name: 'Trail snacks', category: 'Essentials', priority: 'optional' },
  umbrella: { name: 'Compact umbrella', category: 'Essentials', priority: 'essential' },
  'transit-card': { name: 'Transit card / pass', category: 'Essentials', priority: 'optional' },
  goggles: { name: 'Swimming goggles', category: 'Essentials', priority: 'optional' },
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

// Trip types the user picks themselves. Not derived from live data.
export const TRIP_TYPES = [
  { id: 'beach', label: 'Beach', emoji: '🏖', keys: ['swimwear', 'sunscreen', 'sandals', 'sunglasses', 'towel', 'phone-pouch'] },
  { id: 'hiking', label: 'Hiking', emoji: '🥾', keys: ['hiking-shoes', 'daypack', 'water-bottle', 'insect-repellent', 'rain-jacket', 'first-aid', 'snacks'] },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', keys: ['swimwear', 'towel', 'goggles', 'sandals'] },
  { id: 'international', label: 'Overseas', emoji: '🛂', keys: ['passport', 'visa-docs', 'doc-copies', 'adapter', 'travel-sim', 'local-cash'] },
  { id: 'cold', label: 'Cold climate', emoji: '❄', keys: ['warm-jacket', 'thermals', 'gloves-beanie', 'lip-balm'] },
  { id: 'rainy', label: 'Rainy season', emoji: '☔', keys: ['umbrella', 'rain-jacket', 'phone-pouch'] },
  { id: 'city', label: 'City break', emoji: '🏙', keys: ['walking-shoes', 'daypack', 'transit-card', 'power-bank'] },
]

// Words in an itinerary activity that imply a trip type. Used by
// suggestionsFor({ activities }) once the itinerary planner can supply them.
const ACTIVITY_HINTS = [
  { type: 'beach', words: ['beach', 'island', 'snorkel', 'sentosa', 'coast', 'surf'] },
  { type: 'hiking', words: ['hike', 'hiking', 'trek', 'trail', 'mountain', 'national park', 'nature reserve'] },
  { type: 'swimming', words: ['swim', 'pool', 'water park', 'waterpark', 'hot spring', 'onsen'] },
  { type: 'cold', words: ['ski', 'snow', 'glacier', 'ice'] },
]

/** Request body for one catalogue item. */
export function toNewItem(key, source, reason = null) {
  return { ...ITEMS[key], source, reason, suggestionKey: key }
}

/**
 * Build suggestions from trip types the user picked and/or itinerary activities.
 *   tripTypes:  ['beach', ...]           ids from TRIP_TYPES
 *   activities: [{ title: 'Sentosa beach day' }, ...]   from the itinerary, when available
 * Returns [{ key, name, category, priority, reason }], one entry per item,
 * with the reasons merged when several trip types suggest the same thing.
 */
export function suggestionsFor({ tripTypes = [], activities = [] } = {}) {
  const reasons = new Map() // key -> [reason]
  const add = (key, reason) => {
    if (!ITEMS[key]) return
    const list = reasons.get(key) ?? []
    if (!list.includes(reason)) list.push(reason)
    reasons.set(key, list)
  }

  for (const id of tripTypes) {
    const type = TRIP_TYPES.find((t) => t.id === id)
    type?.keys.forEach((key) => add(key, `${type.label} trip`))
  }

  for (const activity of activities) {
    const title = String(activity?.title ?? '').trim()
    const text = title.toLowerCase()
    if (!text) continue
    for (const hint of ACTIVITY_HINTS) {
      if (!hint.words.some((w) => text.includes(w))) continue
      const type = TRIP_TYPES.find((t) => t.id === hint.type)
      type.keys.forEach((key) => add(key, `Itinerary: “${title}”`))
    }
  }

  return [...reasons].map(([key, why]) => ({ key, ...ITEMS[key], reason: why.join(' · ') }))
}

/**
 * A full starting list for a trip: the starter essentials, then everything the chosen
 * trip types suggest (with their reasons). Each key appears once.
 * Returns [{ key, source: 'default' | 'suggested', reason }].
 */
export function generatePlan({ tripTypes = [], activities = [] } = {}) {
  const plan = DEFAULT_KEYS.map((key) => ({ key, source: 'default', reason: null }))
  const seen = new Set(DEFAULT_KEYS)
  for (const s of suggestionsFor({ tripTypes, activities })) {
    if (seen.has(s.key)) continue
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
 * Drop suggestions already covered by the checklist: same catalogue key, or a
 * custom item with the same name (so "passport" typed by hand counts too).
 */
export function withoutExisting(suggestions, items) {
  const keys = new Set(items.map((i) => i.suggestionKey).filter(Boolean))
  const names = new Set(items.map((i) => i.name.trim().toLowerCase()))
  return suggestions.filter((s) => !keys.has(s.key) && !names.has(s.name.toLowerCase()))
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

// "What if...?" scenarios: is there a backup on the list for each one?
export const SCENARIOS = [
  { id: 'rain', emoji: '☔', label: 'It rains all day', keys: ['umbrella', 'rain-jacket'], words: ['umbrella', 'raincoat', 'rain jacket', 'poncho'] },
  { id: 'battery', emoji: '🔋', label: 'Your phone dies', keys: ['power-bank'], words: ['power bank', 'powerbank', 'portable charger'] },
  { id: 'sick', emoji: '🤒', label: 'You feel unwell', keys: ['first-aid', 'medication'], words: ['first aid', 'first-aid', 'medicine', 'medication', 'painkiller', 'paracetamol'] },
  { id: 'card', emoji: '💳', label: 'Your card gets blocked', keys: ['local-cash'], words: ['cash', 'backup card', 'spare card'] },
  { id: 'passport', emoji: '🛂', label: 'You lose your passport', keys: ['doc-copies'], words: ['copies', 'photocopy', 'passport copy', 'scan'] },
  { id: 'plug', emoji: '🔌', label: "The socket doesn't fit", keys: ['adapter'], words: ['adapter', 'adaptor'] },
  { id: 'heat', emoji: '☀', label: "It's a scorching day", keys: ['sunscreen', 'water-bottle'], words: ['sunscreen', 'sunblock', 'water bottle'] },
]

/** For each scenario: covered (and by which item) or the catalogue key that would cover it. */
export function checkScenarios(items) {
  return SCENARIOS.map((s) => {
    const by = items.find((i) => s.keys.includes(i.suggestionKey)) ?? items.find((i) => nameHas(i.name, s.words)) ?? null
    return { ...s, covered: !!by, by, fixKey: s.keys[0] }
  })
}

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
