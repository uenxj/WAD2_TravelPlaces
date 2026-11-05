const express = require('express');
const logic = require('./itineraryLogic');
const { externalChecks } = require('./externalChecks');
const { geocodeAddress, resolveDestination, destinationFromSelection } = require('./geocode');
const { getTopPlaces, PlacesError } = require('./places');
const { normalizeEmail } = require('../auth/authLogic');
const { isConnectionError } = require('../mongo');

/**
 * Itinerary API (JSON; errors are { error } like the budget, checklist and account APIs).
 * Every route needs a signed-in user (req.user, set by requireAuth from the account API),
 * and trips are private to their members.
 *
 *   GET    /api/trips                    -> [trip]            trips the signed-in user belongs to
 *   POST   /api/trips                    -> 201 trip          { name, destination, startDate, endDate }
 *   GET    /api/trips/:tripId            -> trip              (with members: [{ id, name }])
 *   PUT    /api/trips/:tripId            -> trip              edit details; 409 if activities would fall outside the dates
 *   DELETE /api/trips/:tripId            -> 204               owner only; its activities go with it
 *   POST   /api/trips/:tripId/members    -> trip              { email } of an existing account
 *   GET    /api/trips/:tripId/items      -> [item]            each with a `conflicts` array and an `item.weather` object
 *   POST   /api/trips/:tripId/items      -> 201 { item, conflicts }
 *   PUT    /api/items/:itemId            -> { item, conflicts }
 *   DELETE /api/items/:itemId            -> 204
 *   GET    /api/places?destination=Kyoto, Japan -> { area, places }   top 50 places (needs OPENTRIPMAP_KEY)
 *
 * The trip id is also the tripId the budget planner and the checklist use, so those can be
 * attached to a real trip by passing its _id.
 *
 * Dependencies are injected so tests can pass a fake store, fake sign-in and fake account lookup:
 *   store         from itineraryStore.js
 *   requireAuth   (req, res, next) middleware that sets req.user = { id, name, email }
 *   users         the account store: findUserById(id), findUserByEmail(email)
 *   checks        plug-in points for the route planner and weather teammates (externalChecks.js)
 */
function createItineraryRouter({ store, requireAuth, users, checks = externalChecks }) {
  const router = express.Router();
  const authed = [requireAuth];

  // --- helpers -------------------------------------------------------------

  /** id -> display name for these account ids. A lookup that fails just leaves the name out. */
  async function namesFor(ids) {
    const names = new Map();
    await Promise.all(
      [...new Set(ids)].map(async (id) => {
        const user = users ? await users.findUserById(id).catch(() => null) : null;
        if (user?.name) names.set(id, user.name);
      }),
    );
    return names;
  }

  async function presentTrip(trip) {
    const names = await namesFor(trip.memberIds);
    return { ...trip, members: trip.memberIds.map((id) => ({ id, name: names.get(id) || 'Traveller' })) };
  }

  /** The trip, or a response already sent (404 unknown, 403 not a member). */
  async function loadTrip(req, res, tripId = req.params.tripId) {
    const trip = await store.trips.get(tripId);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return null;
    }
    if (!trip.memberIds.includes(req.user.id)) {
      res.status(403).json({ error: 'You are not in this trip.' });
      return null;
    }
    return trip;
  }

  // Make sure a saved location has coordinates when we can find them (used by weather and routes).
  //   1. coordinates sent by the client (e.g. a place picked from Top Places) are kept
  //   2. an edit that did not change the address keeps the coordinates already saved
  //   3. otherwise the address is looked up; if nothing is found the item simply has no coordinates
  //      and toWeatherActivity() falls back to the trip's destination
  async function fillCoordinates(fields, trip, existing = null) {
    if (fields.location === undefined) return fields; // not sent: an update keeps what is saved
    const loc = logic.cleanLocation(fields.location);
    if (!loc) {
      const { location, ...rest } = fields; // eslint-disable-line no-unused-vars
      return rest;
    }
    const old = existing?.location;
    // Same coordinates as before but a different address: they belong to the old address, so drop them
    if (old && loc.lat === old.lat && loc.lng === old.lng && loc.address !== old.address) {
      delete loc.lat;
      delete loc.lng;
    }
    if (loc.lat != null) return { ...fields, location: loc };
    if (old?.lat != null && old.address === loc.address) {
      return { ...fields, location: { ...loc, lat: old.lat, lng: old.lng } };
    }
    if (!loc.address) return { ...fields, location: loc };
    const hit = await geocodeAddress(loc.address, trip);
    return { ...fields, location: hit ? { ...loc, ...hit } : loc };
  }

  /** All activities of a trip, in order, each with its conflicts and item.weather. */
  async function itemsWithConflicts(trip) {
    const saved = await store.items.listByTrip(trip._id);
    const names = await namesFor(saved.map((i) => i.createdBy));
    const items = saved.map((i) => ({
      ...i,
      createdByName: names.get(i.createdBy) || 'a traveller',
      weather: logic.toWeatherActivity(i, trip),
    }));
    const conflicts = await logic.detectConflicts(items, checks);
    return items
      .map((i) => ({ ...i, conflicts: conflicts[String(i._id)] || [] }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  // --- trips ---------------------------------------------------------------

  router.get('/trips', authed, async (req, res) => {
    res.json(await store.trips.listForUser(req.user.id));
  });

  router.post('/trips', authed, async (req, res) => {
    const problem = logic.validateTrip(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const { name, destination, startDate, endDate } = req.body;
    const selected = destinationFromSelection(req.body.destinationLocation, destination);
    if (req.body.destinationLocation != null && !selected) return res.status(400).json({ error: 'Select a destination from the suggestions again, or clear the selection and enter a city and country.' });
    // Destination centre point + timezone for the weather (empty if the lookup fails; never blocks saving)
    const { center, timezone, destinationScope } = selected || await resolveDestination(destination);
    const trip = await store.trips.create({
      name: name.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      ownerId: req.user.id,
      memberIds: [req.user.id],
      center,
      timezone,
      destinationScope,
    });
    res.status(201).json(await presentTrip(trip));
  });

  router.get('/trips/:tripId', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (trip) res.json(await presentTrip(trip));
  });

  // Recover a failed lookup without recreating the trip or overwriting its details.
  router.post('/trips/:tripId/location', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    const where = await resolveDestination(trip.destination);
    if (!where.center || !where.timezone) return res.status(503).json({ error: 'Could not look up this destination. Retry, or choose a city and country in Edit trip.' });
    const current = await loadTrip(req, res);
    if (!current) return;
    if (current.destination !== trip.destination) return res.status(409).json({ error: 'The destination changed. Refresh the trip and try again.' });
    res.json(await presentTrip(await store.trips.update(trip._id, where)));
  });

  // Edit trip details (any traveller in the trip can do this, like editing activities)
  router.put('/trips/:tripId', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    const problem = logic.validateTrip(req.body, trip);
    if (problem) return res.status(400).json({ error: problem });
    const { name, destination, startDate, endDate } = req.body;
    const selected = destinationFromSelection(req.body.destinationLocation, destination);
    if (req.body.destinationLocation != null && !selected) return res.status(400).json({ error: 'Select a destination from the suggestions again, or clear the selection and enter a city and country.' });

    // Do not leave activities stranded outside the trip's new dates
    if (startDate !== trip.startDate || endDate !== trip.endDate) {
      const outside = (await store.items.listByTrip(trip._id)).filter((i) => i.date < startDate || i.date > endDate);
      if (outside.length) {
        const dates = [...new Set(outside.map((i) => i.date))].sort().join(', ');
        const n = outside.length;
        return res.status(409).json({
          error: `${n} activit${n === 1 ? 'y is' : 'ies are'} scheduled outside the new dates (${dates}). Move or delete ${n === 1 ? 'it' : 'them'} first.`,
        });
      }
    }

    // Look the destination up again if it changed, or if this older trip never had a centre point saved
    const cleanDestination = destination.trim();
    const where = selected || (
      cleanDestination !== trip.destination || !trip.center || !trip.timezone
        ? await resolveDestination(cleanDestination)
        : { center: trip.center, timezone: trip.timezone, destinationScope: trip.destinationScope || '' });

    const updated = await store.trips.update(trip._id, {
      name: name.trim(),
      destination: cleanDestination,
      startDate,
      endDate,
      center: where.center,
      timezone: where.timezone,
      destinationScope: where.destinationScope,
    });
    res.json(await presentTrip(updated));
  });

  router.delete('/trips/:tripId', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    if (trip.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the trip owner can delete it.' });
    await store.trips.remove(trip._id);
    res.status(204).end();
  });

  // Add a traveller who already has an account. Any member can do this; everyone in the trip can edit it.
  router.post('/trips/:tripId/members', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "Enter your travel buddy's email address." });
    const person = users ? await users.findUserByEmail(email) : null;
    if (!person) {
      return res.status(404).json({ error: 'No account uses that email yet. Ask them to sign up first, then add them.' });
    }
    res.json(await presentTrip(await store.trips.addMember(trip._id, person.id)));
  });

  // --- activities ----------------------------------------------------------

  router.get('/trips/:tripId/items', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (trip) res.json(await itemsWithConflicts(trip));
  });

  router.post('/trips/:tripId/items', authed, async (req, res) => {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    const problem = logic.validateItem(req.body, trip);
    if (problem) return res.status(400).json({ error: problem });

    const fields = await fillCoordinates(logic.pickItemFields(req.body), trip);
    const item = await store.items.create({ ...fields, tripId: trip._id, createdBy: req.user.id, updatedBy: req.user.id });
    const saved = (await itemsWithConflicts(trip)).find((i) => String(i._id) === String(item._id));
    res.status(201).json({ item: saved, conflicts: saved.conflicts });
  });

  router.put('/items/:itemId', authed, async (req, res) => {
    const existing = await store.items.get(req.params.itemId);
    if (!existing) return res.status(404).json({ error: 'Item not found.' });
    const trip = await loadTrip(req, res, existing.tripId);
    if (!trip) return;
    const problem = logic.validateItem(req.body, trip);
    if (problem) return res.status(400).json({ error: problem });

    const fields = await fillCoordinates(logic.pickItemFields(req.body), trip, existing);
    await store.items.update(existing._id, { ...fields, updatedBy: req.user.id });
    const saved = (await itemsWithConflicts(trip)).find((i) => String(i._id) === String(existing._id));
    res.json({ item: saved, conflicts: saved.conflicts });
  });

  router.delete('/items/:itemId', authed, async (req, res) => {
    const existing = await store.items.get(req.params.itemId);
    if (!existing) return res.status(404).json({ error: 'Item not found.' });
    const trip = await loadTrip(req, res, existing.tripId);
    if (!trip) return;
    await store.items.remove(existing._id);
    res.status(204).end();
  });

  // --- suggested places ------------------------------------------------------

  // GET /api/places?destination=Japan -> top 50 places to visit. Needs a login so strangers cannot use up our daily quota.
  router.get('/places', authed, async (req, res) => {
    try {
      res.json(await getTopPlaces(req.query.destination));
    } catch (err) {
      if (err instanceof PlacesError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  });

  // --- errors --------------------------------------------------------------
  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.status === 503 || isConnectionError(err)) {
      console.error('[itinerary]', err.message, err.cause?.message || '');
      return res.status(503).json({ error: 'Trips are unavailable right now. Please try again shortly.' });
    }
    console.error('[itinerary]', err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return router;
}

/** Mount the itinerary API on an existing Express app (after its JSON body parser and the account API). */
function mountItinerary(app, options) {
  const router = createItineraryRouter(options);
  app.use('/api', router);
  return router;
}

module.exports = { createItineraryRouter, mountItinerary };
