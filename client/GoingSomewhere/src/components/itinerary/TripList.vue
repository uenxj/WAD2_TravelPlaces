<script setup>
// "My Trips": the real trips of the signed-in user.
import { ref, onMounted } from 'vue'
import TrashButton from '../TrashButton.vue'
import PlaneLoader from '../PlaneLoader.vue'
import { useRoute, useRouter } from 'vue-router'
import { user } from '../../services/auth.js'
import { itineraryApi } from '../../itinerary/api.js'
import { redirectIfSignedOut } from '../../itinerary/session.js'
import { dateRange } from '../../itinerary/dates.js'

const route = useRoute()
const router = useRouter()

// The postmark on each card: the country (the last part of "City, Region, Country"), written round the ring.
// The text is shrunk until it fits the arc, and very long names are shortened, so nothing is ever clipped.
const MARK_ARC = 132 // length of the arc the text may use, in the stamp's 100x100 drawing units (about 280 degrees)
const MARK_MAX_CHARS = 24
function stampText(destination) {
  const country = String(destination ?? '').split(',').map((part) => part.trim()).filter(Boolean).at(-1) ?? ''
  const text = country.length > MARK_MAX_CHARS ? `${country.slice(0, MARK_MAX_CHARS - 1).trimEnd()}…` : country
  return text.toUpperCase()
}
// Biggest font that still fits: each capital is roughly .76 of the font size wide, with the letter spacing.
const stampSize = (text) => Math.min(10, MARK_ARC / (Math.max(text.length, 1) * 0.76)).toFixed(2)
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
        <h1 class="page-heading">My Trips</h1>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <PlaneLoader v-if="loading" label="Loading trips…" data-testid="trip-loading" />
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
              <RouterLink class="secondary-action small" :to="`/trips/${trip._id}`">View trip →</RouterLink>
              <TrashButton v-if="trip.ownerId === user?.id" :label="`Delete trip ${trip.name}`" @click="removeTrip(trip)" />
            </div>
          </div>
        </div>
        <svg class="stamp-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-testid="stamp-mark">
          <defs>
            <!-- a full circle that starts at the bottom, so the text centred on it sits at the top of the ring -->
            <path :id="`mark-${trip._id}`" d="M50 77A27 27 0 0 1 50 23A27 27 0 0 1 50 77" />
          </defs>
          <text :font-size="stampSize(stampText(trip.destination))">
            <textPath :href="`#mark-${trip._id}`" startOffset="50%" text-anchor="middle">{{ stampText(trip.destination) }}</textPath>
          </text>
        </svg>
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

/* .trip-card-content { height: 100%; padding-inline-end: .75rem; border-radius: 0; } */
.trip-card-content { height: 100%; padding-inline-end: .75rem; border-radius: 1.25rem; }

.card-footer-row .action-row { gap: .25rem; }

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

/* A shadow on the grid follows each stamp's perforated edge.
   (A box-shadow on the card itself would be cut off by the stamp's mask.) */
.trip-grid {
  filter: drop-shadow(0 10px 14px rgb(0 0 0 / .16));
}

.trip-card {
  --tilt: -.7deg;
  position: relative;
  transform: rotate(var(--tilt));
  transition: transform .3s cubic-bezier(.2, .8, .3, 1);
  animation: stamp-land .6s cubic-bezier(.2, .9, .3, 1.15) backwards;
}
.trip-card:nth-child(even) { --tilt: .6deg; }

/* Straighten and lift on hover, and for keyboard users tabbing inside the card. */
.trip-card:hover,
.trip-card:focus-within {
  transform: translateY(-6px) rotate(0deg);
}

/* The postmark: two rings with cancellation lines through them. */
.trip-card::after {
  content: '';
  position: absolute;
  top: 1.7rem;
  right: 1.9rem;
  width: 5.5rem;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgb(var(--travel-accent-rgb) / .38);
  outline: 1.5px solid rgb(var(--travel-accent-rgb) / .3);
  outline-offset: -9px;
  background: repeating-linear-gradient(
    0deg,
    transparent 0 9px,
    rgb(var(--travel-accent-rgb) / .22) 9px 10.5px
  );
  transform: rotate(-14deg);
  pointer-events: none; /* never blocks clicks on the card */
}

/* One entrance for the whole page: the stamps land one after another. */
@keyframes stamp-land {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(1.12) rotate(calc(var(--tilt) * 5));
  }
  60% {
    opacity: 1;
    transform: translateY(0) scale(.985) rotate(var(--tilt));
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(var(--tilt));
  }
}
.trip-card:nth-child(1) { animation-delay: .05s; }
.trip-card:nth-child(2) { animation-delay: .16s; }
.trip-card:nth-child(3) { animation-delay: .27s; }
.trip-card:nth-child(4) { animation-delay: .38s; }
.trip-card:nth-child(n + 5) { animation-delay: .49s; }

@media (prefers-reduced-motion: reduce) {
  .trip-card { animation: none; transition: none; }
  .trip-card:hover,
  .trip-card:focus-within { transform: rotate(var(--tilt)); }
}

/* The stamps scale up a little as they land; on a narrow phone that must not make the page scroll sideways. */
main {
  overflow-x: clip;
}

/* Keep the title and destination out from under the postmark, so long names wrap instead of running beneath it. */
.trip-card h2,
.trip-card-content > p.muted-copy {
  padding-inline-end: 6.3rem;
}

/* The country, curved round the postmark. It sits exactly over the rings drawn by ::after above. */
.stamp-mark {
  position: absolute;
  top: 1.7rem;
  right: 1.9rem;
  width: 5.5rem;
  aspect-ratio: 1;
  transform: rotate(-14deg);
  overflow: visible;
  pointer-events: none; /* never blocks clicks on the card */
}

.stamp-mark text {
  fill: rgb(var(--travel-accent-rgb) / .78);
  font-weight: 700;
  letter-spacing: .08em;
}

</style>
