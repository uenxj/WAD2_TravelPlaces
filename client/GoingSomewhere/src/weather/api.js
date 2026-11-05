import { activityHours, daysAhead, expectedHours, isNumber, maximum, minimum, validateActivity } from './conditions.js'

const cache = new Map()
const MINUTE = 60_000
// Share in-flight requests and retain successful data only for a bounded interval.
async function request(base, params, ttl = 30 * MINUTE, refresh = false) {
  const url = `${base}?${new URLSearchParams(params)}`
  const existing = cache.get(url)
  if (!refresh && existing && existing.expires > Date.now()) return existing.promise
  const promise = (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error('Conditions service is temporarily unavailable. Please retry.')
    const data = await response.json()
    if (data.error) throw new Error('Conditions are unavailable for this location or date.')
    return { data, fetchedAt: new Date().toISOString() }
  })()
  cache.set(url, { promise, expires: Date.now() + ttl })
  if (cache.size > 80) cache.delete(cache.keys().next().value)
  try { return await promise } catch (error) { if (cache.get(url)?.promise === promise) cache.delete(url); throw error }
}

const coordinates = activity => ({ latitude: activity.latitude, longitude: activity.longitude, timezone: activity.timezone })
const unavailable = message => ({ kind: 'unavailable', message })

export const isSingapore = activity => activity.countryCode === 'SG' || activity.country === 'Singapore' || (activity.timezone === 'Asia/Singapore' && activity.latitude >= 1.15 && activity.latitude <= 1.48 && activity.longitude >= 103.6 && activity.longitude <= 104.1)

export function parsePsi(data, activity, now = new Date()) {
  const item = [...(data.data?.items ?? [])].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]
  const observedAt = item?.timestamp
  const age = now.getTime() - Date.parse(observedAt)
  if (!Number.isFinite(age) || age < -5 * MINUTE || age > 120 * MINUTE) return unavailable('A recent Singapore PSI observation is not available.')
  const regions = (data.data?.regionMetadata ?? []).filter(region =>
    isNumber(region.labelLocation?.latitude) && isNumber(region.labelLocation?.longitude))
  const closest = regions.sort((a, b) => {
    const distance = region => Math.hypot(activity.latitude - region.labelLocation.latitude, activity.longitude - region.labelLocation.longitude)
    return distance(a) - distance(b)
  })[0]
  const value = item.readings?.psi_twenty_four_hourly?.[closest?.name]
  if (!isNumber(value) || value < 0) return unavailable('Singapore PSI is unavailable for this region.')
  return { kind: 'observation', value, region: closest.name, observedAt }
}

async function psiFor(activity, ahead, now, refresh) {
  if (!isSingapore(activity)) return { kind: 'not-applicable' }
  if (ahead !== 0) return unavailable('Singapore PSI is an observation, not a forecast for this date.')
  const { data } = await request('https://api-open.data.gov.sg/v2/real-time/api/psi', {}, 10 * MINUTE, refresh)
  return parsePsi(data, activity, now)
}

export async function searchLocations(name) {
  if (name.trim().length < 2) return []
  const { data } = await request('https://geocoding-api.open-meteo.com/v1/search', { name: name.trim(), count: 6, language: 'en', format: 'json' }, 24 * 60 * MINUTE)
  return (data.results ?? []).filter(location => location.timezone && isNumber(location.latitude) && Math.abs(location.latitude) <= 90 && isNumber(location.longitude) && Math.abs(location.longitude) <= 180).map(location => ({
    id: location.id, name: location.name, region: location.admin1, country: location.country,
    latitude: location.latitude, longitude: location.longitude, timezone: location.timezone,
    scope: /^PCL/.test(location.feature_code || '') ? 'country' : 'place',
  }))
}

export async function getCurrentTemperature(destination) {
  const { data } = await request('https://api.open-meteo.com/v1/forecast', {
    latitude: destination.lat, longitude: destination.lng, current: 'temperature_2m',
  })
  if (!isNumber(data.current?.temperature_2m)) throw new Error('Current temperature is unavailable.')
  return `${Math.round(data.current.temperature_2m)}${data.current_units?.temperature_2m ?? '°C'}`
}

export function summariseSeason(daily, month, startYear, endYear) {
  const indices = (daily?.time ?? []).flatMap((date, index) => Number(date.slice(5, 7)) === month ? [index] : [])
  // Require complete values for a day and at least 20 days from every sample year.
  const valid = indices.filter(i => ['temperature_2m_min', 'temperature_2m_max', 'precipitation_sum'].every(key => isNumber(daily[key]?.[i])))
  for (let year = startYear; year <= endYear; year++) {
    if (valid.filter(i => Number(daily.time[i].slice(0, 4)) === year).length < 20) return unavailable('Not enough historical data to estimate this season.')
  }
  const mean = key => valid.reduce((sum, i) => sum + daily[key][i], 0) / valid.length
  return {
    kind: 'seasonal', low: mean('temperature_2m_min'), high: mean('temperature_2m_max'),
    wetDayPercent: valid.filter(i => daily.precipitation_sum[i] >= 1).length / valid.length * 100,
    startYear, endYear, sampleDays: valid.length,
  }
}

// A historical local-hour profile gives advance activities a timing-specific range.
// Keep missing hours unavailable instead of interpolating a made-up forecast.
export function typicalSlot(hourly, activity, startYear, endYear) {
  const samples = new Map()
  const slots = activityHours({ time: Array.from({ length: 24 }, (_, hour) => `${activity.date}T${String(hour).padStart(2, '0')}:00`) }, activity)
  for (const hour of slots) samples.set(hour, [])
  for (let i = 0; i < (hourly?.time?.length ?? 0); i++) {
    const time = hourly.time[i]
    const hour = Number(time.slice(11, 13))
    if (time.slice(5, 7) !== activity.date.slice(5, 7) || !samples.has(hour) || !isNumber(hourly.temperature_2m?.[i])) continue
    samples.get(hour).push({ year: Number(time.slice(0, 4)), value: hourly.temperature_2m[i] })
  }
  const means = []
  for (const values of samples.values()) {
    for (let year = startYear; year <= endYear; year++) {
      if (values.filter(sample => sample.year === year).length < 20) return { slotLow: null, slotHigh: null }
    }
    means.push(values.reduce((sum, sample) => sum + sample.value, 0) / values.length)
  }
  return { slotLow: minimum(means), slotHigh: maximum(means) }
}

async function weatherFor(activity, ahead, now, refresh) {
  if (ahead < 0) return unavailable('This activity is in the past. Choose today or a future date.')
  if (ahead > 15) {
    const endYear = Number(new Intl.DateTimeFormat('en', { timeZone: activity.timezone, year: 'numeric' }).format(now)) - 1
    const startYear = endYear - 9
    const { data, fetchedAt } = await request('https://archive-api.open-meteo.com/v1/archive', {
      ...coordinates(activity), start_date: `${startYear}-01-01`, end_date: `${endYear}-12-31`,
      daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum', hourly: 'temperature_2m', models: 'era5',
    }, 24 * 60 * MINUTE, refresh)
    return { ...summariseSeason(data.daily, Number(activity.date.slice(5, 7)), startYear, endYear), ...typicalSlot(data.hourly, activity, startYear, endYear), fetchedAt }
  }
  const { data, fetchedAt } = await request('https://api.open-meteo.com/v1/forecast', {
    ...coordinates(activity), start_date: activity.date, end_date: activity.date,
    daily: 'temperature_2m_min,temperature_2m_max',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
  }, 30 * MINUTE, refresh)
  const hours = activityHours(data.hourly, activity)
  const values = key => hours.map(i => data.hourly[key]?.[i])
  if (!hours.length || !values('temperature_2m').some(isNumber)) return unavailable('Weather forecast is not available for this time slot yet.')
  return {
    kind: 'forecast', low: data.daily?.temperature_2m_min?.[0] ?? null, high: data.daily?.temperature_2m_max?.[0] ?? null,
    slotLow: minimum(values('temperature_2m')), slotHigh: maximum(values('temperature_2m')),
    feelsLow: minimum(values('apparent_temperature')), feelsHigh: maximum(values('apparent_temperature')),
    precipitationChance: maximum(values('precipitation_probability')), wind: maximum(values('wind_speed_10m')),
    codes: values('weather_code').filter(isNumber), fetchedAt,
    partial: hours.length !== expectedHours(activity) || ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'weather_code', 'wind_speed_10m'].some(key => values(key).some(v => !isNumber(v))),
  }
}

async function airFor(activity, ahead, refresh) {
  if (ahead < 0) return unavailable('Air quality checks are available for today and upcoming activities.')
  if (ahead > 6) return unavailable('Air quality forecast not available yet. Check again within 7 days of this activity; coverage varies by location.')
  const { data, fetchedAt } = await request('https://air-quality-api.open-meteo.com/v1/air-quality', {
    ...coordinates(activity), forecast_days: 7, hourly: 'us_aqi,pm2_5,pm10',
  }, 15 * MINUTE, refresh)
  const hours = activityHours(data.hourly, activity)
  const values = key => hours.map(i => data.hourly[key]?.[i]).filter(v => isNumber(v) && v >= 0)
  const aqi = maximum(values('us_aqi'))
  if (!isNumber(aqi)) return unavailable('Air quality forecast not available for this time slot. Regional coverage may be shorter than 7 days.')
  return { kind: 'forecast', aqi, pm25: maximum(values('pm2_5')), pm10: maximum(values('pm10')), fetchedAt,
    partial: values('us_aqi').length !== hours.length || hours.length !== expectedHours(activity) }
}

export async function getActivityConditions(activity, now = new Date(), { refresh = false } = {}) {
  validateActivity(activity)
  const ahead = daysAhead(activity, now)
  const [weather, air, psi] = await Promise.allSettled([weatherFor(activity, ahead, now, refresh), airFor(activity, ahead, refresh), psiFor(activity, ahead, now, refresh)])
  const result = value => value.status === 'fulfilled' ? value.value : ({ kind: 'error', message: 'Could not load conditions. Please retry.' })
  return { weather: result(weather), air: result(air), psi: result(psi) }
}
