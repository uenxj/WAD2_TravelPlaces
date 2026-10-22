<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Globe from 'globe.gl'
import SideNav from '../../components/SideNav.vue'
import DestinationCard from '../../components/DestinationCard.vue'
import { DESTINATIONS } from '../data/destinations.js'

const EARTH = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png'
const SNAP_DEGREES = 15 // how close a drop must be to count as a pin
const DEFAULT_HINT = 'Drag your traveller onto a glowing pin'

const navOpen = ref(false)
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

function selectDestination(d) {
  selected.value = d
  hint.value = ''
  globe.controls().autoRotate = false
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 1200)
}

function close() {
  selected.value = null
  hint.value = DEFAULT_HINT
  globe.controls().autoRotate = true
  const pov = globe.pointOfView()
  globe.pointOfView({ ...pov, altitude: 2.6 }, 1000)
}

function addToItinerary(d) {
  // TODO: store this in your itinerary state or send it to the API.
  console.log('Add to itinerary:', d.city)
}

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
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  globe?._destructor?.()
  globe = null
})
</script>

<template>
  <div class="discover">
    <SideNav v-model:open="navOpen" />

    <main class="stage">
      <Transition name="slide-left">
        <DestinationCard
          v-if="selected"
          :destination="selected"
          @close="close"
          @add="addToItinerary"
        />
      </Transition>

      <div class="globe-wrap" @dragover="onDragOver" @drop="onDrop">
        <div ref="globeEl" class="globe" :class="{ targeting: dragging }"></div>

        <p v-if="hint" class="hint">{{ hint }}</p>

        <div
          class="traveller"
          draggable="true"
          title="Drag me onto a destination"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.discover {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #060b16;
  color: #fff;
}

.stage {
  flex: 1;
  display: flex;
  position: relative;
  min-width: 0;
}

.globe-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
  background: radial-gradient(ellipse at center, #1c3561 0%, #0d1a33 35%, #040811 70%, #000 100%);
}

.globe {
  position: absolute;
  inset: 0;
  cursor: grab;
}

.globe.targeting {
  cursor: crosshair;
}

.hint {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: #9db4cf;
  font-size: 0.9rem;
  pointer-events: none;
  white-space: nowrap;
}

.traveller {
  position: absolute;
  right: 28px;
  bottom: 28px;
  z-index: 5;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
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

@media (max-width: 768px) {
  .discover {
    flex-direction: column;
  }
  .stage {
    flex-direction: column;
  }
}
</style>