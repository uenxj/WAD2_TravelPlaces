/**
 * Who may use a trip's data (its checklist and its budget).
 *
 * A real trip (one from the itinerary planner) is only for that trip's members. Other ids,
 * such as the sample trips (preview-…) and demo-trip, are not in the trip store and stay open.
 *
 * Returns access(req, tripId), which resolves to null when allowed, otherwise to
 * { status, error }: 401 when nobody is signed in, 403 when the user is not in the trip.
 *
 * `trips` is the itinerary store's trips ({ get(id) }); `authenticate(req)` resolves to the
 * signed-in user or null.
 */
function createTripAccess({ trips, authenticate }) {
  return async function tripAccess(req, tripId) {
    const trip = await trips.get(tripId);
    if (!trip) return null;
    const user = await authenticate(req);
    if (!user) return { status: 401, error: 'Please log in to continue' };
    if (!trip.memberIds.includes(user.id)) return { status: 403, error: 'You are not in this trip.' };
    return null;
  };
}

module.exports = { createTripAccess };
