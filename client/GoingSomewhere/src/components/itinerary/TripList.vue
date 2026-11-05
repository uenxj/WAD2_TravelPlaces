<script setup>
// "My Trips": the real trips of the signed-in user.
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user } from '../../services/auth.js'
import { itineraryApi } from '../../itinerary/api.js'
import { redirectIfSignedOut } from '../../itinerary/session.js'
import { dateRange } from '../../itinerary/dates.js'

const route = useRoute()
const router = useRouter()
const trips = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  try {
    trips.value = await itineraryApi.listTrips()
  } catch (e) {
    if (!redirectIfSignedOut(e, router, route)) error.value = e.message
  } finally {
    loading.value = false
  }
}

async function removeTrip(trip) {
  if (!confirm(`Delete "${trip.name}" and all of its itinerary items?`)) return
  error.value = ''
  try {
    await itineraryApi.deleteTrip(trip._id)
    trips.value = trips.value.filter((t) => t._id !== trip._id)
  } catch (e) {
    if (!redirectIfSignedOut(e, router, route)) error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <main class="content-page">
    <div class="page-top">
      <div>
        <p class="eyebrow">Your next adventures</p>
        <h1 class="page-heading">My Trips</h1>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted-copy" role="status">Loading trips…</p>
    <section v-else-if="!trips.length && !error" class="surface" data-testid="no-trips">
      <h2>No trips yet</h2>
      <p class="muted-copy">Create your first trip to start building an itinerary.</p>
      <RouterLink class="secondary-action" to="/trips/new">Create a trip</RouterLink>
    </section>
    <ul v-else class="trip-grid">
      <li v-for="trip in trips" :key="trip._id" class="trip-card stamp-card" data-testid="trip-row">
        <div class="surface trip-card-content">
          <p class="eyebrow">{{ trip.ownerId === user?.id ? 'Organiser' : 'Traveller' }}</p>
          <h2>
            <RouterLink :to="`/trips/${trip._id}`" data-testid="trip-link">{{ trip.name }}</RouterLink>
          </h2>
          <p class="muted-copy">{{ trip.destination }}<br />{{ dateRange(trip.startDate, trip.endDate) }}</p>
          <div class="card-footer-row">
            <span class="muted-copy">{{ trip.memberIds.length }} traveller{{ trip.memberIds.length === 1 ? '' : 's' }}</span>
            <div class="action-row">
              <button v-if="trip.ownerId === user?.id" type="button" class="secondary-action small danger" @click="removeTrip(trip)">Delete</button>
              <RouterLink class="secondary-action small" :to="`/trips/${trip._id}`">View trip →</RouterLink>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}

.trip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trip-card-content { height: 100%; border-radius: 0; }

.trip-card h2 {
  margin: .4rem 0 .5rem;
  font-size: 1.5rem;
}

.trip-card h2 a {
  color: var(--travel-text);
  text-decoration: none;
}

.trip-card h2 a:hover {
  color: var(--travel-accent);
}

.card-footer-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.small {
  padding: .4rem 1rem;
  font-size: .9rem;
}

.danger:hover {
  border-color: var(--travel-danger-border);
  color: var(--travel-danger-text);
}

.form-error {
  padding: .75rem 1rem;
  border: 1px solid var(--travel-danger-border);
  border-radius: .6rem;
  background: var(--travel-danger-bg);
  color: var(--travel-danger-text);
}

@media (max-width: 700px) {
  .trip-grid {
    grid-template-columns: 1fr;
  }
}
</style>
