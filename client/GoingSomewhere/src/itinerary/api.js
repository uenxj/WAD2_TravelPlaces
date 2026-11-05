// Small client for the itinerary API (server/src/itinerary/itineraryRoutes.js).
// The session lives in an HttpOnly cookie that the browser sends by itself, so no token is handled here.
import { setAuthenticatedUser } from '../services/auth.js'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and that the API is running.', 0)
  }
  if (res.status === 204) return null

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // The session ended (expired, or logged out in another tab): this tab is signed out too.
    if (res.status === 401) setAuthenticatedUser(null)
    // No JSON body on a 5xx usually means the Vite proxy could not reach the API server.
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status)
  }
  return data
}

export const itineraryApi = {
  listTrips: () => request('/trips'),
  createTrip: (trip) => request('/trips', { method: 'POST', body: trip }),
  getTrip: (tripId) => request(`/trips/${encodeURIComponent(tripId)}`),
  resolveTripLocation: (tripId) => request(`/trips/${encodeURIComponent(tripId)}/location`, { method: 'POST' }),
  updateTrip: (tripId, trip) => request(`/trips/${encodeURIComponent(tripId)}`, { method: 'PUT', body: trip }),
  deleteTrip: (tripId) => request(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' }),
  addMember: (tripId, email) => request(`/trips/${encodeURIComponent(tripId)}/members`, { method: 'POST', body: { email } }),

  listItems: (tripId) => request(`/trips/${encodeURIComponent(tripId)}/items`),
  createItem: (tripId, item) => request(`/trips/${encodeURIComponent(tripId)}/items`, { method: 'POST', body: item }),
  updateItem: (itemId, item) => request(`/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: item }),
  deleteItem: (itemId) => request(`/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),

  topPlaces: (destination) => request(`/places?destination=${encodeURIComponent(destination)}`),
}
