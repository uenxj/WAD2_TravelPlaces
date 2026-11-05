<script setup>
import BackLink from '../components/BackLink.vue'
import PlaneLoader from '../components/PlaneLoader.vue'
// One real trip: its days, activities (with conflict warnings), suggested places, travellers and the
// weather module's conditions. Route: /trips/:tripId. Only people in the trip can open it.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user } from '../services/auth.js'
import { itineraryApi } from '../itinerary/api.js'
import { redirectIfSignedOut } from '../itinerary/session.js'
import { tripDays, dateRange, longDate } from '../itinerary/dates.js'
import { toConditionsActivity } from '../itinerary/activity.js'
import { findSameActivity } from '../itinerary/duplicates.js'
import { currencyForDestination } from '../budget/destinationCurrency.js'
import ActivityConditions from '../components/ActivityConditions.vue'
import ActivityCard from '../components/itinerary/ActivityCard.vue'
import ActivityFormModal from '../components/itinerary/ActivityFormModal.vue'
import DuplicateActivityModal from '../components/itinerary/DuplicateActivityModal.vue'
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
const pendingItem = ref(null) // what the person is adding while we ask "move or duplicate?"
const sameActivity = ref([]) // the same activity already planned on other days
const serverError = ref('')
const notice = ref(null) // { title, conflicts } shown right after saving something that clashes
const newMember = ref('')
const memberMessage = ref('')
const memberFailed = ref(false)
const conditionsVersion = ref(0) // bumped when the day summary refreshes, so each activity's panel re-checks too
const resolvingLocation = ref(false)
const locationError = ref('')

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

async function resolveLocation() {
  if (resolvingLocation.value) return
  resolvingLocation.value = true
  locationError.value = ''
  try {
    trip.value = await itineraryApi.resolveTripLocation(props.tripId)
    await loadItems()
  } catch (e) {
    if (e.status === 404 && e.message === 'Request failed (404)') {
      locationError.value = 'Location lookup could not be refreshed. Open Edit trip, choose a destination, and save to try again.'
    } else {
      fail(e, locationError)
    }
  } finally {
    resolvingLocation.value = false
  }
}

async function init() {
  try {
    trip.value = await itineraryApi.getTrip(props.tripId)
    selectedDate.value = trip.value.startDate
    await loadItems()
    if (!trip.value.center || !trip.value.timezone) resolveLocation()
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
  loadItems() // fresh list, so clashes with what others just added show up in the form
}
function openEdit(item) {
  editingItem.value = item
  prefillPlace.value = null
  serverError.value = ''
  modalOpen.value = true
  loadItems()
}

function closeDuplicatePrompt() {
  pendingItem.value = null
  sameActivity.value = []
}

// Runs a save (create, edit or move) and closes the dialogs. A failure keeps the form open with the message.
async function runSave(action) {
  saving.value = true
  serverError.value = ''
  try {
    const result = await action()
    modalOpen.value = false
    closeDuplicatePrompt()
    selectedDate.value = result.item.date
    notice.value = result.conflicts.length ? { title: result.item.title, conflicts: result.conflicts } : null
    await loadItems()
  } catch (e) {
    closeDuplicatePrompt()
    fail(e, serverError)
  } finally {
    saving.value = false
  }
}

async function saveItem(payload) {
  if (editingItem.value) return runSave(() => itineraryApi.updateItem(editingItem.value._id, payload))

  // Adding: is this already planned on another day? Then ask whether to move it or add a second copy.
  await loadItems() // others may have just added it
  const matches = findSameActivity(items.value, payload)
  if (matches.length) {
    pendingItem.value = payload
    sameActivity.value = matches
    return
  }
  return runSave(() => itineraryApi.createItem(props.tripId, payload))
}

// "Move it": keep the existing activity as it is, but put it on the day and time that was just chosen.
function moveExisting(existing) {
  const { date, startTime, endTime } = pendingItem.value
  return runSave(() =>
    itineraryApi.updateItem(existing._id, {
      title: existing.title,
      type: existing.type,
      setting: existing.setting,
      notes: existing.notes,
      date,
      startTime,
      endTime,
    }),
  )
}

// "Duplicate it": add the new copy as chosen.
function addDuplicate() {
  const payload = pendingItem.value
  return runSave(() => itineraryApi.createItem(props.tripId, payload))
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
    if (!tripModalOpen.value && !saving.value && !loading.value) loadItems() // also while the form is open, so clashes stay current
  }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main class="content-page">
    <PlaneLoader v-if="loading" label="Loading itinerary…" />

    <section v-else-if="pageError && !trip" class="surface" role="alert">
      <h1 class="error-heading">We couldn’t open this trip</h1>
      <p class="muted-copy">{{ pageError }}</p>
      <BackLink to="/trips">Back to My Trips</BackLink>
    </section>

    <template v-else-if="trip">
      <BackLink to="/trips">Back to My Trips</BackLink>
      <div class="page-top">
        <div class="trip-title-row">
            <h1 class="page-heading" data-testid="trip-title">{{ trip.name }}</h1>
            <button type="button" class="secondary-action trip-edit" data-testid="edit-trip-btn" @click="openEditTrip">Edit trip</button>
        </div>
        <p class="muted-copy trip-meta">{{ trip.destination }} · {{ dateRange(trip.startDate, trip.endDate) }} · {{ memberCount }} traveller{{ memberCount === 1 ? '' : 's' }}</p>
        <div class="action-row trip-actions">
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
        <button v-for="(d, i) in days" :key="d.date" type="button" :class="{ 'has-conflicts': conflictCountByDay[d.date] }" :aria-pressed="d.date === selectedDate" data-testid="day-tab" @click="selectedDate = d.date">
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
            >
              <template v-if="trip.destinationScope === 'country'" #after-header>
                <p class="muted-copy small-copy location-context">Weather is for a representative location in {{ trip.destination }}. Choose a city in Edit trip for more local conditions.</p>
              </template>
            </ActivityConditions>
            <template v-else>
              <p class="eyebrow day-label">{{ dayHeading }}</p>
              <PlaneLoader v-if="resolvingLocation" compact label="Finding your destination for weather and air quality…" />
              <template v-else>
                <p class="muted-copy" :role="locationError ? 'alert' : undefined">{{ locationError || 'The destination lookup is unavailable. Retry, or choose a city and country in Edit trip.' }}</p>
                <button type="button" class="secondary-action small" @click="resolveLocation">Retry location</button>
              </template>
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
        :items="items"
        :current-user-id="user?.id ?? ''"
        :saving="saving"
        :server-error="serverError"
        @save="saveItem"
        @close="modalOpen = false"
      />

      <DuplicateActivityModal
        v-if="pendingItem"
        :title="pendingItem.title"
        :date="pendingItem.date"
        :matches="sameActivity"
        :days="days"
        :current-user-id="user?.id ?? ''"
        :saving="saving"
        @move="moveExisting"
        @duplicate="addDuplicate"
        @cancel="closeDuplicatePrompt"
      />

      <EditTripModal v-if="tripModalOpen" :trip="trip" :saving="savingTrip" :server-error="tripError" @save="saveTrip" @close="tripModalOpen = false" />
    </template>
  </main>
</template>

<style scoped>
.page-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: .5rem 1.5rem;
  margin: 1rem 0 2rem;
}

.trip-title-row { display: flex; align-items: center; gap: 1rem; min-width: 0; grid-column: 1; grid-row: 1; }
.trip-meta { grid-column: 1 / -1; grid-row: 2; margin: 0; }
.trip-actions { grid-column: 2; grid-row: 1; }
@media (max-width: 900px) {
  .page-top { grid-template-columns: minmax(0, 1fr); }
  .trip-actions { grid-column: 1; grid-row: 3; margin-top: .5rem; }
}
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
  border: 1px solid var(--travel-warn-border);
  border-radius: .75rem;
  background: var(--travel-warn-bg);
  color: var(--travel-warn-text);
  line-height: 1.6;
}

.alert-box.error {
  border-color: var(--travel-danger-border);
  background: var(--travel-danger-bg);
  color: var(--travel-danger-text);
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
  border: 1px solid var(--travel-action-border);
  border-radius: .85rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  text-align: left;
  cursor: pointer;
}

.day-navigation button.has-conflicts {
  padding-right: 2.8rem; /* room for the badge in the corner */
}

.day-navigation button span {
  font-size: .8rem;
  color: var(--travel-muted);
}

.day-navigation button[aria-pressed='true'] {
  border-color: var(--travel-accent);
  background: var(--travel-selected);
}

.badge {
  position: absolute;
  top: .5rem;
  right: .55rem;
  min-width: 1.4rem;
  padding: .1rem .4rem;
  border-radius: 999px;
  background: var(--travel-danger);
  color: var(--travel-on-danger);
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

.location-context { margin-bottom: 1rem; }

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
  background: var(--travel-selected);
  color: var(--travel-selected-text);
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
  background: var(--travel-strong);
  color: var(--travel-on-strong);
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
  color: var(--travel-danger-text);
}

@media (max-width: 900px) {
  .itinerary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
