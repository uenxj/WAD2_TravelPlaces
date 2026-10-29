<script setup>
import BudgetPlanner from './Budget.vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { previewMode } from '../services/preview.js'
const route = useRoute()
const tab = ref('Itinerary')
const title = computed(() => ({ '/trips': 'My Trips', '/trips/new': 'Create a trip', '/profile': 'Your profile', '/saved': 'Saved places' }[route.path] ?? 'Your trip'))
const destination = ref('')
watch(() => route.fullPath, () => { destination.value = typeof route.query.destination === 'string' ? route.query.destination : ''; tab.value = 'Itinerary' }, { immediate: true })
const tripName = ref('')
const startDate = ref('')
const endDate = ref('')
const trips = [
  { id: 'tokyo', name: 'Tokyo with friends', place: 'Tokyo, Japan', dates: '12–17 December 2026', members: '4 travellers', role: 'Organiser', image: '/locations/japan.jpg', activities: ['Explore Asakusa and Sensō-ji', 'Lunch with the group', 'Evening walk in Shibuya'] },
  { id: 'paris', name: 'A week in Paris', place: 'Paris, France', dates: '8–14 March 2027', members: '2 travellers', role: 'Member', image: '/locations/france.jpg', activities: ['Visit the Louvre', 'Lunch near the Seine', 'Explore Montmartre'] },
]
const selectedTrip = computed(() => trips.find(t => t.id === route.params.id) ?? trips[0])
const tripDetail = computed(() => route.path.startsWith('/trips/preview/'))
</script>
<template>
  <main class="content-page">
    <template v-if="previewMode && tripDetail">
      <RouterLink class="back-link" to="/trips">← My Trips</RouterLink>
      <div class="page-top mt-4">
        <div><p class="eyebrow">Sample group trip</p><h1 class="page-heading">{{ selectedTrip.name }}</h1><p class="muted-copy">{{ selectedTrip.place }} · {{ selectedTrip.dates }} · {{ selectedTrip.members }}</p></div>
        <span class="sample-badge">Preview trip</span>
      </div>
      <nav class="trip-tabs" aria-label="Trip sections">
        <button v-for="item in ['Itinerary', 'Budget', 'Packing', 'Members']" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item }}</button>
      </nav>
      <section v-if="tab === 'Itinerary'" class="surface">
        <p class="eyebrow">Day 1</p><h2>A day of discovery</h2>
        <p class="ui-notice">Weather: historical guidance until forecasts are available. Air quality: forecast not available yet.</p>
        <ol class="activities"><li v-for="(activity, index) in selectedTrip.activities" :key="activity"><time>{{ ['09:00', '12:30', '17:00'][index] }}</time><span>{{ activity }}</span></li></ol>
        <p class="muted-copy mb-0">This is a sample itinerary layout. Route optimisation and conflict checks are not running in this preview.</p>
      </section>
      <section v-else-if="tab === 'Budget'">
        <p class="ui-notice">This planner is connected to the budget service. Budgets and expenses are saved separately for this preview trip.</p>
        <BudgetPlanner :key="selectedTrip.id" :trip-id="`preview-${selectedTrip.id}`" :destination-currency="selectedTrip.id === 'paris' ? 'EUR' : 'JPY'" embedded />
      </section>
      <section v-else-if="tab === 'Packing'" class="surface"><h2>Packing checklist</h2><p class="muted-copy">Sample items for your next adventure.</p><ul class="packing-list"><li v-for="item in ['Passport and travel documents', 'Phone charger and travel adaptor', 'Comfortable walking shoes']" :key="item">{{ item }}</li></ul></section>
      <section v-else class="surface"><h2>Your travel group</h2><p class="muted-copy">{{ selectedTrip.members }} · Sample members</p><div class="member-row" v-for="(name, index) in ['You', 'Alex']" :key="name"><span class="avatar">{{ name[0] }}</span><span>{{ name }}</span><span class="muted-copy">{{ index === 0 ? selectedTrip.role : 'Member' }}</span></div><p class="muted-copy mt-3 mb-0">Invitations and sharing will be available when group access is connected.</p></section>
    </template>
    <template v-else>
      <div class="page-top">
        <div><p class="eyebrow">{{ route.path === '/trips' ? 'Your next adventures' : 'Your travel space' }}</p><h1 class="page-heading">{{ title }}</h1><p v-if="route.path === '/trips'" class="muted-copy">All the trips you organise or join, together in one place.</p></div>
        <RouterLink v-if="route.path === '/trips'" class="primary-action" to="/trips/new">+ Create trip</RouterLink>
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
        <article v-for="trip in trips" :key="trip.id" class="trip-card">
          <img :src="trip.image" :alt="trip.place" />
          <div class="trip-card-body"><div class="card-labels"><span class="sample-badge">{{ trip.role }}</span><span class="muted-copy small">Sample trip</span></div><h2>{{ trip.name }}</h2><p class="muted-copy">{{ trip.place }}<br>{{ trip.dates }}</p><div class="card-footer-row"><span class="muted-copy">{{ trip.members }}</span><RouterLink class="secondary-action" :to="`/trips/preview/${trip.id}`">View trip →</RouterLink></div></div>
        </article>
      </div>
      <section v-else-if="previewMode && route.path === '/profile'" class="surface profile-panel"><span class="avatar large">T</span><h2 class="mt-3">Preview traveller</h2><p class="muted-copy">traveller@example.com · Sample profile</p><hr><h3 class="h5">Travel preferences</h3><p class="muted-copy">Culture and food · A relaxed pace · Exploring anywhere</p><RouterLink class="secondary-action" to="/quiz">Take the preference quiz</RouterLink></section>
      <section v-else-if="previewMode && route.path === '/saved'" class="surface"><h2>Your inspiration starts here</h2><p class="muted-copy">Places you save will appear here when account storage is connected. Saving is unavailable in preview mode.</p><RouterLink class="secondary-action" to="/discover">Explore destinations</RouterLink></section>
      <section v-else class="surface"><p class="muted-copy">This account area is ready for integration. Trip storage and account features are not connected yet.</p><RouterLink class="secondary-action" to="/discover">Explore destinations</RouterLink></section>
    </template>
  </main>
</template>
<style scoped>
.page-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
.trip-form, .profile-panel { max-width: 650px; }
button:disabled { opacity: .65; cursor: not-allowed; }
.trip-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
.trip-card { overflow: hidden; border: 1px solid var(--travel-border); border-radius: 1.25rem; background: var(--travel-panel); }
.trip-card > img { width: 100%; height: 220px; object-fit: cover; }
.trip-card-body { padding: 1.5rem; }
.trip-card h2 { margin-top: 1rem; font-size: 1.5rem; }
.card-labels, .card-footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.sample-badge { display: inline-flex; padding: .35rem .8rem; border-radius: 999px; background: #29473f; color: #cce9df; font-size: .8rem; }
.back-link { color: var(--travel-accent); }
.trip-tabs { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.5rem; }
.trip-tabs button { padding: .7rem 1.3rem; border: 1px solid var(--travel-border); border-radius: 999px; background: transparent; color: var(--travel-text); }
.trip-tabs button[aria-pressed="true"] { background: #354d51; border-color: var(--travel-accent); }
.activities { list-style: none; margin: 1.5rem 0; padding: 0; }
.activities li { display: flex; gap: 1.5rem; padding: 1rem 0; border-bottom: 1px solid var(--travel-border); }
.activities time { color: var(--travel-accent); }
.packing-list { padding-left: 1.25rem; line-height: 2.5; }
.member-row { display: flex; align-items: center; gap: 1rem; padding: .75rem 0; }
.avatar { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #354d51; color: #fff; }
.avatar.large { width: 72px; height: 72px; font-size: 2rem; }
@media (max-width: 700px) { .trip-grid { grid-template-columns: 1fr; } }
</style>
