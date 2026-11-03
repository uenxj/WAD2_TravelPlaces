// Planning hints, not official weather alerts. Units: °C, km/h, percent, US AQI.
export const PLANNING_THRESHOLDS = Object.freeze({ rain: 60, heat: 35, cold: 0, wind: 40 })
export const isNumber = value => typeof value === 'number' && Number.isFinite(value)
export const maximum = values => values.some(isNumber) ? Math.max(...values.filter(isNumber)) : null
export const minimum = values => values.some(isNumber) ? Math.min(...values.filter(isNumber)) : null

export function localDate(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = type => parts.find(p => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validateActivity(activity) {
  if (!isNumber(activity.latitude) || Math.abs(activity.latitude) > 90 || !isNumber(activity.longitude) || Math.abs(activity.longitude) > 180) throw new Error('Choose a location with valid coordinates.')
  const { date, startTime, endTime } = activity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid activity date.')
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '')
  if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) throw new Error('End time must be after start time on the same day. Split overnight activities across two days.')
  if (!['indoor', 'outdoor', 'mixed'].includes(activity.environment)) throw new Error('Choose indoor, outdoor, or mixed for this activity.')
  if (!activity.timezone) throw new Error('A destination timezone is required.')
  try { localDate(activity.timezone) } catch { throw new Error('Choose a location with a valid timezone.') }
}

export function daysAhead(activity, now = new Date()) {
  return Math.round((Date.parse(activity.date) - Date.parse(localDate(activity.timezone, now))) / 86400000)
}

// Include each hourly interval overlapping the local activity, with end exclusive.
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
export const expectedHours = activity => Math.ceil(minutes(activity.endTime) / 60) - Math.floor(minutes(activity.startTime) / 60)
export function activityHours(hourly, activity) {
  const start = minutes(activity.startTime)
  const end = minutes(activity.endTime)
  return (hourly?.time ?? []).flatMap((time, index) => {
    const hour = minutes(time.slice(11, 16))
    return time.slice(0, 10) === activity.date && hour < end && hour + 60 > start ? [index] : []
  })
}

export function aqiCategory(value) {
  if (!isNumber(value) || value < 0) return 'Unavailable'
  if (value <= 50) return 'Good'
  if (value <= 100) return 'Moderate'
  if (value <= 150) return 'Unhealthy for sensitive groups'
  if (value <= 200) return 'Unhealthy'
  if (value <= 300) return 'Very unhealthy'
  return 'Hazardous'
}

export function psiCategory(value) {
  if (!isNumber(value) || value < 0) return 'Unavailable'
  if (value <= 50) return 'Good'
  if (value <= 100) return 'Moderate'
  if (value <= 200) return 'Unhealthy'
  if (value <= 300) return 'Very unhealthy'
  return 'Hazardous'
}

export function planningHints(activity, weather, air) {
  if (activity.environment === 'indoor') return []
  const hints = []
  const add = (title, text, level = 'caution') => hints.push({ title, text, level })
  if (weather?.kind === 'seasonal') {
    if (isNumber(weather.low) && weather.low <= 5) add('Cold mornings and evenings', 'Pack warm layers for early starts and evening walks.', 'info')
    if (isNumber(weather.high) && weather.high >= 30) add('Prepare for warm conditions', 'Historically warm afternoons in this month. Plan breaks and flexible outdoor time.', 'info')
    if (isNumber(weather.wetDayPercent) && weather.wetDayPercent >= 30) add('Keep an indoor alternative', 'Rain occurred on at least 30% of sampled days in this month.', 'info')
  }
  if (weather?.kind === 'forecast') {
    if (weather.codes?.some(code => code >= 95)) add('Thunderstorms forecast', 'Consider moving the outdoor activity or choosing an indoor alternative.', 'warning')
    if (isNumber(weather.precipitationChance) && weather.precipitationChance >= PLANNING_THRESHOLDS.rain) {
      const snow = weather.codes?.some(code => [71, 73, 75, 77, 85, 86].includes(code))
      const rain = weather.codes?.some(code => [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code))
      const type = snow ? (rain ? 'Rain or snow' : 'Snow') : rain ? 'Rain' : 'Precipitation'
      add(`${type} may affect this activity`, `Up to ${Math.round(weather.precipitationChance)}% precipitation probability during your time slot. Keep an indoor alternative.`)
    }
    if (isNumber(weather.feelsHigh) && weather.feelsHigh >= PLANNING_THRESHOLDS.heat) add('High apparent temperature', 'Feels-like temperature may reach 35°C or more. Consider a cooler time and plan breaks.')
    if (isNumber(weather.feelsLow) && weather.feelsLow <= PLANNING_THRESHOLDS.cold) add('Freezing conditions possible', 'Feels-like temperature may reach 0°C or below. Prepare warm clothing and check local conditions.')
    if (isNumber(weather.wind) && weather.wind >= PLANNING_THRESHOLDS.wind) add('Strong winds forecast', 'Winds may reach 40 km/h or more. Review exposed outdoor activities.')
  }
  if (isNumber(air?.aqi) && air.aqi > 100) {
    add('Poor air quality during this activity', `Peak US AQI ${Math.round(air.aqi)} · ${aqiCategory(air.aqi)}. Review outdoor plans and follow local air quality guidance.`, air.aqi > 150 ? 'warning' : 'caution')
  }
  return hints
}
