// Decorative themes. Seasonal snow/petals are atmosphere, not a weather prediction.
export function itineraryAtmosphere(trip, date, weather) {
  const city = trip.place?.split(',')[0] || trip.name || 'your destination'
  const month = Number(date?.slice(5, 7))
  const latitude = trip.latitude ?? 0
  const country = trip.place?.split(',').at(-1)?.trim() || ''
  const region = country === 'Japan' ? 'japan' : country === 'France' ? 'france' : 'world'
  const theme = (effect, label, source = 'seasonal') => ({ effect, label, source, region, city })
  if (weather?.kind === 'forecast' && weather.codes?.length) {
    const codes = weather.codes
    if (codes.some(code => [95, 96, 99].includes(code))) return theme('rain', `Stormy skies in ${city}`, 'forecast')
    if (codes.some(code => [71, 73, 75, 77, 85, 86].includes(code))) return theme('snow', `Snow in ${city}`, 'forecast')
    if (codes.some(code => [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))) return theme('rain', `Rain in ${city}`, 'forecast')
    if (codes.some(code => [1, 2, 3, 45, 48].includes(code))) return theme('clouds', `Soft skies over ${city}`, 'forecast')
    if (codes.includes(0)) return theme('sunshine', `Sunshine in ${city}`, 'forecast')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) return theme('clouds', `A little atmosphere for ${city}`)
  if (Math.abs(latitude) < 23.5) return theme('sunshine', `Tropical ${city}`)
  const northernSeason = Math.floor((month % 12) / 3)
  const season = (northernSeason + (latitude < 0 ? 2 : 0)) % 4
  if (season === 0) return theme(country === 'Japan' || (typeof weather?.low === 'number' && weather.low <= 0) ? 'snow' : 'frost', `Winter in ${city}`)
  if (season === 1) return theme('petals', `Spring in ${city}`)
  if (season === 2) return theme('sunshine', `Summer in ${city}`)
  return theme('leaves', `Autumn in ${city}`)
}
