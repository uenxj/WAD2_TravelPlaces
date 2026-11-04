// Metadata-driven packing recommendations.
//
// How it works (no per-activity if/else):
//   1. Every catalogue item declares the situations it is for, as tag weights in ITEMS[key].needs,
//      e.g. sunscreen: { beach: 3, hot: 3, ski: 2 }   (3 = core, 2 = recommended, 1 = nice to have)
//   2. The trip's real context is turned into SIGNALS: { tag, reason }
//        - trip types the user picks        (catalog.js TRIP_TYPES[].tags)
//        - destination / weather             (from teammates' features once they exist, as { tag, reason })
//        - itinerary activities             (activitySignals below; uses the activity's own tags/type
//                                             when the itinerary provides them, else words in its title)
//   3. recommend() scores each item = sum over matched tags of (weight × evidence), ranks by score,
//      keeps one entry per item, and lists every reason that contributed.
// Supporting a new activity or item means adding data (a tag word, an item's needs), not new logic.
// See RECOMMENDATIONS.md for the tag list and the itinerary data the engine expects.

import { ITEMS } from './catalog.js'

// The shared vocabulary. Items, trip types, backups and activities (and later destination/weather) use these tags.
//   situations: abroad, cold, snow, rain, hot, beach, swim, hike, ski, city
//   backups (things that can go wrong on any trip): battery, unwell, cash, lost-docs
export const TAGS = ['abroad', 'cold', 'snow', 'rain', 'hot', 'beach', 'swim', 'hike', 'ski', 'city',
  'battery', 'unwell', 'cash', 'lost-docs']

// Backups count for less than what the trip itself needs, so they rank below it.
const BACKUP_STRENGTH = 0.5

/**
 * Signals for "what if…?" backups (catalog.js BACKUPS). A backup with `when` only applies if the
 * trip already has all of those tags (e.g. "lose your passport" only when going abroad).
 */
export function backupSignals(backups, signals) {
  const present = new Set(signals.map((s) => s.tag))
  return backups
    .filter((b) => (b.when ?? []).every((t) => present.has(t)))
    .map((b) => ({ tag: b.tag, reason: b.reason, strength: BACKUP_STRENGTH, backup: true }))
}

// Words that reveal a tag in a free-text activity title. Data only: add words here to support more activities.
export const TAG_WORDS = {
  beach: ['beach', 'island', 'snorkel', 'sentosa', 'coast', 'surf', 'dive', 'diving'],
  swim: ['swim', 'pool', 'water park', 'waterpark', 'hot spring', 'onsen', 'snorkel', 'dive', 'diving'],
  hike: ['hike', 'hiking', 'trek', 'trail', 'mountain', 'national park', 'nature reserve', 'waterfall', 'volcano'],
  ski: ['ski', 'snowboard', 'snowshoe', 'sledding'],
  snow: ['snow', 'glacier', 'ice skating', 'northern lights', 'aurora'],
  city: ['city tour', 'museum', 'shopping', 'sightseeing', 'walking tour', 'temple', 'shrine', 'market', 'gallery'],
}

// A tag word matches at the start of a word: "ski" matches "Skiing in Niseko", not "Kiski".
const normalise = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const hasWord = (text, word) => (' ' + normalise(text) + ' ').includes(' ' + normalise(word))

/**
 * Tags for one itinerary activity. Structured data wins: if the itinerary gives `tags` or a `type`
 * from TAGS, those are used as they are. Otherwise the title is scanned for TAG_WORDS.
 */
export function tagActivity(activity) {
  const given = [...(activity?.tags ?? []), activity?.type].filter((t) => TAGS.includes(t))
  if (given.length) return [...new Set(given)]
  const title = activity?.title ?? ''
  return Object.entries(TAG_WORDS).filter(([, list]) => list.some((w) => hasWord(title, w))).map(([tag]) => tag)
}

/** Signals from itinerary activities: [{ tag, reason }]. */
export function activitySignals(activities = []) {
  const out = []
  for (const a of activities) {
    const title = String(a?.title ?? '').trim()
    if (!title) continue
    const when = a?.date ? ` on ${a.date}` : ''
    for (const tag of tagActivity(a)) out.push({ tag, reason: `Itinerary: “${title}”${when}` })
  }
  return out
}

const LEVELS = [
  [6, 'Top pick'],
  [3, 'Recommended'],
  [0, 'Nice to have'],
]

/**
 * Rank catalogue items against the trip's signals.
 *   signals: [{ tag, reason, strength?, backup? }]   strength defaults to 1
 * Returns [{ key, name, category, priority, score, level, reasons[], reason, backupOnly }] sorted by
 * score, one entry per item. More independent evidence for a tag (e.g. the user picked "Snow & ski"
 * AND the itinerary has skiing) makes it count a little more, up to 1.5×. `backupOnly` is true when
 * the item is suggested only as a "what if" backup.
 */
export function recommend(signals = []) {
  // tag -> { evidence, strength, reasons[], backupOnly }
  const byTag = new Map()
  for (const s of signals) {
    if (!TAGS.includes(s.tag)) continue
    const entry = byTag.get(s.tag) ?? { evidence: 0, strength: 0, reasons: [], backupOnly: true }
    if (!entry.reasons.includes(s.reason)) {
      entry.reasons.push(s.reason)
      entry.evidence += 1
    }
    entry.strength = Math.max(entry.strength, s.strength ?? 1)
    if (!s.backup) entry.backupOnly = false
    byTag.set(s.tag, entry)
  }

  const results = []
  for (const [key, item] of Object.entries(ITEMS)) {
    let score = 0
    let backupOnly = true
    const reasons = []
    for (const [tag, weight] of Object.entries(item.needs ?? {})) {
      const entry = byTag.get(tag)
      if (!entry) continue
      score += weight * entry.strength * Math.min(1 + 0.25 * (entry.evidence - 1), 1.5)
      if (!entry.backupOnly) backupOnly = false
      for (const r of entry.reasons) if (!reasons.includes(r)) reasons.push(r)
    }
    if (score <= 0) continue
    if (item.priority === 'essential') score += 0.5 // tie-break: essentials first
    const rounded = Math.round(score * 10) / 10
    results.push({
      key,
      name: item.name,
      category: item.category,
      priority: item.priority,
      score: rounded,
      level: LEVELS.find(([min]) => rounded >= min)[1],
      reasons,
      reason: reasons.join(' · '),
      backupOnly,
    })
  }
  return results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
