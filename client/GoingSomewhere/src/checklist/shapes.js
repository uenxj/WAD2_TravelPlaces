// Flat item illustrations for the suitcase and Quick pack (40 x 40 viewBox).
// Drawn with the parent <svg>'s fill (the category tint) and a dark outline; details use
// D (dark) or a white highlight. Pure data, so it can be tested without a browser.

const D = '#0f1a2c'
const HI = 'fill="#fff" fill-opacity=".4"'
const DK = `fill="${D}" fill-opacity=".55"`
const NO = 'fill="none"'
// Structural lines (cables, straps, handles) drawn in the tint so they show on the dark background.
const LN = 'fill="none" style="stroke:var(--c)"'

export const SHAPES = {
  passport: `<rect x="10" y="4" width="21" height="31" rx="3"/><path d="M13.5 4v31" ${NO} stroke-opacity=".35"/>
    <circle cx="21.5" cy="17" r="5" ${NO}/><path d="M16.5 17h10M21.5 12c-2 3-2 7 0 10M21.5 12c2 3 2 7 0 10M17 28h9" ${NO}/>`,
  ticket: `<path d="M4 12h32v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6z"/><path d="M27 13v14" ${NO} stroke-dasharray="2 2"/>
    <path d="M9 17h12M9 22h8" ${NO}/>`,
  document: `<path d="M10 4h14l7 7v25H10z"/><path d="M24 4v7h7z" ${HI}/><path d="M14 18h13M14 23h13M14 28h9" ${NO}/>`,
  tshirt: `<path d="M14 6 5 11l3 7 4-2v18h16V16l4 2 3-7-9-5c-1 3-3 4.5-6 4.5S15 9 14 6z"/>
    <path d="M14 6c1 3 3 4.5 6 4.5S25 9 26 6" ${NO}/>`,
  pants: `<path d="M11 5h18l2 31h-8l-3-19-3 19H9z"/><path d="M11 10h18M20 10v7" ${NO}/>`,
  shoe: `<path d="M4 27c0-7 2-13 4-15h7c1 4 4 7 9 8l9 2c2 .6 3 2.5 3 5v3H4z"/><path d="M4 27h32M14 15.5l3 1M15.5 19.5l3 1" ${NO}/>
    <path d="M4 30h32v3H4z" ${DK}/>`,
  sandal: `<path d="M11 4c3.5 0 5.5 3 5.5 8 0 4-1 8-1 13 0 5-1.5 9-4.5 9S6.5 30 6.5 25c0-5-1-9-1-13 0-5 2-8 5.5-8z"/>
    <path d="M29 6c3.5 0 5.5 3 5.5 8 0 4-1 8-1 13 0 5-1.5 9-4.5 9s-4.5-4-4.5-9c0-5-1-9-1-13 0-5 2-8 5.5-8z"/>
    <path d="M6.5 15.5 11 10l4.8 5.5M24.5 17.5 29 12l4.8 5.5" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.2"/>`,
  swimwear: `<path d="M8 10h24l2 18H24l-4-7-4 7H6z"/><path d="M8 14h24" ${NO}/><path d="M18 14v4M22 14v4" ${NO}/>`,
  jacket: `<path d="M15 5 6 10l-1 21 5 1 1-11v15h18V21l1 11 5-1-1-21-9-5-5 4z"/>
    <path d="M20 9v27M15 5l5 4 5-4M13.5 25h3M23.5 25h3" ${NO}/>`,
  hat: `<path d="M8 28c0-10 5-17 12-17s12 7 12 17z"/><rect x="6.5" y="26" width="27" height="7" rx="2.5"/>
    <circle cx="20" cy="8.5" r="3.5"/><path d="M12 28v3M16 28v3M20 28v3M24 28v3M28 28v3" ${NO} stroke-opacity=".5"/>`,
  clothes: `<rect x="7" y="23" width="26" height="9" rx="2"/><rect x="9" y="15" width="22" height="9" rx="2"/>
    <rect x="11" y="7" width="18" height="9" rx="2"/><path d="M17 7l3 3 3-3" ${NO}/>`,
  phone: `<rect x="12" y="3" width="16" height="34" rx="3.5"/><rect x="14.5" y="7" width="11" height="23" rx="1" ${DK}/>
    <path d="M18 33.5h4" ${NO}/>`,
  charger: `<path d="M16 3v6M24 3v6" ${LN} stroke-width="2.4"/><rect x="11" y="9" width="18" height="14" rx="3"/>
    <path d="M21.5 12 18 17h4l-3.5 5" ${NO}/><path d="M20 23v4c0 4 5 4 5 9" ${LN} stroke-width="2.6"/>`,
  powerbank: `<rect x="10" y="5" width="20" height="30" rx="4"/><path d="M17 5V3h6v2" ${NO}/>
    <path d="M21.5 11 16 20h5l-2 9 6.5-11h-5z" fill="${D}" fill-opacity=".6" stroke="none"/>`,
  adapter: `<path d="M14 10V4M26 10V4" ${LN} stroke-width="2.6"/><rect x="8" y="10" width="24" height="22" rx="4"/>
    <circle cx="15.5" cy="21" r="2.2" fill="${D}"/><circle cx="24.5" cy="21" r="2.2" fill="${D}"/>`,
  laptop: `<rect x="9" y="7" width="22" height="17" rx="2"/><rect x="11.5" y="9.5" width="17" height="12" rx="1" ${DK}/>
    <path d="M4 27h32l-3 5H7z"/>`,
  camera: `<path d="M6 13h7l2.5-4h9l2.5 4h7v19H6z"/><circle cx="20" cy="22" r="6.5" ${DK}/><circle cx="20" cy="22" r="3" ${NO}/>
    <circle cx="30" cy="17" r="1.2" fill="${D}"/>`,
  sim: `<path d="M10 5h15l6 6v24H10z"/><rect x="14" y="17" width="12" height="12" rx="1.5" ${DK}/><path d="M20 17v12M14 23h12" ${NO}/>`,
  headphones: `<path d="M8 25v-5a12 12 0 0 1 24 0v5" ${LN} stroke-width="3.2"/><rect x="5" y="22" width="8" height="13" rx="3"/>
    <rect x="27" y="22" width="8" height="13" rx="3"/>`,
  toothbrush: `<g transform="rotate(-40 20 20)"><rect x="17" y="3" width="6" height="34" rx="3"/>
    <rect x="16.5" y="3" width="7" height="10" rx="1.5" fill="#fff" fill-opacity=".85"/><path d="M18.5 5v6M20 5v6M21.5 5v6" ${NO}/></g>`,
  pouch: `<path d="M6 14h28l-2 19a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z"/><path d="M6 14c0-3 2-5 5-5h18c3 0 5 2 5 5" ${NO}/>
    <path d="M27 14v5" ${NO}/><circle cx="27" cy="20.5" r="1.6" fill="${D}"/>`,
  bottle: `<rect x="12" y="13" width="16" height="23" rx="4"/><path d="M16 13V9h8v4M20 9V5h-6" ${NO}/>
    <rect x="15" y="20" width="10" height="9" rx="1" ${HI}/>`,
  tube: `<path d="M13 4h14l-2 22H15z"/><rect x="14" y="26" width="12" height="9" rx="2" ${DK}/>
    <circle cx="20" cy="13" r="3" ${NO}/><path d="M20 8v1.5M20 16.5V18M15 13h1.5M23.5 13H25" ${NO}/>`,
  towel: `<rect x="6" y="8" width="28" height="23" rx="3"/><path d="M6 14h28M6 25h28" ${NO} stroke-opacity=".45"/>
    <path d="M10 31v4M14 31v4M18 31v4M22 31v4M26 31v4M30 31v4" ${NO}/>`,
  pill: `<g transform="rotate(-40 20 20)"><rect x="13" y="4" width="14" height="32" rx="7"/>
    <path d="M13 20v-9a7 7 0 0 1 14 0v9z" ${HI}/><path d="M13 20h14" ${NO}/></g>`,
  firstaid: `<rect x="5" y="11" width="30" height="23" rx="3"/><path d="M15 11V7h10v4" ${NO}/>
    <path d="M17.5 16h5v4.5H27v5h-4.5V30h-5v-4.5H13v-5h4.5z" fill="#fff" fill-opacity=".85"/>`,
  spray: `<rect x="12" y="13" width="16" height="23" rx="3"/><path d="M14 13v-3h12v3" ${NO}/>
    <rect x="16" y="4" width="8" height="6" rx="1"/><path d="M27 7h4M30 3.5l2-1M30 10.5l2 1" ${LN} stroke-width="1.8"/>`,
  wallet: `<rect x="5" y="10" width="30" height="22" rx="3"/><path d="M22 16h13v10H22a5 5 0 0 1 0-10z" ${HI}/>
    <circle cx="23.5" cy="21" r="1.7" fill="${D}"/>`,
  keys: `<circle cx="13" cy="14" r="8"/><circle cx="13" cy="14" r="2.6" fill="${D}"/>
    <path d="M18.5 19.5l14 14M27.5 28.5l3-3M30.5 31.5l3-3" ${LN} stroke-width="3.4"/>`,
  cash: `<rect x="4" y="11" width="32" height="18" rx="2"/><circle cx="20" cy="20" r="4.5" ${HI}/>
    <path d="M8 15v2M32 23v2" ${NO}/>`,
  sunglasses: `<path d="M3 15h34" ${LN} stroke-width="2.4"/><path d="M5 15h12v4.5a6 6 0 0 1-12 0z"/>
    <path d="M23 15h12v4.5a6 6 0 0 1-12 0z"/><path d="M8 18l3-2M26 18l3-2" ${NO} stroke="#fff" stroke-opacity=".6"/>`,
  backpack: `<path d="M12 13a8 8 0 0 1 16 0v20a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z"/><path d="M16 8.5a4 4 0 0 1 8 0" ${NO}/>
    <rect x="15" y="23" width="10" height="8" rx="2" ${HI}/><path d="M15 23h10" ${NO}/>`,
  snack: `<path d="M8 12h24l2 3-2 3 2 3-2 3 2 3-2 2H8l-2-2 2-3-2-3 2-3-2-3 2-3z"/><path d="M14 18h12M14 22h8" ${NO}/>`,
  umbrella: `<path d="M4 20a16 16 0 0 1 32 0c-1.8-2-4.6-2-6.4 0-1.8-2-4.6-2-6.4 0-1.8-2-4.6-2-6.4 0-1.8-2-4.6-2-6.4 0-1.8-2-4.6-2-6.4 0z"/>
    <path d="M20 20v12a3 3 0 0 1-6 0" ${LN} stroke-width="2.6"/><path d="M20 2.5V5" ${LN} stroke-width="2.2"/>`,
  card: `<rect x="5" y="10" width="30" height="20" rx="3"/><rect x="9" y="14" width="7" height="5" rx="1" ${DK}/>
    <path d="M9 24c3-3 6 3 9 0s6 3 9 0" ${NO}/>`,
  goggles: `<path d="M2 19.5h5M33 19.5h5" ${LN} stroke-width="3.2"/><rect x="7" y="13" width="12" height="13" rx="6"/>
    <rect x="21" y="13" width="12" height="13" rx="6"/><path d="M19 18.5h2" ${NO}/>`,
  waterbottle: `<path d="M16 7h8v3l3 4v19a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V14l3-4z"/>
    <rect x="15.5" y="3" width="9" height="5" rx="1" ${DK}/><path d="M13 19h14M13 28h14" ${NO} stroke-opacity=".5"/>`,
  book: `<rect x="9" y="5" width="22" height="30" rx="2"/><path d="M13 5v30" ${NO}/><path d="M17 12h10M17 16h7" ${NO}/>`,
  pillow: `<path d="M7 12c4-3 22-3 26 0 2 5 2 11 0 16-4 3-22 3-26 0-2-5-2-11 0-16z"/><path d="M14 15c2 3 2 7 0 10" ${NO} stroke-opacity=".4"/>`,
}

// Catalogue items -> shape.
const KEY_SHAPES = {
  passport: 'passport', bookings: 'ticket', insurance: 'document', 'visa-docs': 'document', 'doc-copies': 'document',
  clothes: 'clothes', sleepwear: 'tshirt', 'walking-shoes': 'shoe', swimwear: 'swimwear', sandals: 'sandal',
  'hiking-shoes': 'shoe', 'rain-jacket': 'jacket', 'warm-jacket': 'jacket', thermals: 'jacket', 'gloves-beanie': 'hat',
  'phone-charger': 'charger', 'power-bank': 'powerbank', adapter: 'adapter', 'travel-sim': 'sim', 'phone-pouch': 'phone',
  toothbrush: 'toothbrush', 'toiletry-bag': 'pouch', towel: 'towel', 'lip-balm': 'tube',
  medication: 'pill', 'first-aid': 'firstaid', sunscreen: 'tube', 'insect-repellent': 'spray',
  wallet: 'wallet', 'house-keys': 'keys', 'water-bottle': 'waterbottle', 'local-cash': 'cash', sunglasses: 'sunglasses',
  daypack: 'backpack', snacks: 'snack', umbrella: 'umbrella', 'transit-card': 'card', goggles: 'goggles',
}

// Words in a typed item name -> shape. Matched at the start of a word; longest match wins.
const WORD_SHAPES = {
  passport: ['passport'],
  ticket: ['ticket', 'boarding pass', 'booking', 'reservation', 'flight'],
  document: ['visa', 'insurance', 'document', 'copies', 'permit', 'licence', 'license', 'itinerary', 'form'],
  tshirt: ['shirt', 't-shirt', 'tee', 'top', 'blouse', 'pyjama', 'pajama', 'sleepwear', 'dress'],
  pants: ['pants', 'jeans', 'trousers', 'shorts', 'legging', 'skirt'],
  shoe: ['shoe', 'sneaker', 'trainer', 'boot', 'heels'],
  sandal: ['sandal', 'flip-flop', 'slipper'],
  swimwear: ['swim', 'bikini', 'trunks'],
  jacket: ['jacket', 'coat', 'hoodie', 'sweater', 'jumper', 'cardigan', 'raincoat', 'thermal', 'fleece'],
  hat: ['hat', 'cap', 'beanie', 'glove', 'scarf'],
  clothes: ['clothes', 'outfit', 'sock', 'underwear', 'bra'],
  phone: ['phone', 'pouch'],
  charger: ['charger', 'cable', 'usb', 'plug'],
  powerbank: ['power bank', 'powerbank', 'battery'],
  adapter: ['adapter', 'adaptor'],
  laptop: ['laptop', 'ipad', 'tablet', 'kindle', 'e-reader', 'macbook'],
  camera: ['camera', 'gopro', 'drone'],
  sim: ['sim', 'esim'],
  headphones: ['headphone', 'earphone', 'earbud', 'airpods'],
  toothbrush: ['toothbrush', 'toothpaste', 'floss'],
  pouch: ['toiletry', 'toiletries', 'washbag', 'makeup', 'make-up'],
  bottle: ['shampoo', 'conditioner', 'soap', 'body wash', 'deodorant', 'lotion', 'moisturi', 'perfume', 'cologne', 'sanitiser', 'sanitizer'],
  tube: ['sunscreen', 'sunblock', 'lip', 'cream', 'toothpaste tube'],
  towel: ['towel'],
  pill: ['medication', 'medicine', 'pill', 'vitamin', 'paracetamol', 'panadol', 'ibuprofen', 'painkiller', 'prescription'],
  firstaid: ['first aid', 'first-aid', 'bandage', 'plaster', 'medkit'],
  spray: ['repellent', 'spray', 'mosquito'],
  wallet: ['wallet', 'purse', 'bank card', 'credit card'],
  keys: ['key', 'keys'],
  cash: ['cash', 'money', 'currency'],
  sunglasses: ['sunglasses', 'glasses', 'shades'],
  backpack: ['backpack', 'daypack', 'bag', 'luggage', 'tote'],
  snack: ['snack', 'food', 'granola'],
  umbrella: ['umbrella'],
  card: ['transit', 'metro', 'card', 'pass'],
  goggles: ['goggles'],
  waterbottle: ['bottle', 'flask', 'water'],
  book: ['book', 'notebook', 'journal', 'novel'],
  pillow: ['pillow', 'cushion', 'blanket'],
}
const WORD_HINTS = Object.entries(WORD_SHAPES)
  .flatMap(([shape, words]) => words.map((word) => ({ word, shape })))
  .sort((a, b) => b.word.length - a.word.length)

const CATEGORY_SHAPES = {
  Documents: 'document', Clothing: 'tshirt', Electronics: 'charger',
  Toiletries: 'bottle', Health: 'pill', Essentials: 'backpack',
}

/** Shape name for a checklist item: catalogue key first, then words in its name, then its category. */
export function shapeFor(item) {
  if (item?.suggestionKey && KEY_SHAPES[item.suggestionKey]) return KEY_SHAPES[item.suggestionKey]
  const text = ' ' + String(item?.name ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' '
  const hit = WORD_HINTS.find((h) => text.includes(' ' + h.word))
  return hit?.shape ?? CATEGORY_SHAPES[item?.category] ?? 'backpack'
}

// Soft tints that read well on the dark theme, one per category.
export const CATEGORY_TINTS = {
  Documents: '#b9ddd2',
  Clothing: '#9ec5e8',
  Electronics: '#c9b8f0',
  Toiletries: '#f2c879',
  Health: '#f0a597',
  Essentials: '#a8d5a2',
}

export { KEY_SHAPES }
