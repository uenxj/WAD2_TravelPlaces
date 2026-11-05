<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ActivityConditions from '../components/ActivityConditions.vue'
import PlaneLoader from '../components/PlaneLoader.vue'
import { localDate } from '../weather/conditions.js'
import { searchLocations } from '../weather/api.js'
import { DESTINATIONS } from '../data/destinations.js'

const timezones = { paris: 'Europe/Paris', tokyo: 'Asia/Tokyo', cairo: 'Africa/Cairo', rio: 'America/Sao_Paulo', sydney: 'Australia/Sydney', nyc: 'America/New_York', singapore: 'Asia/Singapore', 'cape-town': 'Africa/Johannesburg' }
const route = useRoute()
const initial = DESTINATIONS.find(d => d.id === route.query.destination) ?? DESTINATIONS.find(d => d.id === 'tokyo')
const fromDestination = d => ({ name: d.city, country: d.country, latitude: d.lat, longitude: d.lng, timezone: timezones[d.id] })
const location = ref(fromDestination(initial))
const query = ref('')
const matches = ref([])
const searching = ref(false)
const searchMessage = ref('')
let searchGeneration = 0
const date = ref(localDate(location.value.timezone))
const startTime = ref('09:00')
const endTime = ref('17:00')
const environment = ref('outdoor')
const daySummary = computed(() => ({ ...activity.value, startTime: '00:00', endTime: '23:59', environment: 'outdoor' }))
const activity = computed(() => ({ id: 'weather-check', name: 'Your planned activity', ...location.value, date: date.value, startTime: startTime.value, endTime: endTime.value, environment: environment.value }))
async function search() {
  const generation = ++searchGeneration
  matches.value = []
  searching.value = true
  searchMessage.value = ''
  try {
    const results = await searchLocations(query.value)
    if (generation !== searchGeneration) return
    matches.value = results
    if (!results.length) searchMessage.value = 'No matching locations. Try a city name and country.'
  } catch { if (generation === searchGeneration) searchMessage.value = 'Location search is unavailable. Try again or choose a destination below.' }
  finally { if (generation === searchGeneration) searching.value = false }
}
function choose(value) { location.value = value; matches.value = []; searchMessage.value = ''; searchGeneration++; searching.value = false }
</script>

<template>
  <main class="content-page weather-page">
    <header class="weather-intro">
      <p class="eyebrow">Plan for the conditions</p>
      <h1 class="page-heading">Weather &amp; air quality</h1>
      <p class="muted-copy">A little preparation, a better day out. Check a destination and date before adding an outdoor activity to your itinerary.</p>
    </header>
    <div class="weather-layout">
      <section class="surface weather-controls" aria-label="Activity details">
        <h2>Your plans</h2>
        <form class="form-stack" @submit.prevent="search">
          <label for="weather-city">Search a city<input id="weather-city" v-model="query" type="search" placeholder="e.g. Kyoto, Japan" minlength="2" required /></label>
          <button class="secondary-action" :disabled="searching" type="submit">{{ searching ? 'Searching…' : 'Find location' }}</button>
        </form>
        <PlaneLoader v-if="searching" compact class="mt-3" label="Searching locations…" />
        <p v-if="searchMessage" role="status" class="muted-copy mt-3">{{ searchMessage }}</p>
        <ul v-if="matches.length" class="location-results" aria-label="Matching locations">
          <li v-for="match in matches" :key="match.id"><button type="button" @click="choose(match)">{{ match.name }} · {{ match.region }} · {{ match.country }}</button></li>
        </ul>
        <div class="quick-locations" aria-label="Popular destinations">
          <button v-for="id in ['tokyo', 'singapore', 'paris']" :key="id" class="secondary-action" type="button" @click="choose(fromDestination(DESTINATIONS.find(d => d.id === id)))">{{ DESTINATIONS.find(d => d.id === id).city }}</button>
        </div>
        <p class="selected-location"><strong>{{ location.name }}, {{ location.country }}</strong><br><span class="muted-copy">{{ location.timezone }} · Local destination time</span></p>
        <div class="form-stack">
          <label for="weather-date">Activity date<input id="weather-date" v-model="date" type="date" :min="localDate(location.timezone)" required /></label>
          <div class="time-fields">
            <label for="weather-start">Start time<input id="weather-start" v-model="startTime" type="time" required /></label>
            <label for="weather-end">End time<input id="weather-end" v-model="endTime" type="time" required /></label>
          </div>
          <label for="weather-environment">Activity setting<select id="weather-environment" v-model="environment"><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option><option value="mixed">Indoor &amp; outdoor</option></select></label>
        </div>
      </section>
      <div class="weather-main">
        <section class="surface"><ActivityConditions :activity="daySummary" :activities="[activity]" /></section>
        <section class="surface mt-4" aria-label="Selected activity conditions"><h2 class="h5 mb-3">During your activity · {{ startTime }}–{{ endTime }}</h2><ActivityConditions :activity="activity" compact /></section>
        <aside class="ui-notice mt-4">
          <strong>Planning months ahead?</strong>
          <p>Dates beyond the weather forecast window use the same month's historical conditions from the last 10 complete years. Wet-day frequency describes the past; it is not the chance of rain on your chosen date.</p>
          <p class="mb-0">Weather forecasts extend up to 16 days. Air quality has a shorter window of up to 7 days, depending on location. Reopen your plan closer to departure for updated conditions.</p>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.weather-intro { max-width: 760px; margin-bottom: 2rem; }
.weather-layout { display: grid; grid-template-columns: minmax(250px, .8fr) minmax(0, 1.8fr); gap: 1.5rem; align-items: start; }
.weather-controls { padding: 1.5rem; }
.weather-controls h2 { font-size: 1.3rem; margin-bottom: 1.25rem; }
.weather-controls input::placeholder { color: var(--travel-muted); opacity: 1; }
.time-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
.quick-locations { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1.25rem 0; }
.quick-locations button { font-size: .8rem; padding: .4rem .7rem; }
.selected-location { line-height: 1.7; font-size: .9rem; overflow-wrap: anywhere; }
.location-results { padding: 0; margin: 1rem 0; list-style: none; }
.location-results button { width: 100%; background: var(--travel-bg); color: var(--travel-text); border: 1px solid var(--travel-action-border); padding: .7rem; text-align: left; border-radius: .5rem; margin-bottom: .4rem; }
.weather-main { min-width: 0; }
.ui-notice p { margin-top: .65rem; }
@media (max-width: 900px) { .weather-layout { grid-template-columns: 1fr; } }
</style>
