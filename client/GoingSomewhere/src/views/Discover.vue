<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReducedMotion } from '../composables/useReducedMotion.js'
import { useTheme, themeColor } from '../composables/useTheme.js'
import Globe from 'globe.gl'
import DestinationCard from '../../components/DestinationCard.vue'
import { DESTINATIONS } from '../data/destinations.js'

const EARTH_IMAGE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const BUMP_IMAGE_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png'
const DEFAULT_HINT = 'Click a glowing pin to explore a destination'
const WHOLE_GLOBE_VIEW = { lat: 20, lng: 20, altitude: 2.6 } // the whole globe
const PIN_VIEW_ALTITUDE = 2.2 // the globe turns to face the pin, without zooming in close (lower = closer)

const reducedMotion = useReducedMotion()
const { theme } = useTheme()
const route = useRoute()
const router = useRouter()

const globeElement = ref(null)
const pagesElement = ref(null) // the scrolling wrapper around the two pages
const selectedDestination = ref(null)
const hoveredDestination = ref(null)
const hint = ref(DEFAULT_HINT)

let globe = null
let resizeObserver = null

// On tablets and laptops the user can drag the divider to make the card column wider or narrower.
const MIN_PANEL_WIDTH = 300
const MIN_GLOBE_WIDTH = 300
const leftPanelWidth = ref(null) // in pixels; null means use the default width from the CSS
// Only the destination card can be resized; the intro panel keeps its default width.
const pagesStyle = computed(function () {
  if (!selectedDestination.value || !leftPanelWidth.value) return {}
  return { '--left-panel-width': leftPanelWidth.value + 'px' }
})

function startResize(event) {
  event.preventDefault()
  const pagesBox = pagesElement.value.getBoundingClientRect()

  function moveDivider(moveEvent) {
    const wantedWidth = moveEvent.clientX - pagesBox.left
    const widest = pagesBox.width - MIN_GLOBE_WIDTH
    leftPanelWidth.value = Math.min(Math.max(wantedWidth, MIN_PANEL_WIDTH), widest)
  }

  function stopResize() {
    window.removeEventListener('pointermove', moveDivider)
    window.removeEventListener('pointerup', stopResize)
    document.body.style.userSelect = ''
  }

  document.body.style.userSelect = 'none' // stops text from being selected while dragging
  window.addEventListener('pointermove', moveDivider)
  window.addEventListener('pointerup', stopResize)
}

function isPhoneOrTablet() {
  return window.matchMedia('(max-width: 767.98px)').matches
}

// Pin and ring colours come from app.css, so they follow the light/dark theme.
function pinColour() {
  return themeColor('--travel-discover-pin') || '#ffd27f'
}

// Turns a "#rrggbb" colour and an opacity into an rgba() string.
function hexToRgba(hexColour, opacity) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hexColour)
  if (!match) return hexColour
  const colourNumber = parseInt(match[1], 16)
  const red = (colourNumber >> 16) & 255
  const green = (colourNumber >> 8) & 255
  const blue = colourNumber & 255
  return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + opacity + ')'
}

// globe.gl calls this with a progress value from 0 (start of a ring) to 1 (end), and the ring fades out.
function ringColour() {
  return function (progress) {
    return hexToRgba(pinColour(), 1 - progress)
  }
}

function pinAltitude(place) {
  if (place === selectedDestination.value) return 0.45
  if (place === hoveredDestination.value) return 0.32
  return 0.18
}

function pinRadius(place) {
  return place === hoveredDestination.value ? 2.0 : 1.0;
}

function pinFill(place) {
  if (place === hoveredDestination.value) return themeColor('--travel-discover-pin-hover') || '#ffffff'
  return pinColour()
}

function applyPins() {
  if (!globe) return
  globe
    .pointsData(DESTINATIONS)
    .pointAltitude(pinAltitude)
    .pointRadius(pinRadius)
    .pointColor(pinFill)
}

watch([selectedDestination, hoveredDestination], applyPins)

// A dashed line through every destination, in the order they are listed in destinations.js.
function applyRoute() {
  if (!globe) return
  globe
    .pathsData([DESTINATIONS])
    .pathColor(function () {
      return hexToRgba(pinColour(), 0.7)
    })
    .pathStroke(0.6)
    .pathDashLength(0.15)
    .pathDashGap(0.08)
    .pathDashAnimateTime(reducedMotion.value ? 0 : 8000)
}

// Shows the destination card and turns the globe to face that place.
function selectDestination(destination) {
  selectedDestination.value = destination
  hint.value = ''
  if (route.query.destination !== destination.id) {
    router.replace({ path: '/discover', query: Object.assign({}, route.query, { destination: destination.id }) })
  }
  globe.controls().autoRotate = false
  globe.pointOfView(
    { lat: destination.lat, lng: destination.lng, altitude: PIN_VIEW_ALTITUDE },
    reducedMotion.value ? 0 : 1200,
  )
  // On phones and tablets the card replaces the globe, so jump back to the top of the page
  if (isPhoneOrTablet() && pagesElement.value) pagesElement.value.scrollTop = 0
}

function focusDestinationCard() {
  const heading = document.querySelector('.card-view h1')
  if (heading) heading.focus({ preventScroll: true })
}

// Closing the card brings back the same globe view as when the page first loads.
function closeCard() {
  selectedDestination.value = null
  const searchBox = document.getElementById('destination-search')
  if (searchBox) searchBox.focus()
  hint.value = DEFAULT_HINT
  const queryWithoutDestination = Object.assign({}, route.query)
  delete queryWithoutDestination.destination
  router.replace({ path: '/discover', query: queryWithoutDestination })
  globe.controls().autoRotate = !reducedMotion.value
  globe.pointOfView(WHOLE_GLOBE_VIEW, reducedMotion.value ? 0 : 1000)
  if (isPhoneOrTablet()) {
    // A short wait lets the globe appear on the page before we scroll down to it
    setTimeout(function () {
      if (!pagesElement.value) return
      pagesElement.value.scrollTo({
        top: pagesElement.value.scrollHeight,
        behavior: reducedMotion.value ? 'instant' : 'smooth',
      })
    }, 50)
  }
}

function addToItinerary(destination) {
  router.push({
    path: '/trips/new',
    query: { destination: destination.city, country: destination.country, from: route.fullPath },
  })
}

function savePlace(destination) {
  router.push({ path: '/saved', query: { destination: destination.id, from: route.fullPath } })
}

// Opens the pin named in the URL, such as /discover?destination=paris.
function selectFromRoute() {
  const destinationId = route.query.destination
  const destination = DESTINATIONS.find(function (place) {
    return place.id === destinationId
  })
  if (destination && globe) selectDestination(destination)
}

watch(function () { return route.query.destination }, selectFromRoute)

watch(reducedMotion, function () {
  if (!globe) return
  globe.controls().autoRotate = !reducedMotion.value && !selectedDestination.value
  globe.controls().enableDamping = !reducedMotion.value
  globe.ringsData(reducedMotion.value ? [] : DESTINATIONS)
  applyRoute()
})

// Changing the theme recolours the glow, pins and rings.
watch(theme, function () {
  if (!globe) return
  globe.atmosphereColor(themeColor('--travel-discover-atmosphere'))
  globe.ringColor(ringColour)
  applyPins()
  applyRoute()
})

onMounted(function () {
  globe = new Globe(globeElement.value, { animateIn: !reducedMotion.value })
    .globeImageUrl(EARTH_IMAGE_URL)
    .bumpImageUrl(BUMP_IMAGE_URL)
    .backgroundColor('rgba(0,0,0,0)')
    .atmosphereColor(themeColor('--travel-discover-atmosphere'))
    .atmosphereAltitude(0.2)
    .ringsData(reducedMotion.value ? [] : DESTINATIONS) // a pulsing ring at each pin's base
    .ringColor(ringColour)
    .ringMaxRadius(2.5)
    .ringPropagationSpeed(1.2)
    .ringRepeatPeriod(1400)
    .onPointClick(selectDestination)
    .onPointHover(function (place) {
      hoveredDestination.value = place
    })

  applyPins()
  applyRoute()

  const controls = globe.controls()
  controls.autoRotate = !reducedMotion.value
  controls.enableDamping = !reducedMotion.value
  controls.autoRotateSpeed = 0.5
  controls.enableZoom = false // pins turn the globe; the user does not zoom it

  globe.pointOfView(WHOLE_GLOBE_VIEW)

  // The globe is hidden on phones while a card is open, so only resize when it has a size
  const resizeGlobe = function () {
    const width = globeElement.value.clientWidth
    const height = globeElement.value.clientHeight
    if (width && height) globe.width(width).height(height)
  }
  resizeGlobe()
  resizeObserver = new ResizeObserver(resizeGlobe)
  resizeObserver.observe(globeElement.value)

  selectFromRoute()
})

onBeforeUnmount(function () {
  if (resizeObserver) resizeObserver.disconnect()
  if (globe) {
    if (globe._destructor) globe._destructor()
    globe = null
  }
})
</script>

<template>
  <main class="discover" :class="{ 'is-selected': selectedDestination }">
    <div ref="pagesElement" class="discover-pages" :style="pagesStyle">
      <!-- Page 1: intro text, or the destination card once a place is picked -->
      <aside class="left-panel">
        <Transition name="slide-left" mode="out-in">
          <section v-if="!selectedDestination" key="intro" class="intro-view d-flex flex-column">
            <h1 class="page-heading">Discover somewhere new.</h1>
            <p class="muted-copy">Explore the globe, get a recommendation, or let a little curiosity lead the way.</p>
            <div class="action-row mt-3">
              <RouterLink class="secondary-action" to="/quiz">Travel Preference Quiz</RouterLink>
              <RouterLink class="secondary-action" to="/play">Guess the Country</RouterLink>
            </div>
          </section>
          <div v-else key="card" class="card-view d-flex justify-content-center align-items-center py-3 py-lg-0">
            <DestinationCard :destination="selectedDestination" @vue:mounted="focusDestinationCard" @close="closeCard" @add="addToItinerary" @save="savePlace" />
          </div>
        </Transition>
      </aside>
      <div v-if="selectedDestination" class="panel-splitter" role="separator" aria-orientation="vertical" title="Drag to resize" @pointerdown="startResize"></div>
      <!-- Page 2: the globe. Click a pin to open its card and turn the globe to that place. -->
      <section aria-label="Destination globe" class="globe-wrap position-relative overflow-hidden">
        <div ref="globeElement" class="globe" :class="{ pointing: hoveredDestination }"></div>

        <p v-if="hint" class="hint position-absolute start-50 translate-middle-x text-center small pe-none">
          {{ hint }}
        </p>
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
  color: var(--travel-text-bright);
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
  background: radial-gradient(ellipse at center, var(--travel-globe-glow) 0%, var(--travel-bg) 70%);
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

.globe.pointing,
.globe.pointing :deep(canvas) {
  cursor: pointer;
}

.hint {
  top: 84px;
  width: 90%;
  color: var(--travel-globe-hint);
  z-index: 5;
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

/* The divider only shows on tablets and laptops, where the card and globe sit side by side */
.panel-splitter {
  display: none;
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

/* iPad and small laptops (768px to 1199px): side by side, with the card column a little wider */
@media (min-width: 768px) and (max-width: 1199.98px) {
  .panel-splitter {
    display: block;
    flex: 0 0 8px;
    cursor: col-resize;
    touch-action: none;
    background: var(--travel-discover-card-bg);
  }

  .discover-pages {
    flex-direction: row;
    overflow: hidden;
    scroll-snap-type: none;
  }

  .left-panel {
    flex: 0 0 var(--left-panel-width, 46%);
    width: var(--left-panel-width, 46%);
    overflow-y: auto;
  }

  .discover.is-selected .left-panel { overflow: hidden; }

  .card-view {
    height: 100%;
    min-height: 0;
  }

  .intro-view {
    justify-content: center;
    padding: 2rem clamp(1.5rem, 4vw, 2.5rem);
  }

  .globe-wrap {
    flex: 1 1 auto;
    width: auto;
  }
}

/* Laptops and desktops (1200px and up): intro/card on the left, globe on the right, side by side */
@media (min-width: 1200px) {
  .panel-splitter {
    display: block;
    flex: 0 0 8px;
    cursor: col-resize;
    touch-action: none;
    background: var(--travel-discover-card-bg);
  }

  .discover-pages {
    flex-direction: row;
    overflow: hidden;
    scroll-snap-type: none;
  }

  .left-panel {
    flex: 0 0 var(--left-panel-width, 40%);
    width: var(--left-panel-width, 40%);
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
}
</style>
<style scoped>
@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active, .slide-left-leave-active { transition: opacity 150ms ease; }
  .slide-left-enter-from, .slide-left-leave-to { transform: none; }
}
</style>