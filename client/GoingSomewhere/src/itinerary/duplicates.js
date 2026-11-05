// "Is this activity already planned on another day?" Used when adding an activity, to offer
// moving the existing one instead of adding a second copy.

/** 'Gardens  by the Bay ' and 'gardens by the bay' count as the same title. */
export const normalizeTitle = (title) => String(title ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const isSame = (item, title, placeId) =>
  (placeId && item.placeId === placeId) || (title && normalizeTitle(item.title) === title)

/**
 * Activities in the trip that are the same as the draft but on a different day, earliest first.
 *   items  the trip's activities
 *   draft  { title, placeId?, date }
 * The same activity means the same suggested place (placeId), or the same title. Other days only:
 * two copies on one day show up as a time clash instead.
 */
export function findSameActivity(items, draft) {
  const title = normalizeTitle(draft?.title)
  const placeId = typeof draft?.placeId === 'string' ? draft.placeId : ''
  if (!title && !placeId) return []
  return items
    .filter((i) => i.date !== draft.date)
    .filter((i) => isSame(i, title, placeId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

/**
 * Activities already on the draft's own day that are the same activity (same suggested place, or same title).
 * A day cannot have the same activity twice. options.ignoreId is the activity being edited, so it does not match itself.
 */
export function findSameDayActivity(items, draft, { ignoreId } = {}) {
  const title = normalizeTitle(draft?.title)
  const placeId = typeof draft?.placeId === 'string' ? draft.placeId : ''
  if (!draft?.date || (!title && !placeId)) return []
  return items
    .filter((i) => i.date === draft.date && String(i._id) !== String(ignoreId ?? ''))
    .filter((i) => isSame(i, title, placeId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
