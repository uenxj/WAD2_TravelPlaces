// Turns an itinerary activity from the API into the object the weather module (src/weather, ActivityConditions.vue)
// reads: { id, name, latitude, longitude, date, startTime, endTime, timezone, environment }.

// The itinerary stores 'indoor' | 'outdoor' | 'both'; the weather module calls the last one 'mixed'.
const ENVIRONMENT = { indoor: 'indoor', outdoor: 'outdoor', both: 'mixed' }

export const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', both: 'Indoor & Outdoor' }
export const TYPE_LABELS = { place: 'Place', event: 'Event', transport: 'Transport', custom: 'Custom' }

/**
 * item.weather is worked out by the server (coordinates of the activity, or the trip's destination centre,
 * plus the destination timezone). Returns null when there is nothing to look up, so callers skip that activity.
 */
export function toConditionsActivity(item) {
  const w = item?.weather
  if (!w?.coordinates || !w.timezone) return null
  return {
    id: item._id,
    name: item.title,
    latitude: w.coordinates.lat,
    longitude: w.coordinates.lng,
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
    timezone: w.timezone,
    environment: ENVIRONMENT[item.setting] ?? 'indoor',
  }
}
