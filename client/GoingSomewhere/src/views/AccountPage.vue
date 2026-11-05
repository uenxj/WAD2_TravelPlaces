<script setup>
import BackLink from '../components/BackLink.vue'
import BudgetPlanner from './Budget.vue'
import ActivityConditions from '../components/ActivityConditions.vue'
import ItineraryAtmosphere from '../components/ItineraryAtmosphere.vue'
import { itineraryAtmosphere } from '../weather/atmosphere.js'
import { SAMPLE_TRIPS } from '../data/sampleTrips.js'
import { validateActivity } from '../weather/conditions.js'
import { longDate } from '../itinerary/dates.js'
import { computed, ref, watch, defineAsyncComponent } from 'vue'
// Loaded only when the Packing tab is opened, so other account pages stay light.
const PackingChecklist = defineAsyncComponent(() => import('./Checklist.vue'))
import { useRoute, useRouter } from 'vue-router'
import { previewMode } from '../services/preview.js'
import { user, logout } from '../services/auth.js'
const route = useRoute()
const router = useRouter()
async function signOut() {
  await logout()
  router.push('/discover')
}
const tab = ref('Itinerary')
const dayIndex = ref(0)
const dayConditions = ref(null)
const conditionsVersion = ref(0)
const editingId = ref(null)
const editForm = ref({})
const editError = ref('')
const title = computed(() => ({ '/trips': 'My Trips', '/trips/new': 'Create a trip', '/profile': 'Your profile', '/saved': 'Saved places' }[route.path] ?? 'Your trip'))
const destination = ref('')
watch(() => route.fullPath, () => { destination.value = typeof route.query.destination === 'string' ? route.query.destination : ''; tab.value = 'Itinerary'; dayIndex.value = 0 }, { immediate: true })
const tripName = ref('')
const startDate = ref('')
const endDate = ref('')
const trips = ref(structuredClone(SAMPLE_TRIPS))
const selectedTrip = computed(() => trips.value.find(t => t.id === route.params.id) ?? trips.value[0])
const tripDetail = computed(() => route.path.startsWith('/trips/preview/'))
const selectedDay = computed(() => selectedTrip.value.days[dayIndex.value] ?? selectedTrip.value.days[0])
const daySummary = computed(() => ({
  ...selectedDay.value.activities[0], name: selectedDay.value.area,
  startTime: '00:00', endTime: '23:59', environment: 'outdoor',
}))
watch(daySummary, () => { dayConditions.value = null }, { flush: 'sync' })
const atmosphere = computed(() => itineraryAtmosphere(selectedTrip.value, selectedDay.value.date, dayConditions.value))
const tripActivities = computed(() => selectedTrip.value.days.flatMap(day => day.activities))
function editActivity(activity) {
  editingId.value = activity.id
  editForm.value = { startTime: activity.startTime, endTime: activity.endTime, environment: activity.environment }
  editError.value = ''
}
function saveActivity(activity) {
  try {
    validateActivity({ ...activity, ...editForm.value })
    Object.assign(activity, editForm.value)
    editingId.value = null
  } catch (error) { editError.value = error.message }
}
const shortDate = date => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
</script>
<template>
  <main class="content-page" :class="{ 'itinerary-page': previewMode && tripDetail && tab === 'Itinerary' }">
    <ItineraryAtmosphere v-if="previewMode && tripDetail && tab === 'Itinerary'" :theme="atmosphere" />
    <template v-if="previewMode && tripDetail">
      <BackLink to="/trips">Back to My Trips</BackLink>
      <div class="page-top mt-4">
        <div><h1 class="page-heading">{{ selectedTrip.name }}</h1><p class="muted-copy">{{ selectedTrip.place }} · {{ selectedTrip.dates }} · {{ selectedTrip.members }}</p></div>
        <span class="sample-badge">Preview trip</span>
      </div>
      <nav class="trip-tabs" aria-label="Trip sections">
        <button v-for="item in ['Itinerary', 'Budget', 'Packing', 'Members']" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item }}</button>
      </nav>
      <section v-if="tab === 'Itinerary'" class="itinerary-section">
        <div class="atmosphere-caption">
          <span class="atmosphere-label">{{ atmosphere.label }} <span>· {{ atmosphere.source === 'forecast' ? 'Forecast atmosphere' : 'Seasonal atmosphere' }}</span></span>
        </div>
        <nav class="day-navigation" aria-label="Itinerary days">
          <button v-for="(day, index) in selectedTrip.days" :key="day.date" type="button" :aria-pressed="dayIndex === index" @click="dayIndex = index"><strong>Day {{ index + 1 }}</strong><span>{{ shortDate(day.date) }}</span></button>
        </nav>
        <section class="surface day-overview" aria-label="Selected itinerary day">
          <ActivityConditions :heading="`Day ${dayIndex + 1} · ${longDate(selectedDay.date)} · ${selectedTrip.place.split(',')[0]}`" :activity="daySummary" :activities="selectedDay.activities" :planned-activities="tripActivities" :trip-id="`preview-${selectedTrip.id}`" @conditions="dayConditions = $event?.weather ?? null" @refreshed="conditionsVersion++">
            <template #after-header><div class="day-heading"><div><h2>{{ selectedDay.title }}</h2><p class="muted-copy">{{ selectedDay.area }} · {{ selectedDay.activities.length }} activities</p></div></div></template>
          </ActivityConditions>
        </section>
        <ol class="activities">
          <li v-for="activity in selectedDay.activities" :key="activity.id" class="weather-activity surface">
            <div class="activity-time"><time>{{ activity.startTime }}</time><span>{{ activity.endTime }}</span></div>
            <div class="activity-body">
              <div class="activity-heading"><h3>{{ activity.name }}</h3><span class="sample-badge">{{ { outdoor: 'Outdoor', indoor: 'Indoor', mixed: 'Indoor & Outdoor' }[activity.environment] }}</span></div>
              <p class="muted-copy activity-description">{{ activity.description }}</p>
              <ActivityConditions :key="`${activity.id}-${conditionsVersion}`" :activity="activity" compact />
              <button v-if="editingId !== activity.id" type="button" class="activity-edit-button" @click="editActivity(activity)">Edit activity</button>
              <form v-else class="activity-editor form-stack" @submit.prevent="saveActivity(activity)">
                <div class="activity-time-fields">
                  <label :for="`${activity.id}-start`">Start time<input :id="`${activity.id}-start`" v-model="editForm.startTime" type="time" required /></label>
                  <label :for="`${activity.id}-end`">End time<input :id="`${activity.id}-end`" v-model="editForm.endTime" type="time" required /></label>
                </div>
                <label :for="`${activity.id}-setting`">Activity setting<select :id="`${activity.id}-setting`" v-model="editForm.environment"><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option><option value="mixed">Indoor &amp; Outdoor</option></select></label>
                <p v-if="editError" role="alert">{{ editError }}</p>
                <div class="action-row"><button class="primary-action" type="submit">Update activity</button><button class="secondary-action" type="button" @click="editingId = null">Cancel</button></div>
              </form>
            </div>
          </li>
        </ol>
        <p class="muted-copy sample-note">Sample itinerary · Edits reset on page reload. Weather uses city-level locations; real itinerary activities can supply venue coordinates. Day warnings check outdoor activity times, schedule overlaps and the trip budget.</p>
      </section>
      <section v-else-if="tab === 'Budget'">
        <p class="ui-notice">This planner is connected to the budget service. Budgets and expenses are saved separately for this preview trip.</p>
        <BudgetPlanner :key="selectedTrip.id" :trip-id="`preview-${selectedTrip.id}`" :destination-currency="selectedTrip.id === 'paris' ? 'EUR' : 'JPY'" embedded />
      </section>
      <section v-else-if="tab === 'Packing'">
        <p class="ui-notice">This checklist is connected to the checklist service. Items are saved separately for this preview trip.</p>
        <PackingChecklist
          :key="selectedTrip.id"
          :trip-id="`preview-${selectedTrip.id}`"
          embedded
        />
      </section>
      <section v-else class="surface"><h2>Your travel group</h2><p class="muted-copy">{{ selectedTrip.members }} · Sample members</p><div class="member-row" v-for="(name, index) in ['You', 'Alex']" :key="name"><span class="avatar">{{ name[0] }}</span><span>{{ name }}</span><span class="muted-copy">{{ index === 0 ? selectedTrip.role : 'Member' }}</span></div><p class="muted-copy mt-3 mb-0">Invitations and sharing will be available when group access is connected.</p></section>
    </template>
    <template v-else>
      <div class="page-top">
        <div><h1 class="page-heading">{{ title }}</h1></div>
      </div>
      <form v-if="route.path === '/trips/new'" class="surface form-stack trip-form" @submit.prevent>
        <label for="trip-name">Trip name<input id="trip-name" v-model="tripName" placeholder="Our next adventure" required /></label>
        <label for="trip-destination">Destination<input id="trip-destination" v-model="destination" placeholder="Where are you heading?" required /></label>
        <label for="trip-start">Start date<input id="trip-start" v-model="startDate" type="date" required /></label>
        <label for="trip-end">End date<input id="trip-end" v-model="endDate" type="date" :min="startDate" required /></label>
        <p class="muted-copy">Creating trips will be available when trip storage is connected.</p>
        <button class="secondary-action" type="button" disabled>Create trip — coming soon</button>
      </form>
      <div v-else-if="previewMode && route.path === '/trips'" class="trip-grid">
        <article v-for="trip in trips" :key="trip.id" class="trip-card stamp-card">
          <img :src="trip.image" :alt="trip.place" />
          <div class="trip-card-body"><div class="card-labels"><span class="sample-badge">{{ trip.role }}</span><span class="muted-copy small">Sample trip</span></div><h2>{{ trip.name }}</h2><p class="muted-copy">{{ trip.place }}<br>{{ trip.dates }}</p><div class="card-footer-row"><span class="muted-copy">{{ trip.members }}</span><RouterLink class="secondary-action" :to="`/trips/preview/${trip.id}`">View trip →</RouterLink></div></div>
        </article>
      </div>
      <section v-else-if="user && route.path === '/profile'" class="surface profile-panel">
        <span class="avatar large">{{ (user.name || '?')[0].toUpperCase() }}</span>
        <h2 class="mt-3">{{ user.name }}</h2>
        <p class="muted-copy">{{ user.email }}</p>
        <div class="action-row">
          <RouterLink class="secondary-action" to="/quiz">Take the preference quiz</RouterLink>
          <button type="button" class="secondary-action" @click="signOut">Log out</button>
        </div>
      </section>
      <section v-else-if="previewMode && route.path === '/profile'" class="surface profile-panel"><span class="avatar large">T</span><h2 class="mt-3">Preview traveller</h2><p class="muted-copy">traveller@example.com · Sample profile</p><hr><h3 class="h5">Travel preferences</h3><p class="muted-copy">Culture and food · A relaxed pace · Exploring anywhere</p><RouterLink class="secondary-action" to="/quiz">Take the preference quiz</RouterLink></section>
      <section v-else-if="previewMode && route.path === '/saved'" class="surface"><h2>Your inspiration starts here</h2><p class="muted-copy">Places you save will appear here when account storage is connected. Saving is unavailable in preview mode.</p><RouterLink class="secondary-action" to="/discover">Explore destinations</RouterLink></section>
      <section v-else class="surface"><p class="muted-copy">This account area is ready for integration. Trip storage and account features are not connected yet.</p><RouterLink class="secondary-action" to="/discover">Explore destinations</RouterLink></section>
    </template>
  </main>
</template>
<style scoped>
.itinerary-page { position: relative; isolation: isolate; }
.itinerary-page .surface { background: rgb(var(--travel-panel-rgb) / .94); }
.atmosphere-caption { margin-bottom: 1.1rem; }
.atmosphere-label { color: var(--travel-accent); font-size: .85rem; }
.atmosphere-label span { color: var(--travel-muted); font-size: .75rem; }
.page-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
.trip-form, .profile-panel { max-width: 650px; }
button:disabled { opacity: .65; cursor: not-allowed; }
.trip-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
.trip-card > img { display: block; width: 100%; height: 220px; object-fit: cover; }
.trip-card-body { padding: 1.5rem; background: var(--travel-panel); }
.trip-card h2 { margin-top: 1rem; font-size: 1.5rem; }
.card-labels, .card-footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.sample-badge { display: inline-flex; padding: .35rem .8rem; border-radius: 999px; background: var(--travel-selected); color: var(--travel-selected-text); font-size: .8rem; }
.trip-tabs { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.5rem; }
.trip-tabs button { padding: .7rem 1.3rem; border: 1px solid var(--travel-action-border); border-radius: 999px; background: transparent; color: var(--travel-text); }
.trip-tabs button[aria-pressed="true"] { background: var(--travel-strong); border-color: var(--travel-accent); }
.day-navigation { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: 1.25rem; }
.day-navigation button { display: grid; gap: .25rem; min-width: 100px; padding: .75rem 1rem; border: 1px solid var(--travel-action-border); border-radius: .85rem; background: var(--travel-panel); color: var(--travel-text); text-align: left; }
.day-navigation button span { font-size: .8rem; color: var(--travel-muted); }
.day-navigation button[aria-pressed="true"] { border-color: var(--travel-accent); background: var(--travel-selected); }
.day-heading { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.day-heading h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
.day-heading p:last-child { margin: .5rem 0 0; }
.activities { display: grid; gap: 1rem; list-style: none; margin: 1.5rem 0; padding: 0; }
.activities .weather-activity { display: flex; gap: 1.5rem; padding: 1.5rem; }
.activity-time { display: grid; align-content: start; gap: .3rem; min-width: 55px; color: var(--travel-muted); font-size: .8rem; }
.activity-time time { color: var(--travel-accent); font-size: 1rem; font-weight: 650; }
.activity-body { min-width: 0; flex: 1; }
.activity-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; }
.activity-heading h3 { font-size: 1.1rem; margin: 0; }
.activity-description { font-size: .9rem; margin: .5rem 0 1rem; }
.activity-edit-button { margin-top: .75rem; padding: .3rem .7rem; border: 1px solid var(--travel-action-border); border-radius: 999px; background: transparent; color: var(--travel-muted); font-size: .8rem; }
.activity-editor { margin-top: 1rem; max-width: 500px; padding: 1rem; border: 1px solid var(--travel-border); border-radius: .75rem; }
.activity-time-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
.activity-editor .action-row button { font-size: .85rem; padding: .5rem 1rem; }
.sample-note { font-size: .8rem; }
@media (max-width: 500px) { .activities .weather-activity { gap: .8rem; padding: 1rem; } .day-navigation button { min-width: 85px; flex: 1; } }
.packing-list { padding-left: 1.25rem; line-height: 2.5; }
.member-row { display: flex; align-items: center; gap: 1rem; padding: .75rem 0; }
.avatar { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--travel-strong); color: var(--travel-on-strong); }
.avatar.large { width: 72px; height: 72px; font-size: 2rem; }
@media (max-width: 700px) { .trip-grid { grid-template-columns: 1fr; } }
</style>
