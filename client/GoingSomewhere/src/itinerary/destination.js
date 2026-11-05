export function destinationLabel(place) {
  if (place.label) return place.label
  const parts = [place.name, place.region, place.country].filter(Boolean)
  return parts.filter((part, i) => parts.findIndex(value => value.toLowerCase() === part.toLowerCase()) === i).join(', ')
}

export function destinationSelection(place) {
  return { label: destinationLabel(place), latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, scope: place.scope === 'country' ? 'country' : 'place' }
}

export function selectionFromTrip(trip) {
  if (!trip.center || !trip.timezone) return null
  return { label: trip.destination, latitude: trip.center.lat, longitude: trip.center.lng, timezone: trip.timezone, scope: trip.destinationScope === 'country' ? 'country' : 'place' }
}
