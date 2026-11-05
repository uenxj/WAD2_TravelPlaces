// "Is this activity already in the trip under the same name?" Used when adding an activity:
//   - on another day it offers to move the existing one instead of adding a second copy
//   - on the same day it is not allowed
// Only the NAME decides. Two activities are the same when their names match (ignoring capitals and extra spaces), so
// giving something a different name always makes it a separate activity, even when it came from the same suggested place.

/** 'Gardens  by the Bay ' and 'gardens by the bay' count as the same title. */
export const normalizeTitle = (title) => String(title ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Activities in the trip with the draft's name on a different day, earliest first.
 *   items  the trip's activities
 *   draft  { title, date }
 */
export function findSameActivity(items, draft) {
  const title = normalizeTitle(draft?.title)
  if (!title) return []
  return items
    .filter((i) => i.date !== draft.date && normalizeTitle(i.title) === title)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

/**
 * Activities already on the draft's own day with the same name. A day cannot have two activities with the same name.
 * options.ignoreId is the activity being edited, so it does not match itself.
 */
export function findSameDayActivity(items, draft, { ignoreId } = {}) {
  const title = normalizeTitle(draft?.title)
  if (!draft?.date || !title) return []
  return items
    .filter((i) => i.date === draft.date && String(i._id) !== String(ignoreId ?? '') && normalizeTitle(i.title) === title)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
