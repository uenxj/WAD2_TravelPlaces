<script setup>
// "Create a trip". Plan a trip here (Discover / Explore) opens this with ?destination=...&country=... filled in.
import { ref, watch } from 'vue'
import DestinationInput from './DestinationInput.vue'
import { useRoute, useRouter } from 'vue-router'
import { itineraryApi } from '../../itinerary/api.js'
import { safeReturnPath } from '../../services/auth.js'
import { redirectIfSignedOut } from '../../itinerary/session.js'
import { todayLocal } from '../../itinerary/dates.js'

const route = useRoute()
const router = useRouter()
const today = todayLocal()

// "Kyoto" + "Japan" -> "Kyoto, Japan": naming the country keeps the suggested places on the right city.
const fromQuery = (key) => (typeof route.query[key] === 'string' ? route.query[key] : '')
const city = fromQuery('destination')
const country = fromQuery('country')
const startingDestination = city && country && !city.toLowerCase().includes(country.toLowerCase()) ? `${city}, ${country}` : city

// Cancel goes back to where "Plan a trip here" was clicked (Discover, a country page), otherwise to My Trips.
const cancelTo = safeReturnPath(route.query.from, '/trips')

const form = ref({ name: '', destination: startingDestination, destinationLocation: null, startDate: '', endDate: '' })
const error = ref('')
const saving = ref(false)

// If the start date moves past the end date, move the end date along with it
watch(() => form.value.startDate, (start) => {
  if (start && form.value.endDate && form.value.endDate < start) form.value.endDate = start
})

async function createTrip() {
  error.value = ''
  if (form.value.startDate < today) {
    error.value = 'Start date cannot be in the past.'
    return
  }
  saving.value = true
  try {
    const trip = await itineraryApi.createTrip(form.value)
    router.push(`/trips/${trip._id}`)
  } catch (e) {
    if (!redirectIfSignedOut(e, router, route)) error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="content-page">
    <div class="page-top">
      <div>
        <h1 class="page-heading">Create a trip</h1>
        <p class="muted-copy">Name it, pick the dates, then fill each day with activities and invite your travel buddies.</p>
      </div>
    </div>

    <form class="surface form-stack trip-form" @submit.prevent="createTrip">
      <label for="trip-name">Trip name
        <input id="trip-name" v-model="form.name" maxlength="80" placeholder="Our next adventure" required data-testid="trip-name" />
      </label>
      <DestinationInput id="trip-destination" testid="trip-destination" v-model="form.destination" v-model:location="form.destinationLocation" />
      <label for="trip-start">Start date
        <input id="trip-start" v-model="form.startDate" type="date" :min="today" required data-testid="trip-start" />
      </label>
      <label for="trip-end">End date
        <input id="trip-end" v-model="form.endDate" type="date" :min="form.startDate || today" required data-testid="trip-end" />
      </label>
      <p v-if="error" class="form-error" role="alert" data-testid="trip-error">{{ error }}</p>
      <div class="action-row">
        <button class="primary-action" :disabled="saving" data-testid="create-trip-btn">{{ saving ? 'Creating…' : 'Create trip' }}</button>
        <RouterLink class="secondary-action" :to="cancelTo">Cancel</RouterLink>
      </div>
    </form>
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

.trip-form {
  max-width: 650px;
}


.form-error {
  margin: 0;
  padding: .75rem 1rem;
  border: 1px solid var(--travel-danger-border);
  border-radius: .6rem;
  background: var(--travel-danger-bg);
  color: var(--travel-danger-text);
}

button:disabled {
  opacity: .65;
  cursor: not-allowed;
}
</style>
