// Small client for the checklist API (server/src/checklist/checklistRoutes.js).

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
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and that the API is running.', 0)
  }
  if (res.status === 204) return null

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // No JSON body on a 5xx usually means the Vite proxy could not reach the API server.
    if (!data && res.status >= 500) {
      throw new ApiError('The checklist server is not responding. Is it running on port 3000?', res.status)
    }
    const detail = data?.details?.length ? ': ' + data.details.join('; ') : ''
    throw new ApiError((data?.error || `Request failed (${res.status})`) + detail, res.status)
  }
  return data
}

const trip = (tripId) => `/trips/${encodeURIComponent(tripId)}/checklist`

export const checklistApi = {
  list: (tripId) => request(trip(tripId)),
  add: (tripId, item) => request(trip(tripId), { method: 'POST', body: item }),
  addMany: (tripId, items) => request(trip(tripId) + '/batch', { method: 'POST', body: { items } }),
  update: (id, patch) => request(`/checklist/${id}`, { method: 'PATCH', body: patch }),
  remove: (id) => request(`/checklist/${id}`, { method: 'DELETE' }),
}
