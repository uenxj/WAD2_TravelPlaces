// "Is this activity already planned on another day?" Used when adding an activity, to offer
// moving the existing one instead of adding a second copy.

/** 'Gardens  by the Bay ' and 'gardens by the bay' count as the same title. */
export const normalizeTitle = (title) => String(title ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

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
    .filter((i) => (placeId && i.placeId === placeId) || (title && normalizeTitle(i.title) === title))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}
