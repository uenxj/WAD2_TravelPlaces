// A short lookup from a trip's destination ("Tokyo, Japan", "Paris") to the currency the Budget
// Planner should suggest. Only common destinations; anything else returns null so the Budget page
// keeps its own default. Checked in order, so Hong Kong is found before China.
const CURRENCIES = [
  ['HKD', ['hong kong']],
  ['JPY', ['japan', 'tokyo', 'osaka', 'kyoto', 'sapporo', 'fukuoka']],
  ['KRW', ['south korea', 'korea', 'seoul', 'busan']],
  ['CNY', ['china', 'beijing', 'shanghai']],
  ['TWD', ['taiwan', 'taipei']],
  ['THB', ['thailand', 'bangkok', 'phuket', 'chiang mai']],
  ['MYR', ['malaysia', 'kuala lumpur', 'penang']],
  ['IDR', ['indonesia', 'bali', 'jakarta']],
  ['VND', ['vietnam', 'hanoi', 'ho chi minh']],
  ['PHP', ['philippines', 'manila']],
  ['INR', ['india', 'delhi', 'mumbai']],
  ['SGD', ['singapore']],
  ['AUD', ['australia', 'sydney', 'melbourne']],
  ['NZD', ['new zealand', 'auckland']],
  ['GBP', ['united kingdom', 'uk', 'england', 'scotland', 'london']],
  ['USD', ['united states', 'usa', 'new york', 'los angeles', 'san francisco']],
  ['CAD', ['canada', 'toronto', 'vancouver']],
  ['CHF', ['switzerland', 'zurich']],
  ['AED', ['united arab emirates', 'uae', 'dubai']],
  ['EUR', ['france', 'paris', 'germany', 'berlin', 'italy', 'rome', 'spain', 'madrid', 'barcelona',
    'netherlands', 'amsterdam', 'portugal', 'lisbon', 'austria', 'vienna', 'ireland', 'greece', 'finland']],
]

/** The currency code for a destination, or null when it is not a destination we know. */
export function currencyForDestination(destination) {
  const text = String(destination || '').toLowerCase()
  if (!text) return null
  const found = CURRENCIES.find(([, names]) => names.some((n) => new RegExp(`\\b${n}\\b`).test(text)))
  return found ? found[0] : null
}
