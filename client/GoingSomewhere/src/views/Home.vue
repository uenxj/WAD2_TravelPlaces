<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Globe from 'globe.gl'

const globeEl = ref(null)

let globe = null
let resizeObserver = null


const TEX = 'https://unpkg.com/three-globe/example/img'
const EARTH = `${TEX}/earth-blue-marble.jpg`
const BUMP = `${TEX}/earth-topology.png`

const PLACES = [
    { name: 'Paris', lat: 48.86, lng: 2.35 },
    { name: 'Tokyo', lat: 35.68, lng: 139.69 },
    { name: 'Cairo', lat: 30.04, lng: 31.24 },
    { name: 'Rio', lat: -22.91, lng: -43.17 },
    { name: 'Sydney', lat: -33.87, lng: 151.21 },
    { name: 'New York', lat: 40.71, lng: -74.0 },
    { name: 'Singapore', lat: 1.35, lng: 103.82 },
    { name: 'Cape Town', lat: -33.92, lng: 18.42 },
]

const byName = Object.fromEntries(PLACES.map(p => [p.name, p]))
const ROUTES = [
    ['Singapore', 'Tokyo'], ['Tokyo', 'Sydney'], ['Singapore', 'Paris'],
    ['Paris', 'New York'], ['New York', 'Rio'], ['Rio', 'Cape Town'],
    ['Cape Town', 'Cairo'], ['Cairo', 'Paris'], ['Sydney', 'Singapore'],
].map(([a, b]) => ({
    startLat: byName[a].lat, startLng: byName[a].lng,
    endLat: byName[b].lat, endLng: byName[b].lng,
}))

function sizeGlobe() {
    if (!globe || !globeEl.value) return
    globe.width(globeEl.value.clientWidth).height(globeEl.value.clientHeight)
}

onMounted(() => {
    globe = new Globe(globeEl.value, { animateIn: true })
        .globeImageUrl(EARTH)
        .bumpImageUrl(BUMP)
        .backgroundColor('rgba(0,0,0,0)')
        .atmosphereColor('#8ecae6')
        .atmosphereAltitude(0.25)

        .arcsData(ROUTES)
        .arcColor(() => ['rgba(255,183,3,0.95)', 'rgba(142,202,230,0.95)'])
        .arcStroke(0.45)
        .arcAltitudeAutoScale(0.45)
        .arcDashLength(0.4)
        .arcDashGap(0.25)
        .arcDashAnimateTime(2800)

        // City dots + pulsing rings
        .pointsData(PLACES)
        .pointColor(() => '#ffb703')
        .pointAltitude(0.015)
        .pointRadius(0.45)
        .pointLabel(d => `<b style="font-size:14px">${d.name}</b>`)
        .ringsData(PLACES)
        .ringColor(() => t => `rgba(255,183,3,${1 - t})`)
        .ringMaxRadius(4)
        .ringPropagationSpeed(2)
        .ringRepeatPeriod(1800)

        .onGlobeClick(({ lat, lng }) => {
            globe.controls().autoRotate = false
            globe.pointOfView({ lat, lng, altitude: 1.6 }, 1200)
        })
        .onPointClick(p => {
            globe.controls().autoRotate = false
            globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.4 }, 1200)
        })

    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.7
    controls.enableZoom = false

    globe.pointOfView({ lat: 25, lng: 100, altitude: 2.4 })
    sizeGlobe()

    resizeObserver = new ResizeObserver(sizeGlobe)
    resizeObserver.observe(globeEl.value)


})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    globe?._destructor?.()                    // frees the WebGL context when leaving the page
    globe = null
})
</script>

<template>
    <div class="landing-page">
        <main class="hero-grid">
            <section class="hero-copy" aria-labelledby="hero-title">
                <h1 id="hero-title">Managing your travels seamlessly</h1>
                <div class="app-description">
                    <h2>Your whole trip, in one place.</h2>
                    <p>
                        Discover somewhere new and bring your plans together with GoingSomewhere.
                        Explore destinations, organise your itinerary, and keep track of your
                        travel budget and packing list.
                    </p>
                    <p>
                        Plan with your travel group, find routes that work for you, and spot
                        schedule clashes, budget overruns, and weather or air quality concerns
                        before they get in the way of your adventure.
                    </p>
                </div>
                <RouterLink to="/discover" class="primary-action explore-action">Explore destinations <span aria-hidden="true">↗</span></RouterLink>
            </section>

            <figure class="globe-panel">
                <div ref="globeEl" class="globe" role="img"
                    aria-label="Interactive 3D globe with cities and animated flight routes"></div>
                <figcaption>Drag to explore. Click a city to take a closer look.</figcaption>
            </figure>
        </main>
    </div>
</template>

<style scoped>
.landing-page {
    --landing-background: #101a2e;
    --landing-text: #f5f5f3;
    --landing-muted: #bdc8d8;
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--landing-background);
    color: var(--landing-text);
}

.explore-action { margin-top: .5rem; }

.hero-grid {
    width: min(100%, 1440px);
    flex: 1;
    min-height: 0;
    margin-inline: auto;
    padding: 1rem 5% 2rem;
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: 3rem;
}

.hero-copy,
.globe-panel {
    min-width: 0;
}

.hero-copy h1 {
    max-width: 12ch;
    margin: 0 0 1.5rem;
    font-size: clamp(2.6rem, 4.6vw, 4.5rem);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.035em;
}

.app-description {
    max-width: 34rem;
}

.app-description h2 {
    margin-bottom: 1rem;
    font-size: clamp(1.2rem, 1.7vw, 1.5rem);
    font-weight: 600;
    line-height: 1.4;
}

.app-description p {
    margin: 0 0 1rem;
    color: var(--landing-muted);
    font-size: 1.05rem;
    line-height: 1.65;
}

.globe-panel {
    margin: 0;
    text-align: center;
}

.globe {
    width: 100%;
    height: min(40vw, 580px, calc(100svh - 200px));
    -webkit-mask-image: radial-gradient(ellipse at center, #000 62%, transparent 100%);
    mask-image: radial-gradient(ellipse at center, #000 62%, transparent 100%);
    cursor: grab;
    touch-action: pan-y;
}

.globe:active {
    cursor: grabbing;
}

.globe-panel figcaption {
    margin-top: 0.5rem;
    color: var(--landing-muted);
    font-size: 0.85rem;
}

@media (min-width: 801px) and (max-height: 760px) {
    .hero-copy h1 {
        margin-bottom: 1.5rem;
        font-size: clamp(2.6rem, 4vw, 3.5rem);
    }

    .app-description p {
        line-height: 1.6;
    }
}

@media (max-width: 800px) {
    .hero-grid {
        min-height: auto;
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 2.5rem 6% 2rem;
    }

    .hero-copy h1 {
        max-width: 15ch;
        margin-bottom: 1.75rem;
    }

    .app-description {
        max-width: 40rem;
    }

    .globe {
        height: clamp(300px, 75vw, 480px);
    }
}

</style>
