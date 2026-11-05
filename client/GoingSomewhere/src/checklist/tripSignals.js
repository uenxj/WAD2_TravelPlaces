// Destination and weather -> recommendation signals ({ tag, reason }), read from teammates' features:
//   - the trip (itinerary feature): destination, centre point, timezone, start and end dates
//   - the weather module (src/weather): a forecast for days up to about two weeks ahead, otherwise
//     the 10-year average for that month
// Like the rest of the engine, the rules are data: change a threshold here, not the logic.

import { getActivityConditions, isSingapore } from '../weather/api.js'
import { PLANNING_THRESHOLDS, daysAhead, isNumber } from '../weather/conditions.js'
import { tripDays } from '../itinerary/dates.js'

const MAX_DAYS = 14 // a long trip: look at its first two weeks
const SNOW_CODES = [71, 73, 75, 77, 85, 86] // WMO weather codes for snow

// One rule per tag. `forecast` / `seasonal` test one day's weather (as src/weather returns it).
export const WEATHER_RULES = [
  {
    tag: 'rain', what: 'rainy',
    forecast: (w) => w.precipitationChance >= PLANNING_THRESHOLDS.rain,
    seasonal: (w) => w.wetDayPercent >= 30,
  },
  {
    tag: 'hot', what: 'hot (30°C or more)',
    forecast: (w) => w.high >= 30,
    seasonal: (w) => w.high >= 30,
  },
  {
    tag: 'cold', what: 'cold (10°C or below)',
    forecast: (w) => isNumber(w.low) && w.low <= 10,
    seasonal: (w) => isNumber(w.low) && w.low <= 10,
  },
  {
    tag: 'snow', what: 'snowy',
    forecast: (w) => w.precipitationChance >= PLANNING_THRESHOLDS.rain && (w.codes ?? []).some((c) => SNOW_CODES.includes(c)),
  },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December']
const monthOf = (date) => MONTHS[Number(date.slice(5, 7)) - 1]

/**
 * Signals from the weather of each trip day: [{ date, weather }]. A forecast wins over the monthly
 * average; one signal per tag, with how many days it applies to.
 */
export function weatherSignals(days = []) {
  const forecastDays = days.filter((d) => d.weather?.kind === 'forecast')
  const seasonalDays = days.filter((d) => d.weather?.kind === 'seasonal')
  const out = []
  for (const rule of WEATHER_RULES) {
    const forecast = rule.forecast ? forecastDays.filter((d) => rule.forecast(d.weather)) : []
    if (forecast.length) {
      out.push({ tag: rule.tag, reason: `Forecast: ${rule.what} on ${forecast.length} of ${forecastDays.length} day${forecastDays.length === 1 ? '' : 's'}` })
      continue
    }
    const seasonal = rule.seasonal ? seasonalDays.filter((d) => rule.seasonal(d.weather)) : []
    if (seasonal.length) {
      const months = [...new Set(seasonal.map((d) => monthOf(d.date)))].join(' / ')
      out.push({ tag: rule.tag, reason: `Usually ${rule.what} in ${months} (10-year average)` })
    }
  }
  return out
}

// The destination was found on the map (the itinerary saves its centre point and timezone).
const located = (trip) => isNumber(trip?.center?.lat) && isNumber(trip?.center?.lng) && Boolean(trip.timezone)

/** Going abroad = a destination outside Singapore (the app is for travellers from Singapore). */
export function destinationSignals(trip) {
  if (!located(trip)) return []
  const place = { latitude: trip.center.lat, longitude: trip.center.lng, timezone: trip.timezone }
  return isSingapore(place) ? [] : [{ tag: 'abroad', reason: `Going abroad: ${trip.destination}` }]
}

/**
 * All destination and weather signals for a trip from the itinerary feature. Days that are past or
 * whose weather can't be loaded are skipped. Returns { signals, weatherDays } (days with weather).
 */
export async function tripSignals(trip, { now = new Date(), getConditions = getActivityConditions } = {}) {
  const signals = destinationSignals(trip)
  if (!located(trip)) return { signals, weatherDays: 0 }
  const c = trip.center

  // The whole day at the destination, like the itinerary's own day summary.
  const day = (date) => ({
    id: `checklist-${date}`, name: trip.destination, latitude: c.lat, longitude: c.lng,
    date, startTime: '00:00', endTime: '23:59', timezone: trip.timezone, environment: 'outdoor',
  })
  const dates = tripDays(trip).map((d) => d.date)
    .filter((date) => daysAhead(day(date), now) >= 0)
    .slice(0, MAX_DAYS)
  const days = await Promise.all(dates.map(async (date) => {
    try {
      return { date, weather: (await getConditions(day(date), now)).weather }
    } catch {
      return { date, weather: null }
    }
  }))
  const known = days.filter((d) => ['forecast', 'seasonal'].includes(d.weather?.kind))
  return { signals: [...signals, ...weatherSignals(known)], weatherDays: known.length }
}
