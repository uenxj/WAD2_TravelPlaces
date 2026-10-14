<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Globe from 'globe.gl'

const globeEl = ref(null)
const stepsEl = ref(null)

let globe = null
let resizeObserver = null
let revealObserver = null


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

    revealObserver = new IntersectionObserver(entries => {
        entries.forEach(e => e.isIntersecting && e.target.classList.add('visible'))
    }, { threshold: 0.2 })
    stepsEl.value.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el))
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    revealObserver?.disconnect()
    globe?._destructor?.()                    // frees the WebGL context when leaving the page
    globe = null
})
</script>

<template>
    <header class="hero">
        <div class="container hero-grid">
            <div class="hero-copy">
                <h1 class="display-1 fw-bold text-center">Where to next?</h1>
                <p class="lead">
                    Not sure where to travel? Guess a mystery place, find out which country it is,
                    then explore its places of interest.
                </p>
                <RouterLink to="/play" class="btn btn-warning btn-lg px-5 shadow">
                    Guess the Country
                </RouterLink>
                <p class="hint">Drag the globe to spin it. Click anywhere to fly there.</p>
            </div>

            <div ref="globeEl" class="globe" aria-label="Interactive 3D globe with flight routes"></div>
        </div>
    </header>

    <section ref="stepsEl" class="steps py-5">
        <div class="container">
            <h2 class="text-center fw-bold mb-5">How it works</h2>
            <div class="row g-4 justify-content-center">
                <div class="col-md-4 reveal" style="--delay: 0ms">
                    <div class="step-card h-100">
                        <h3 class="h4">Guess</h3>
                        <p>See a mystery location and type which country you think it is.</p>
                    </div>
                </div>
                <div class="col-md-4 reveal" style="--delay: 120ms">
                    <div class="step-card h-100">
                        <h3 class="h4">Discover</h3>
                        <p>We reveal the answer with its flag, capital and region.</p>
                    </div>
                </div>
                <div class="col-md-4 reveal" style="--delay: 240ms">
                    <div class="step-card h-100">
                        <h3 class="h4">Explore</h3>
                        <p>Browse places of interest and save them to your trip.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.hero {
    position: relative;
    overflow: hidden;
    min-height: calc(100vh - 56px);
    display: flex;
    align-items: center;
    color: #fff;
    background:
        radial-gradient(1px 1px at 12% 20%, #fff, transparent),
        radial-gradient(1px 1px at 30% 70%, #fff, transparent),
        radial-gradient(1.5px 1.5px at 55% 15%, #fff, transparent),
        radial-gradient(1px 1px at 70% 60%, #fff, transparent),
        radial-gradient(1.5px 1.5px at 88% 30%, #fff, transparent),
        radial-gradient(1px 1px at 40% 40%, #fff, transparent),
        radial-gradient(1px 1px at 92% 82%, #fff, transparent),
        radial-gradient(ellipse at 70% 50%, #10305a 0%, #07101f 65%);
}

.hero-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    align-items: center;
    gap: 1rem;
}

.hero-copy .lead {
    max-width: 30rem;
    margin-bottom: 1.75rem;
    color: #d6e4f5;
}

.hint {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #9db4cf;
}

.globe {
    width: 100%;
    height: min(75vh, 640px);
    min-height: 340px;
    cursor: grab;
}

.globe:active {
    cursor: grabbing;
}

.plane {
    position: absolute;
    top: 16%;
    left: -80px;
    z-index: 2;
    color: #ffb703;
    transform: rotate(80deg);
    animation: fly 16s linear infinite;
    pointer-events: none;
}

.plane::after {
    content: '';
    position: absolute;
    top: -150px;
    left: 50%;
    width: 0;
    height: 140px;
    border-left: 3px dashed rgba(255, 255, 255, 0.45);
}

@keyframes fly {
    0% {
        left: -80px;
        top: 20%;
        opacity: 0;
    }

    8% {
        opacity: 1;
    }

    50% {
        top: 9%;
    }

    92% {
        opacity: 1;
    }

    100% {
        left: 105%;
        top: 18%;
        opacity: 0;
    }
}

.steps {
    background: #f4f8fc;
}

.reveal {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.6s ease var(--delay), transform 0.6s ease var(--delay);
}

.reveal.visible {
    opacity: 1;
    transform: none;
}

.step-card {
    padding: 2rem;
    background: #fff;
    border-radius: 1rem;
    border: 1px solid #dbe6f2;
    transform-style: preserve-3d;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.step-card:hover {
    transform: perspective(700px) rotateX(6deg) rotateY(-8deg) translateY(-6px);
    box-shadow: 0 18px 30px rgba(7, 16, 31, 0.18);
}

/* ---------- Small screens ---------- */
@media (max-width: 900px) {
    .hero-grid {
        grid-template-columns: 1fr;
        text-align: center;
    }

    .hero-copy .lead {
        margin-left: auto;
        margin-right: auto;
    }

    .hero {
        padding: 2rem 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .plane {
        animation: none;
        display: none;
    }

    .reveal {
        opacity: 1;
        transform: none;
        transition: none;
    }

    .step-card:hover {
        transform: none;
    }
}
</style>