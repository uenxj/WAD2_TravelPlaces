// Dates are plain 'YYYY-MM-DD' strings everywhere in the itinerary.

/** Today's date in the user's own timezone. (toISOString() gives the UTC date, still "yesterday" early in the morning in Asia.) */
export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// UTC avoids timezone off-by-one bugs: 'YYYY-MM-DD' is a calendar date, not a moment.
const utc = (date) => new Date(`${date}T00:00:00Z`)

/** Every day of a trip, start to end: [{ date, label: 'Sat, 7 Nov' }]. */
export function tripDays(trip) {
  const days = []
  const d = utc(trip.startDate)
  const end = utc(trip.endDate)
  while (d <= end) {
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

/** '7 Nov 2026' */
export function longDate(date) {
  return utc(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** '7 Nov – 9 Nov 2026', or just '7 Nov 2026' for a one-day trip. */
export function dateRange(startDate, endDate) {
  if (startDate === endDate) return longDate(startDate)
  const short = utc(startDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${short} – ${longDate(endDate)}`
}
