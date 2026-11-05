<script setup>
import BackLink from '../components/BackLink.vue'
// One real trip: its days, activities (with conflict warnings), suggested places, travellers and the
// weather module's conditions. Route: /trips/:tripId. Only people in the trip can open it.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user } from '../services/auth.js'
import { itineraryApi } from '../itinerary/api.js'
import { redirectIfSignedOut } from '../itinerary/session.js'
import { tripDays, dateRange, longDate } from '../itinerary/dates.js'
import { toConditionsActivity } from '../itinerary/activity.js'
import { currencyForDestination } from '../budget/destinationCurrency.js'
import ActivityConditions from '../components/ActivityConditions.vue'
import ActivityCard from '../components/itinerary/ActivityCard.vue'
import ActivityFormModal from '../components/itinerary/ActivityFormModal.vue'
import EditTripModal from '../components/itinerary/EditTripModal.vue'
import SuggestedPlaces from '../components/itinerary/SuggestedPlaces.vue'

const props = defineProps({ tripId: { type: String, required: true } })
const route = useRoute()
const router = useRouter()

const trip = ref(null)
const items = ref([])
const loading = ref(true)
const pageError = ref('')
const selectedDate = ref('')
const modalOpen = ref(false)
const editingItem = ref(null)
const prefillPlace = ref(null) // set when an activity is started from the suggested places
const tripModalOpen = ref(false)
const savingTrip = ref(false)
const tripError = ref('')
const saving = ref(false)
const serverError = ref('')
const notice = ref(null) // { title, conflicts } shown right after saving something that clashes
const newMember = ref('')
const memberMessage = ref('')
const memberFailed = ref(false)
const conditionsVersion = ref(0) // bumped when the day summary refreshes, so each activity's panel re-checks too

const days = computed(() => (trip.value ? tripDays(trip.value) : []))
const dayIndex = computed(() => days.value.findIndex((d) => d.date === selectedDate.value))
const dayHeading = computed(() => {
  const city = (trip.value?.destination ?? '').split(',')[0].trim().replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase())
  return selectedDate.value ? `Day ${dayIndex.value + 1} · ${longDate(selectedDate.value)} · ${city}` : ''
})
const dayItems = computed(() => items.value.filter((i) => i.date === selectedDate.value))
const conflictCountByDay = computed(() => {
  const counts = {}
  for (const i of items.value) if (i.conflicts.length) counts[i.date] = (counts[i.date] || 0) + 1
  return counts
})
const totalConflicts = computed(() => items.value.filter((i) => i.conflicts.length).length)
const isOwner = (id) => trip.value?.ownerId === id
const memberCount = computed(() => trip.value?.memberIds.length ?? 0)
// The trip's budget; suggests the destination's currency when we know it (otherwise the Budget page's default).
const budgetLink = computed(() => {
  const currency = currencyForDestination(trip.value?.destination)
  return `/budget?trip=${trip.value?._id}${currency ? `&currency=${currency}` : ''}`
})

// ---- weather module (src/weather): needs coordinates and a timezone, which the server works out ----
const dayActivities = computed(() => dayItems.value.map(toConditionsActivity).filter(Boolean))
const daySummary = computed(() => {
  const t = trip.value
  if (!t?.center || !t.timezone) return null
  return {
    id: `day-${selectedDate.value}`, name: t.destination, latitude: t.center.lat, longitude: t.center.lng,
    date: selectedDate.value, startTime: '00:00', endTime: '23:59', timezone: t.timezone, environment: 'outdoor',
  }
})

function fail(e, target = pageError) {
  if (!redirectIfSignedOut(e, router, route)) target.value = e.message
}

async function loadItems() {
  try {
    items.value = await itineraryApi.listItems(props.tripId)
  } catch (e) {
    fail(e)
  }
}

async function init() {
  try {
    trip.value = await itineraryApi.getTrip(props.tripId)
    selectedDate.value = trip.value.startDate
    await loadItems()
  } catch (e) {
    fail(e)
  } finally {
    loading.value = false
  }
}

function openAdd(place = null) {
  editingItem.value = null
  prefillPlace.value = place
  serverError.value = ''
  modalOpen.value = true
}
function openEdit(item) {
  editingItem.value = item
  prefillPlace.value = null
  serverError.value = ''
  modalOpen.value = true
}

async function saveItem(payload) {
  saving.value = true
  serverError.value = ''
  try {
    const result = editingItem.value
      ? await itineraryApi.updateItem(editingItem.value._id, payload)
      : await itineraryApi.createItem(props.tripId, payload)
    modalOpen.value = false
    selectedDate.value = result.item.date
    notice.value = result.conflicts.length ? { title: result.item.title, conflicts: result.conflicts } : null
    await loadItems()
  } catch (e) {
    fail(e, serverError)
  } finally {
    saving.value = false
  }
}

async function removeItem(item) {
  if (!confirm(`Remove "${item.title}" from the itinerary?`)) return
  try {
    await itineraryApi.deleteItem(item._id)
    notice.value = null
    await loadItems()
  } catch (e) {
    fail(e)
  }
}

function openEditTrip() {
  tripError.value = ''
  tripModalOpen.value = true
}

async function saveTrip(payload) {
  savingTrip.value = true
  tripError.value = ''
  try {
    trip.value = await itineraryApi.updateTrip(props.tripId, payload)
    // If the dates moved, make sure the selected day still exists
    if (!days.value.some((d) => d.date === selectedDate.value)) selectedDate.value = trip.value.startDate
    tripModalOpen.value = false
  } catch (e) {
    fail(e, tripError)
  } finally {
    savingTrip.value = false
  }
}

async function addMember() {
  memberMessage.value = ''
  memberFailed.value = false
  const email = newMember.value.trim()
  if (!email) return
  try {
    trip.value = await itineraryApi.addMember(props.tripId, email)
    memberMessage.value = `${email} can now edit this trip.`
    newMember.value = ''
  } catch (e) {
    memberFailed.value = true
    if (!redirectIfSignedOut(e, router, route)) memberMessage.value = e.message
  }
}

// Group sync: refetch every 15s so changes from other members appear.
let timer
onMounted(() => {
  init()
  timer = setInterval(() => {
    if (!modalOpen.value && !tripModalOpen.value && !loading.value) loadItems()
  }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main class="content-page">
    <p v-if="loading" class="muted-copy" role="status">Loading itinerary…</p>

    <section v-else-if="pageError && !trip" class="surface" role="alert">
      <h1 class="error-heading">We couldn’t open this trip</h1>
      <p class="muted-copy">{{ pageError }}</p>
      <BackLink to="/trips">Back to My Trips</BackLink>
    </section>

    <template v-else-if="trip">
      <BackLink to="/trips">Back to My Trips</BackLink>
      <div class="page-top">
        <div class="trip-heading">
          <p class="eyebrow">Group trip</p>
          <div class="trip-title-row">
            <h1 class="page-heading" data-testid="trip-title">{{ trip.name }}</h1>
            <button type="button" class="secondary-action trip-edit" data-testid="edit-trip-btn" @click="openEditTrip">Edit trip</button>
          </div>
          <p class="muted-copy">{{ trip.destination }} · {{ dateRange(trip.startDate, trip.endDate) }} · {{ memberCount }} traveller{{ memberCount === 1 ? '' : 's' }}</p>
        </div>
        <div class="action-row">
          <RouterLink class="secondary-action" :to="`/checklist?trip=${trip._id}`" data-testid="packing-link">Packing list</RouterLink>
          <RouterLink class="secondary-action" :to="budgetLink" data-testid="budget-link">Budget</RouterLink>
          <button type="button" class="primary-action" data-testid="add-item-btn" @click="openAdd()">Add activity</button>
        </div>
      </div>

      <p v-if="pageError" class="alert-box error" role="alert">{{ pageError }}</p>

      <!-- Pop-up style notice right after saving something that clashes -->
      <div v-if="notice" class="alert-box warning" role="alert" data-testid="conflict-notice">
        <button type="button" class="alert-close" aria-label="Dismiss" @click="notice = null">×</button>
        <strong>“{{ notice.title }}” has {{ notice.conflicts.length }} conflict{{ notice.conflicts.length > 1 ? 's' : '' }}.</strong>
        <ul>
          <li v-for="(c, i) in notice.conflicts" :key="i">{{ c.message }}</li>
        </ul>
      </div>
      <p v-else-if="totalConflicts" class="ui-notice" data-testid="conflict-summary">
        {{ totalConflicts }} activit{{ totalConflicts > 1 ? 'ies have' : 'y has' }} conflicts. Check the days marked with a badge.
      </p>

      <nav class="day-navigation" aria-label="Itinerary days" data-testid="day-tabs">
        <button v-for="(d, i) in days" :key="d.date" type="button" :aria-pressed="d.date === selectedDate" data-testid="day-tab" @click="selectedDate = d.date">
          <strong>Day {{ i + 1 }}</strong>
          <span>{{ d.label }}</span>
          <em v-if="conflictCountByDay[d.date]" class="badge" :aria-label="`${conflictCountByDay[d.date]} with conflicts`">{{ conflictCountByDay[d.date] }}</em>
        </button>
      </nav>

      <div class="itinerary-grid">
        <section aria-label="Day schedule">
          <div class="surface day-overview">
            <ActivityConditions
              v-if="daySummary"
              :heading="dayHeading"
              :activity="daySummary"
              :activities="dayActivities"
              :trip-id="trip._id"
              @refreshed="conditionsVersion++"
            />
            <template v-else>
              <p class="eyebrow day-label">{{ dayHeading }}</p>
              <p class="muted-copy">Weather and air quality appear once the destination can be found on the map. Try “City, Country” in Edit trip.</p>
            </template>
          </div>

          <p v-if="!dayItems.length" class="muted-copy empty-day" data-testid="empty-day">
            Nothing planned for this day. Use “Add activity” to schedule your first stop.
          </p>
          <ol v-else class="activities">
            <ActivityCard v-for="item in dayItems" :key="item._id" :item="item" @edit="openEdit" @delete="removeItem">
              <ActivityConditions
                v-if="toConditionsActivity(item)"
                :key="`${item._id}-${conditionsVersion}`"
                :activity="toConditionsActivity(item)"
                compact
              />
            </ActivityCard>
          </ol>
        </section>

        <aside class="side-column">
          <SuggestedPlaces :destination="trip.destination" @pick="openAdd" />

          <section class="surface members" aria-label="Who is going">
            <h2>Who’s going?</h2>
            <p class="muted-copy small-copy" data-testid="members-note">Everyone going can edit the itinerary.</p>
            <ul class="member-list" data-testid="member-list">
              <li v-for="m in trip.members" :key="m.id">
                <span class="avatar" aria-hidden="true">{{ m.name[0].toUpperCase() }}</span>
                <span>{{ m.name }}</span>
                <span v-if="isOwner(m.id)" class="muted-copy small-copy">Organiser</span>
                <span v-else-if="m.id === user?.id" class="muted-copy small-copy">You</span>
              </li>
            </ul>
            <form class="member-form" @submit.prevent="addMember">
              <input v-model="newMember" type="email" aria-label="Add a traveller by their account email" placeholder="Their email" data-testid="member-input" />
              <button class="secondary-action small" data-testid="add-member-btn">Add</button>
            </form>
            <p v-if="memberMessage" class="small-copy member-message" :class="{ failed: memberFailed }" role="status">{{ memberMessage }}</p>
          </section>
        </aside>
      </div>

      <ActivityFormModal
        v-if="modalOpen"
        :item="editingItem"
        :prefill="prefillPlace"
        :default-date="selectedDate"
        :days="days"
        :saving="saving"
        :server-error="serverError"
        @save="saveItem"
        @close="modalOpen = false"
      />

      <EditTripModal v-if="tripModalOpen" :trip="trip" :saving="savingTrip" :server-error="tripError" @save="saveTrip" @close="tripModalOpen = false" />
    </template>
  </main>
</template>

<style scoped>
.page-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0 2rem;
}

.trip-heading { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.trip-title-row { display: flex; align-items: center; gap: 1rem; margin-bottom: .5rem; }
.trip-title-row h1 { min-width: 0; margin: 0; }
.trip-edit { flex-shrink: 0; white-space: nowrap; }
.day-label { text-transform: none; letter-spacing: .02em; }
@media (max-width: 575.98px) {
  .trip-edit { padding: .5rem .8rem; font-size: .85rem; }
  .page-top { gap: .75rem; }
  .trip-title-row { flex-wrap: wrap; }
}

.error-heading {
  font-size: 1.6rem;
}

.alert-box {
  position: relative;
  margin: 0 0 1.25rem;
  padding: 1rem 2.5rem 1rem 1rem;
  border: 1px solid #9c854b;
  border-radius: .75rem;
  background: #332d22;
  color: #ffedbf;
  line-height: 1.6;
}

.alert-box.error {
  border-color: #bc7c86;
  background: #3c252c;
  color: #ffd8dc;
}

.alert-box ul {
  margin: .4rem 0 0;
  padding-left: 1.2rem;
}

.alert-close {
  position: absolute;
  top: .5rem;
  right: .75rem;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.ui-notice {
  margin-bottom: 1.25rem;
}

.day-navigation {
  display: flex;
  gap: .6rem;
  margin-bottom: 1.25rem;
  padding-bottom: .4rem;
  overflow-x: auto;
  scrollbar-width: thin;
}

.day-navigation button {
  position: relative;
  display: grid;
  flex: none;
  gap: .25rem;
  min-width: 100px;
  padding: .75rem 1rem;
  border: 1px solid var(--travel-border);
  border-radius: .85rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  text-align: left;
  cursor: pointer;
}

.day-navigation button span {
  font-size: .8rem;
  color: var(--travel-muted);
}

.day-navigation button[aria-pressed='true'] {
  border-color: var(--travel-accent);
  background: #29473f;
}

.badge {
  position: absolute;
  top: -.4rem;
  right: -.3rem;
  min-width: 1.4rem;
  padding: .1rem .4rem;
  border-radius: 999px;
  background: #e5736b;
  color: #fff;
  font-size: .75rem;
  font-style: normal;
  font-weight: 700;
  text-align: center;
}

.itinerary-grid > * { min-width: 0; }

.itinerary-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.day-overview {
  margin-bottom: 1.25rem;
}

.day-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.day-heading h2 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.8rem);
}

.pill {
  display: inline-flex;
  padding: .35rem .8rem;
  border-radius: 999px;
  background: #29473f;
  color: #cce9df;
  font-size: .8rem;
}

.empty-day {
  padding: 1rem 0;
}

.activities {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.side-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
}

.members {
  padding: 1.25rem;
}

.members h2 {
  margin: 0 0 .25rem;
  font-size: var(--travel-section-size);
}

.small-copy {
  margin: 0;
  font-size: .8rem;
  line-height: 1.5;
}

.member-list {
  display: grid;
  gap: .6rem;
  margin: 1rem 0;
  padding: 0;
  list-style: none;
}

.member-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .7rem;
}

.avatar {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #354d51;
  color: #fff;
  font-size: .85rem;
}

.member-form {
  display: flex;
  gap: .5rem;
}

.member-form input {
  flex: 1;
  min-width: 0;
  padding: .55rem .8rem;
  border: 1px solid var(--travel-control-border);
  border-radius: .6rem;
  background: var(--travel-bg);
  color: var(--travel-text);
  font: inherit;
  font-size: 1rem;
}

.small {
  padding: .4rem 1rem;
  font-size: .9rem;
}

.member-message {
  margin-top: .6rem;
  color: var(--travel-accent);
}

.member-message.failed {
  color: #ffd8dc;
}

@media (max-width: 900px) {
  .itinerary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
