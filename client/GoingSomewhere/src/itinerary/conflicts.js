// Live clash check for the activity form: runs in the browser while someone is still choosing a day and time,
// against the activities already loaded for the trip (everyone's, not just their own).
// The server still checks again when the activity is saved (server/src/itinerary/itineraryLogic.js), so this is an
// early warning only and never blocks saving.

export const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + m
}

const isTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))

/** 'HH:MM' plus some minutes, capped at 23:59. */
export function addMinutes(time, minutes) {
  const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Which saved activities does this draft clash with?
 *   items   the trip's activities (each with date, startTime, endTime, title, createdBy, createdByName)
 *   draft   { date, startTime, endTime }
 *   options { ignoreId }        the activity being edited, so it does not clash with itself
 *           { currentUserId }   to say "added by <name>" for other people's activities
 * While the end time is not after the start yet (e.g. the person has only picked a start time), the draft is treated
 * as that single moment, so choosing a start time inside an existing activity warns straight away.
 * Returns [{ itemId, title, startTime, endTime, addedBy, message }] in time order.
 */
export function liveConflicts(items, draft, { ignoreId, currentUserId } = {}) {
  if (!draft?.date || !isTime(draft.startTime)) return []
  const start = toMinutes(draft.startTime)
  const range = isTime(draft.endTime) && toMinutes(draft.endTime) > start
  const end = range ? toMinutes(draft.endTime) : start

  return items
    .filter((i) => i.date === draft.date && String(i._id) !== String(ignoreId ?? ''))
    .filter((i) => {
      const s = toMinutes(i.startTime)
      const e = toMinutes(i.endTime)
      return range ? start < e && s < end : s <= start && start < e
    })
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    .map((i) => {
      const other = currentUserId != null && i.createdBy !== currentUserId
      const addedBy = other ? i.createdByName || 'another traveller' : ''
      return {
        itemId: String(i._id),
        title: i.title,
        startTime: i.startTime,
        endTime: i.endTime,
        addedBy,
        message: `Overlaps with "${i.title}" (${i.startTime}-${i.endTime})${addedBy ? `, added by ${addedBy}` : ''}.`,
      }
    })
}
