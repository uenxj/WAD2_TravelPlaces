<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReducedMotion } from '../composables/useReducedMotion.js'
import Globe from 'globe.gl'
import DestinationCard from '../../components/DestinationCard.vue'
import { DESTINATIONS } from '../data/destinations.js'

const EARTH = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png'
const SNAP_DEGREES = 15 // how close a drop must be to count as a pin
const DEFAULT_HINT = 'Search for a destination or drag your traveller onto a glowing pin'

const reducedMotion = useReducedMotion()
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
const pagesEl = ref(null) // the scrolling wrapper around the two pages
const isCompact = () => window.matchMedia('(max-width: 767.98px)').matches // true on phones and tablets

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

// Shows the destination card and flies the globe to the place.
function selectDestination(d) {
  selected.value = d
  hint.value = ''
  if (route.query.destination !== d.id) {
    router.replace({ path: '/discover', query: { ...route.query, destination: d.id } })
  }
  globe.controls().autoRotate = false
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, reducedMotion.value ? 0 : 1200)
  // On phones/tablets the card replaces the globe, so jump back to the top of the page
  if (isCompact() && pagesEl.value) pagesEl.value.scrollTop = 0
}

function focusDestination() {
  document.querySelector('.card-view h1')?.focus({ preventScroll: true })
}

// Picking a match from the search box.
function pickFromSearch(d) {
  search.value = ''
  selectDestination(d)
}


// Closing the card brings back the same globe view as when the page first loads.
function close() {
  selected.value = null
  document.getElementById('destination-search')?.focus()
  hint.value = DEFAULT_HINT
  const { destination, ...query } = route.query
  router.replace({ path: '/discover', query })
  globe.controls().autoRotate = !reducedMotion.value
  globe.pointOfView({ lat: 20, lng: 20, altitude: 2.6 }, reducedMotion.value ? 0 : 1000)
  if (isCompact()) {
    // A short wait lets the globe appear on the page before we scroll down to it
    setTimeout(() => {
      pagesEl.value?.scrollTo({ top: pagesEl.value.scrollHeight, behavior: reducedMotion.value ? 'instant' : 'smooth' })
    }, 50)
  }
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

watch(reducedMotion, () => {
  if (!globe) return
  globe.controls().autoRotate = !reducedMotion.value && !selected.value
  globe.controls().enableDamping = !reducedMotion.value
  globe.ringsData(reducedMotion.value ? [] : DESTINATIONS)
})

onMounted(() => {
  globe = new Globe(globeEl.value, { animateIn: !reducedMotion.value })
    .globeImageUrl(EARTH)
    .bumpImageUrl(BUMP)
    .backgroundColor('rgba(0,0,0,0)')
    .atmosphereColor('#6fb3ff')
    .atmosphereAltitude(0.2)
    .ringsData(reducedMotion.value ? [] : DESTINATIONS) // pulsing ring at each pin's base
    .ringColor(() => (t) => `rgba(255,210,127,${1 - t})`)
    .ringMaxRadius(2.5)
    .ringPropagationSpeed(1.2)
    .ringRepeatPeriod(1400)
    .onPointClick(selectDestination)

  applyPins()

  const controls = globe.controls()
  controls.autoRotate = !reducedMotion.value
  controls.enableDamping = !reducedMotion.value
  controls.autoRotateSpeed = 0.5
  controls.enableZoom = false

  globe.pointOfView({ lat: 20, lng: 20, altitude: 2.6 })

  // Skip while the globe is hidden (phone/tablet card view) so it keeps its last size
  const size = () => {
    const w = globeEl.value.clientWidth
    const h = globeEl.value.clientHeight
    if (w && h) globe.width(w).height(h)
  }
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
  <main class="discover" :class="{ 'is-selected': selected }">
    <div ref="pagesEl" class="discover-pages">
      <!-- Page 1: intro text, or the destination card once a place is picked -->
      <aside class="left-panel">
        <Transition name="slide-left" mode="out-in">
          <section v-if="!selected" key="intro" class="intro-view d-flex flex-column">
            <p class="eyebrow">Find your next adventure</p>
            <h1 class="page-heading">Discover somewhere new.</h1>
            <p class="muted-copy">Explore the globe, get a recommendation, or let a little curiosity lead the way.</p>
            <div class="action-row mt-3">
              <RouterLink class="secondary-action" to="/quiz">Travel Preference Quiz</RouterLink>
              <RouterLink class="secondary-action" to="/play">Guess the Country</RouterLink>
            </div>
          </section>
          <div v-else key="card" class="card-view d-flex justify-content-center align-items-center py-3 py-lg-0">
            <DestinationCard :destination="selected" @vue:mounted="focusDestination" @close="close" @add="addToItinerary" @save="savePlace" />
          </div>
        </Transition>
      </aside>
      <!-- Page 2: globe with the traveller to drag (hidden on phone/tablet while a card is open) -->
      <section aria-label="Destination globe" class="globe-wrap position-relative overflow-hidden" @dragover="onDragOver" @drop="onDrop">
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
      </section>
    </div>
  </main>

</template>

<style scoped>
.discover {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--travel-bg);
  color: #fff;
}

/* The two pages: intro/card first, globe second. Stacked and scrolled on phones and tablets. */
.discover-pages {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

.left-panel,
.globe-wrap {
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  scroll-snap-align: start;
}

.intro-view {
  height: 100%;
}

/* Grows with the card on small screens, so a tall card can still be scrolled */
.card-view {
  min-height: 100%;
}

/* Globe area */
.globe-wrap {
  background: radial-gradient(ellipse at center, #1c3561 0%, #101a2e 70%);
}

.globe {
  position: absolute;
  inset: 0;
  cursor: grab;
  /* Fade to zero at every canvas edge, including when the globe fills the view. */
  mask-image:
    linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / .15) 3%, rgb(0 0 0 / .5) 7%, rgb(0 0 0 / .85) 12%, #000 18%, #000 82%, rgb(0 0 0 / .85) 88%, rgb(0 0 0 / .5) 93%, rgb(0 0 0 / .15) 97%, transparent 100%),
    linear-gradient(to right, transparent 0%, rgb(0 0 0 / .5) 4%, #000 10%, #000 90%, rgb(0 0 0 / .5) 96%, transparent 100%);
  mask-composite: intersect;
  mask-repeat: no-repeat;
}

.globe.targeting {
  cursor: crosshair;
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
  transition: transform 300ms cubic-bezier(0.2, 0, 0, 1), opacity 300ms ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

/* Phones and tablets (767px and below) */
@media (max-width: 767.98px) {
  .discover-pages {
    scroll-snap-type: y proximity;
  }

  /* The intro is only as tall as its text, so the globe starts just below it */
  .left-panel {
    flex: 0 0 auto;
    height: auto;
  }

  .intro-view {
    height: auto;
    padding: 2rem 1.5rem 1.25rem;
  }

  /* Once a destination is picked, the card replaces the globe */
  .discover.is-selected .discover-pages {
    scroll-snap-type: none;
  }

  .discover.is-selected .globe-wrap {
    display: none;
  }
}

/* Laptop (768px and up): intro/card on the left, globe on the right, side by side */
@media (min-width: 768px) {
  .discover-pages {
    flex-direction: row;
    overflow: hidden;
    scroll-snap-type: none;
  }

  .left-panel {
    flex: 0 0 40%;
    width: 40%;
    overflow-y: auto;
  }

  .discover.is-selected .left-panel { overflow: hidden; }

  .card-view {
    height: 100%;
    min-height: 0;
  }

  /* Centres the intro text and gives it room on laptops */
  .intro-view {
    justify-content: center;
    padding: 2rem clamp(1.5rem, 3vw, 3rem);
  }

  .globe-wrap {
    flex: 1 1 auto;
    width: auto;
  }

  /* Remove the card's outside margin so it sits neatly in the column (laptop only) */
  .card-view :deep(.dest-card) {
    margin: 0;
  }
}
</style>
<style scoped>
@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active, .slide-left-leave-active { transition: opacity 150ms ease; }
  .slide-left-enter-from, .slide-left-leave-to { transform: none; }
}
</style>
