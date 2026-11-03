<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Globe from 'globe.gl'
import DestinationCard from '../../components/DestinationCard.vue'
import { DESTINATIONS } from '../data/destinations.js'

const EARTH = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png'
const SNAP_DEGREES = 15 // how close a drop must be to count as a pin
const DEFAULT_HINT = 'Drag your traveller onto a glowing pin'

const route = useRoute()
const router = useRouter()
const search = ref('')
// Only show matches while the user is typing.
const results = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  return DESTINATIONS.filter(d => `${d.city} ${d.country}`.toLowerCase().includes(q))
})
const globeEl = ref(null)
const selected = ref(null)
const hovered = ref(null)
const dragging = ref(false)
const hint = ref(DEFAULT_HINT)

let globe = null
let resizeObserver = null

// Find the closest destination to a lat/lng, or null if none is within SNAP_DEGREES.
function nearestDestination(lat, lng) {
  let best = null
  let bestDist = Infinity
  for (const d of DESTINATIONS) {
    const dLat = d.lat - lat
    const dLng = ((d.lng - lng + 540) % 360) - 180 // handles crossing the date line
    const dist = Math.hypot(dLat, dLng * Math.cos((lat * Math.PI) / 180))
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  return bestDist <= SNAP_DEGREES ? best : null
}

// Convert a drag event's screen position into lat/lng on the globe.
function coordsFromEvent(e) {
  const r = globeEl.value.getBoundingClientRect()
  return globe.toGlobeCoords(e.clientX - r.left, e.clientY - r.top) // null if not over the globe
}

function applyPins() {
  if (!globe) return
  globe
    .pointsData(DESTINATIONS)
    .pointAltitude((d) => (d === selected.value ? 0.45 : d === hovered.value ? 0.32 : 0.18))
    .pointRadius((d) => (d === hovered.value ? 0.5 : 0.3))
    .pointColor((d) => (d === hovered.value ? '#ffffff' : 'rgba(255,210,127,0.9)'))
}
watch([selected, hovered], applyPins)

// Shows the destination card on the left and flies the globe to the place.
function selectDestination(d) {
  selected.value = d
  hint.value = ''
  if (route.query.destination !== d.id) {
    router.replace({ path: '/discover', query: { ...route.query, destination: d.id } })
  }
  globe.controls().autoRotate = false
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 1200)
}

// Picking a match from the search box.
function pickFromSearch(d) {
  search.value = ''
  selectDestination(d)
}

// Closing the card brings the intro text back on the left.
function close() {
  selected.value = null
  hint.value = DEFAULT_HINT
  const { destination, ...query } = route.query
  router.replace({ path: '/discover', query })
  globe.controls().autoRotate = true
  const pov = globe.pointOfView()
  globe.pointOfView({ ...pov, altitude: 2.6 }, 1000)
}

function addToItinerary(d) {
  router.push({ path: '/trips/new', query: { destination: d.city, country: d.country, from: route.fullPath } })
}

function savePlace(d) {
  router.push({ path: '/saved', query: { destination: d.id, from: route.fullPath } })
}

function selectFromRoute() {
  const d = DESTINATIONS.find(d => d.id === route.query.destination)
  if (d && globe) selectDestination(d)
}
watch(() => route.query.destination, selectFromRoute)

// ----- drag and drop -----
function onDragStart(e) {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', 'traveller') // Firefox needs some data set
  dragging.value = true
}

function onDragEnd() {
  dragging.value = false
  hovered.value = null
}

function onDragOver(e) {
  if (!dragging.value) return
  e.preventDefault() // allows dropping
  const c = coordsFromEvent(e)
  const d = c ? nearestDestination(c.lat, c.lng) : null
  if (d !== hovered.value) hovered.value = d
}

function onDrop(e) {
  if (!dragging.value) return
  e.preventDefault()
  const c = coordsFromEvent(e)
  const d = c ? nearestDestination(c.lat, c.lng) : null
  dragging.value = false
  hovered.value = null
  if (d) selectDestination(d)
  else hint.value = 'Drop closer to a glowing pin'
}

onMounted(() => {
  globe = new Globe(globeEl.value, { animateIn: true })
    .globeImageUrl(EARTH)
    .bumpImageUrl(BUMP)
    .backgroundColor('rgba(0,0,0,0)')
    .atmosphereColor('#6fb3ff')
    .atmosphereAltitude(0.2)
    .ringsData(DESTINATIONS) // pulsing ring at each pin's base
    .ringColor(() => (t) => `rgba(255,210,127,${1 - t})`)
    .ringMaxRadius(2.5)
    .ringPropagationSpeed(1.2)
    .ringRepeatPeriod(1400)
    .onPointClick(selectDestination)

  applyPins()

  const controls = globe.controls()
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.5
  controls.enableZoom = false

  globe.pointOfView({ lat: 20, lng: 20, altitude: 2.6 })

  const size = () => globe.width(globeEl.value.clientWidth).height(globeEl.value.clientHeight)
  size()
  resizeObserver = new ResizeObserver(size)
  resizeObserver.observe(globeEl.value)
  selectFromRoute()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  globe?._destructor?.()
  globe = null
})
</script>

<template>
  <div class="discover row g-0">
    <!-- Left column: intro text, or the destination card once a place is picked -->
    <aside class="col-12 col-lg-4 left-panel">
      <Transition name="slide-left" mode="out-in">
        <section v-if="!selected" key="intro" class="intro-view d-flex flex-column justify-content-center p-4 p-lg-5">
          <p class="eyebrow">Find your next adventure</p>
          <h1 class="page-heading">Discover somewhere new.</h1>
          <p class="muted-copy">Explore the globe, get a recommendation, or let a little curiosity lead the way.</p>
        </section>
        <div v-else key="card" class="card-view d-flex justify-content-center align-items-center py-3 py-lg-0">
          <DestinationCard :destination="selected" @close="close" @add="addToItinerary" @save="savePlace" />
        </div>
      </Transition>
    </aside>

    <!-- Right column: globe with the search bar on top -->
    <main class="col-12 col-lg-8 globe-wrap position-relative overflow-hidden pt-3" @dragover="onDragOver"
      @drop="onDrop">
      <div class="search-box position-absolute top-0 start-50 translate-middle-x mt-3">
        <input id="destination-search" v-model="search" type="search" class="form-control form-control-md search-input"
          placeholder="Search by city or country" aria-label="Find a destination" />
        <div v-if="search.trim()" class="list-group search-results" aria-label="Destinations">
          <button v-for="d in results" :key="d.id" type="button" class="list-group-item list-group-item-action"
            @click="pickFromSearch(d)">
            {{ d.city }} <span class="country">{{ d.country }}</span>
          </button>
          <div v-if="!results.length" class="list-group-item text-muted">
            No destinations found. Try another city or country.
          </div>
        </div>
      </div>

      <div ref="globeEl" class="globe" :class="{ targeting: dragging }"></div>

      <p v-if="hint" class="hint position-absolute start-50 translate-middle-x text-center small pe-none">
        {{ hint }}
      </p>

      <div class="traveller position-absolute d-flex align-items-center justify-content-center rounded-circle"
        draggable="true" title="Drag me onto a destination" @dragstart="onDragStart" @dragend="onDragEnd">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
        </svg>
      </div>
    </main>
  </div>
</template>

<style scoped>
.discover {
  flex: 1;
  min-height: 0;
  background: var(--travel-bg);
  color: #fff;
}

.left-panel {
  min-height: 0;
  overflow-y: auto;
}

.intro-view,
.card-view {
  height: 100%;
}

/* Remove the card's own outside margin so it sits neatly in the column */
.card-view :deep(.dest-card) {
  margin: 0;
}

/* Globe area */
.globe-wrap {
  min-height: 0;
  background: radial-gradient(ellipse at center, #1c3561 0%, #101a2e 70%);
}

.globe {
  position: absolute;
  inset: 0;
  cursor: grab;
  mask-image: radial-gradient(ellipse at center, #000 62%, transparent 100%);
}

.globe.targeting {
  cursor: crosshair;
}

/* Search bar on top of the globe */
.search-box {
  width: min(90%, 420px);
  z-index: 6;
}

.search-input {
  background: var(--travel-panel);
  color: #fff;
  border: 1px solid var(--travel-border);
  border-radius: 0.6rem;
}

.search-input::placeholder {
  color: var(--travel-muted);
}

.search-input:focus {
  background: var(--travel-panel);
  color: #fff;
  border-color: var(--travel-accent);
  box-shadow: none;
}

.search-results {
  margin-top: 0.4rem;
  max-height: 260px;
  overflow-y: auto;
  border-radius: 0.6rem;
  border: 1px solid var(--travel-border);
}

.search-results .list-group-item {
  background: var(--travel-panel);
  color: #fff;
  border-color: var(--travel-border);
}

.search-results .list-group-item-action:hover,
.search-results .list-group-item-action:focus {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.country {
  color: var(--travel-muted);
  font-size: 0.8rem;
  margin-left: 0.3rem;
}

.hint {
  top: 84px;
  width: 90%;
  color: #9db4cf;
  z-index: 5;
}

.traveller {
  right: 28px;
  bottom: 28px;
  z-index: 5;
  width: 52px;
  height: 52px;
  background: #ffd27f;
  color: #0d1a33;
  cursor: grab;
  box-shadow: 0 0 24px rgba(255, 210, 127, 0.6);
}

.traveller:active {
  cursor: grabbing;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

/* Below Bootstrap's large breakpoint (992px) the columns stack: intro/card on top, globe below */
@media (max-width: 991.98px) {

  .intro-view,
  .card-view {
    height: auto;
  }

  .globe-wrap {
    min-height: 520px;
  }
}
</style>