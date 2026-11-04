// Which picture each checklist item gets. Pictures are Microsoft Fluent Emoji (Flat),
// stored in src/assets/checklist/items/ (MIT, see LICENSE.txt there).
// Pure data + one function (no Vite, no Vue) so it can be tested with node --test.

// Catalogue items -> picture file name (without .svg).
export const KEY_ART = {
  passport: 'identification_card', bookings: 'ticket', insurance: 'page_facing_up',
  'visa-docs': 'page_facing_up', 'doc-copies': 'page_facing_up',
  clothes: 't-shirt', sleepwear: 'womans_clothes', 'walking-shoes': 'running_shoe', swimwear: 'one-piece_swimsuit',
  sandals: 'thong_sandal', 'hiking-shoes': 'hiking_boot', 'rain-jacket': 'coat', 'warm-jacket': 'coat',
  thermals: 'scarf', 'gloves-beanie': 'gloves',
  'phone-charger': 'electric_plug', 'power-bank': 'battery', adapter: 'electric_plug',
  'travel-sim': 'mobile_phone', 'phone-pouch': 'mobile_phone',
  toothbrush: 'toothbrush', 'toiletry-bag': 'clutch_bag', towel: 'roll_of_paper', 'lip-balm': 'lipstick',
  medication: 'pill', 'first-aid': 'adhesive_bandage', sunscreen: 'lotion_bottle', 'insect-repellent': 'lotion_bottle',
  wallet: 'purse', 'house-keys': 'key', 'water-bottle': 'cup_with_straw', 'local-cash': 'dollar_banknote',
  sunglasses: 'sunglasses', daypack: 'backpack', snacks: 'chocolate_bar', umbrella: 'closed_umbrella',
  'transit-card': 'credit_card', goggles: 'goggles',
  'snow-boots': 'hiking_boot', 'ski-pants': 'jeans', 'waterproof-gloves': 'gloves', 'ski-goggles': 'goggles',
  'ski-gear': 'skis', 'hand-warmers': 'fire', 'lift-pass': 'ticket',
}

// Words in a typed item name -> picture. Matched at the start of a word; longest match wins.
const WORD_ART = {
  identification_card: ['passport', 'id card', 'identity', 'licence', 'license'],
  ticket: ['ticket', 'boarding pass', 'booking', 'reservation', 'flight'],
  page_facing_up: ['visa', 'insurance', 'document', 'copies', 'permit', 'itinerary', 'form'],
  't-shirt': ['shirt', 't-shirt', 'tee', 'top', 'clothes', 'outfit'],
  womans_clothes: ['blouse', 'pyjama', 'pajama', 'sleepwear'],
  jeans: ['jeans', 'pants', 'trousers', 'legging'],
  shorts: ['shorts', 'trunks'],
  dress: ['dress', 'skirt'],
  coat: ['jacket', 'coat', 'hoodie', 'sweater', 'jumper', 'cardigan', 'raincoat', 'fleece'],
  scarf: ['scarf', 'thermal'],
  gloves: ['glove', 'beanie'],
  socks: ['sock', 'underwear'],
  billed_cap: ['cap', 'hat'],
  running_shoe: ['shoe', 'sneaker', 'trainer'],
  hiking_boot: ['boot', 'hiking'],
  thong_sandal: ['sandal', 'flip-flop', 'slipper'],
  'one-piece_swimsuit': ['swimsuit', 'swimwear', 'swim'],
  bikini: ['bikini'],
  electric_plug: ['charger', 'cable', 'usb', 'plug', 'adapter', 'adaptor'],
  battery: ['power bank', 'powerbank', 'battery'],
  mobile_phone: ['phone', 'sim', 'esim'],
  laptop: ['laptop', 'ipad', 'tablet', 'kindle', 'e-reader', 'macbook'],
  camera: ['camera', 'gopro', 'drone'],
  headphone: ['headphone', 'earphone', 'earbud', 'airpods'],
  toothbrush: ['toothbrush', 'toothpaste', 'floss'],
  lotion_bottle: ['sunscreen', 'sunblock', 'lotion', 'shampoo', 'conditioner', 'moisturi', 'repellent', 'sanitiser', 'sanitizer', 'deodorant'],
  soap: ['soap', 'body wash'],
  clutch_bag: ['toiletry', 'toiletries', 'washbag', 'makeup', 'make-up'],
  lipstick: ['lip', 'lipstick'],
  roll_of_paper: ['towel', 'tissue', 'wipes'],
  pill: ['medication', 'medicine', 'pill', 'vitamin', 'paracetamol', 'panadol', 'ibuprofen', 'painkiller', 'prescription'],
  adhesive_bandage: ['first aid', 'first-aid', 'bandage', 'plaster'],
  purse: ['wallet', 'purse'],
  key: ['key', 'keys'],
  cup_with_straw: ['bottle', 'flask', 'water'],
  dollar_banknote: ['cash', 'money', 'currency'],
  credit_card: ['card', 'transit', 'metro'],
  sunglasses: ['sunglasses', 'glasses', 'shades'],
  goggles: ['goggles'],
  skis: ['ski', 'skis', 'snowboard'],
  fire: ['hand warmer', 'heat pack'],
  backpack: ['backpack', 'daypack', 'bag', 'luggage'],
  handbag: ['handbag', 'tote'],
  chocolate_bar: ['snack', 'chocolate', 'food', 'granola'],
  closed_umbrella: ['umbrella'],
  books: ['book', 'notebook', 'journal', 'novel'],
}
const WORD_HINTS = Object.entries(WORD_ART)
  .flatMap(([art, words]) => words.map((word) => ({ word, art })))
  .sort((a, b) => b.word.length - a.word.length)

const CATEGORY_ART = {
  Documents: 'page_facing_up', Clothing: 't-shirt', Electronics: 'electric_plug',
  Toiletries: 'lotion_bottle', Health: 'pill', Essentials: 'backpack',
}

/** Picture name for a checklist item: catalogue key first, then words in its name, then its category. */
export function artFor(item) {
  if (item?.suggestionKey && KEY_ART[item.suggestionKey]) return KEY_ART[item.suggestionKey]
  const text = ' ' + String(item?.name ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' '
  const hit = WORD_HINTS.find((h) => text.includes(' ' + h.word))
  return hit?.art ?? CATEGORY_ART[item?.category] ?? 'backpack'
}

/** Every picture name the app can ask for (used by the test to check the files exist). */
export const ALL_ART = [...new Set([...Object.values(KEY_ART), ...Object.keys(WORD_ART), ...Object.values(CATEGORY_ART)])]
