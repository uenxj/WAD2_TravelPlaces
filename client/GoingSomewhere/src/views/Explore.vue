<script setup>
import BackLink from '../components/BackLink.vue'
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { DESTINATIONS } from '../data/destinations.js'
import { LOCATIONS } from '../data/locations.js'

const route = useRoute()
const destination = computed(() => DESTINATIONS.find(d => d.country.toLowerCase() === String(route.params.country).toLowerCase()))
const countryName = computed(() => String(route.params.country))

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const loc = computed(() => LOCATIONS.find(l => norm(l.country) === norm(countryName.value)))
const name = computed(() => loc.value?.country ?? countryName.value)

const wiki = ref(null)      // { blurb, url, thumb }
const weather = ref(null)   // { now, days[] }
const coords = ref(null)
const loading = ref(true)
const mapMode = ref('capital')
let token = 0

/* ---------------- API helpers (all keyless) ---------------- */
async function fetchJson(url, { retries = 1, timeout = 6000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeout)
        try {
            const res = await fetch(url, { signal: ctrl.signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.json()
        } catch (err) {
            if (attempt === retries) throw err
        } finally {
            clearTimeout(timer)
        }
    }
}

async function fetchWiki(title) {
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    return {
        blurb: (d.extract ?? '').split(/(?<=\.)\s/).slice(0, 4).join(' '),
        url: d.content_urls?.desktop?.page ?? null,
        thumb: d.thumbnail?.source ?? null
    }
}

async function fetchCoords(l) {
    const d = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(l.capital)}&count=1&language=en&countryCode=${l.code.toUpperCase()}`
    )
    const hit = d.results?.[0]
    if (!hit) throw new Error('no match')
    return [hit.latitude, hit.longitude]
}

const WEATHER = [
    [[0], '☀️', 'Clear'],
    [[1, 2, 3], '⛅', 'Partly cloudy'],
    [[45, 48], '🌫️', 'Foggy'],
    [[51, 53, 55, 56, 57], '🌦️', 'Drizzle'],
    [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Rain'],
    [[71, 73, 75, 77, 85, 86], '❄️', 'Snow'],
    [[95, 96, 99], '⛈️', 'Thunderstorm']
]
const weatherInfo = code => {
    const [, icon, desc] = WEATHER.find(([codes]) => codes.includes(code)) ?? [[], '🌡️', 'Unknown']
    return { icon, desc }
}

async function fetchForecast([lat, lon]) {
    const d = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&forecast_days=5&timezone=auto`
    )
    const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' })
    return {
        now: { temp: Math.round(d.current.temperature_2m), ...weatherInfo(d.current.weather_code) },
        days: d.daily.time.map((date, i) => ({
            label: i === 0 ? 'Today' : weekday.format(new Date(date)),
            hi: Math.round(d.daily.temperature_2m_max[i]),
            lo: Math.round(d.daily.temperature_2m_min[i]),
            ...weatherInfo(d.daily.weather_code[i])
        }))
    }
}

async function load() {
    const t = ++token
    loading.value = true
    wiki.value = null
    weather.value = null
    mapMode.value = 'capital'
    coords.value = loc.value?.coords ?? null

    const [w, g] = await Promise.allSettled([
        fetchWiki(name.value),
        loc.value ? fetchCoords(loc.value) : Promise.reject(new Error('not in LOCATIONS'))
    ])
    if (t !== token) return
    if (w.status === 'fulfilled') wiki.value = w.value
    if (g.status === 'fulfilled') coords.value = g.value
    loading.value = false

    if (coords.value) {
        try {
            const f = await fetchForecast(coords.value)
            if (t === token) weather.value = f
        } catch (err) {
            console.error('Forecast unavailable', err)
        }
    }
}

watch(countryName, load, { immediate: true })

/* ---------------- derived view data ---------------- */
const heroSrc = computed(() => loc.value?.img ?? wiki.value?.thumb ?? null)
const flagSrc = computed(() => (loc.value ? `https://flagcdn.com/w80/${loc.value.code}.png` : null))

const facts = computed(() => {
    const l = loc.value
    if (!l) return []
    return [
        { label: 'Capital', value: l.capital },
        { label: 'Region', value: l.region },
        { label: 'Population', value: compact.format(l.population) },
        { label: 'Currency', value: l.currencies },
        { label: 'Languages', value: l.languages },
        ...(weather.value
            ? [{ label: `Right now in ${l.capital}`, value: `${weather.value.now.icon} ${weather.value.now.temp}°C, ${weather.value.now.desc}` }]
            : [])
    ]
})

const mapSrc = computed(() => {
    if (!coords.value) return null
    const [lat, lon] = coords.value
    const dx = mapMode.value === 'capital' ? 0.35 : 11
    const dy = mapMode.value === 'capital' ? 0.22 : 7
    const bbox = [lon - dx, lat - dy, lon + dx, lat + dy].join(',')
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
})
</script>

<template>
<main class="content-page">
<BackLink to="/discover">Back to Discover</BackLink>
<section class="surface mt-4">
<p class="eyebrow">A new place to explore</p>
<h1 class="page-heading">{{ route.params.country }}</h1>
<p class="muted-copy">{{ destination?.description ?? 'Turn your discovery into your next adventure. Start a trip and add the places you want to visit.' }}</p>
<div class="action-row">
<RouterLink v-if="destination" class="secondary-action" :to="{ path: '/discover', query: { destination: destination.id } }">Explore {{ destination.city }}</RouterLink>
<RouterLink class="primary-action" :to="{ path: '/trips/new', query: { destination: destination?.city ?? route.params.country, country: route.params.country, from: route.fullPath } }">Plan a trip here</RouterLink>
<BackLink to="/play">Back to game</BackLink>
</div>
</section>

    <section class="country-info" :aria-label="'About ' + name">
      <!-- hero photo -->
      <figure v-if="heroSrc" class="hero" style="--i: 0">
          <img :src="heroSrc" :alt="'Photo of ' + name" class="hero-img" />
          <figcaption class="hero-cap">
              <img v-if="flagSrc" :src="flagSrc" :alt="'Flag of ' + name" class="hero-flag" />
              <div>
                  <strong>{{ name }}</strong>
                  <span v-if="loc">{{ loc.clue }}</span>
              </div>
          </figcaption>
      </figure>

      <!-- quick facts -->
      <div v-if="facts.length" class="facts" style="--i: 1">
          <div v-for="f in facts" :key="f.label" class="fact">
              <span class="fact-label">{{ f.label }}</span>
              <span class="fact-value">{{ f.value }}</span>
          </div>
      </div>

      <!-- about -->
      <article class="surface block" style="--i: 2">
          <h2>About {{ name }}</h2>
          <template v-if="loading">
              <span class="shimmer w100"></span>
              <span class="shimmer w100"></span>
              <span class="shimmer w60"></span>
          </template>
          <template v-else-if="wiki?.blurb">
              <p>{{ wiki.blurb }}</p>
              <a v-if="wiki.url" :href="wiki.url" target="_blank" rel="noopener" class="source">
                  Read more on Wikipedia
              </a>
          </template>
          <p v-else class="muted-copy">We couldn't load a summary right now.</p>
      </article>

      <!-- 5-day forecast -->
      <article v-if="weather" class="surface block" style="--i: 3">
          <h2>Forecast for {{ loc?.capital ?? name }}</h2>
          <ul class="forecast">
              <li v-for="d in weather.days" :key="d.label">
                  <span class="day">{{ d.label }}</span>
                  <span class="icon" :title="d.desc" role="img" :aria-label="d.desc">{{ d.icon }}</span>
                  <span class="hi">{{ d.hi }}°</span>
                  <span class="lo">{{ d.lo }}°</span>
              </li>
          </ul>
      </article>

      <!-- map -->
      <article v-if="mapSrc" class="surface block map-block" style="--i: 4">
          <div class="map-head">
              <h2>Where is it?</h2>
              <div class="toggle" role="group" aria-label="Map zoom">
                  <button :class="{ on: mapMode === 'capital' }" @click="mapMode = 'capital'">Capital</button>
                  <button :class="{ on: mapMode === 'country' }" @click="mapMode = 'country'">Country</button>
              </div>
          </div>
          <iframe :src="mapSrc" :title="'Map of ' + name" loading="lazy"></iframe>
      </article>
  </section>
</main>
</template>

<style scoped>
.action-row { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
.action-row > * { margin: 0; }
.country-info { display: grid; gap: 1rem; margin-top: 1.5rem; }
.country-info > * { animation: rise .55s ease both; animation-delay: calc(var(--i, 0) * 90ms); }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } }

/* hero */
.hero { position: relative; margin: 0; height: clamp(220px, 38vw, 380px); border-radius: 22px; overflow: hidden; background: #24304a; }
.hero-img { width: 100%; height: 100%; object-fit: cover; display: block; animation: drift 20s ease-in-out infinite alternate; }
@keyframes drift { from { transform: scale(1.03); } to { transform: scale(1.12); } }
.hero-cap { position: absolute; inset: auto 0 0 0; display: flex; align-items: center; gap: .9rem; padding: 2.5rem 1.25rem 1.1rem; color: #fff; background: linear-gradient(transparent, rgba(0, 0, 0, .72)); }
.hero-cap div { display: flex; flex-direction: column; gap: .15rem; }
.hero-cap strong { font-size: 1.3rem; }
.hero-cap span { font-size: .9rem; opacity: .9; }
.hero-flag { height: 34px; width: auto; border-radius: 5px; box-shadow: 0 0 0 1px rgba(255, 255, 255, .35); }

/* facts (adapts to light and dark theme) */
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .7rem; }
.fact { display: flex; flex-direction: column; gap: .3rem; padding: .85rem 1rem; border-radius: 16px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); transition: transform .2s, border-color .2s; }
.fact:hover { transform: translateY(-3px); border-color: var(--travel-accent, #8fd3b6); }
.fact-label { font-size: .78rem; opacity: .7; }
.fact-value { font-weight: 600; }

/* cards */
.block { padding: 1.25rem 1.4rem; }
.block h2 { font-size: 1.15rem; margin: 0 0 .7rem; }
.block p { margin: 0; line-height: 1.65; max-width: 68ch; }
.source { display: inline-block; margin-top: .7rem; color: var(--travel-accent, #8fd3b6); font-size: .9rem; }

.shimmer { display: block; height: 14px; border-radius: 6px; margin-bottom: .6rem; background: linear-gradient(90deg, color-mix(in srgb, currentColor 10%, transparent) 25%, color-mix(in srgb, currentColor 20%, transparent) 50%, color-mix(in srgb, currentColor 10%, transparent) 75%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
.w100 { width: 100%; } .w60 { width: 60%; }
@keyframes shimmer { to { background-position: -200% 0; } }

/* forecast */
.forecast { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .6rem; }
.forecast li { display: flex; flex-direction: column; align-items: center; gap: .25rem; padding: .8rem .4rem; border-radius: 14px; background: color-mix(in srgb, currentColor 6%, transparent); }
.day { font-size: .8rem; opacity: .75; }
.icon { font-size: 1.6rem; }
.hi { font-weight: 700; }
.lo { opacity: .65; font-size: .9rem; }

/* map */
.map-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: .7rem; }
.map-head h2 { margin: 0; }
.toggle { display: flex; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 999px; padding: 3px; }
.toggle button { border: 0; background: none; color: inherit; font: inherit; font-size: .82rem; padding: .25rem .8rem; border-radius: 999px; cursor: pointer; }
.toggle button.on { background: var(--travel-accent, #8fd3b6); color: #0b1220; }
.map-block iframe { width: 100%; height: 300px; border: 0; border-radius: 14px; display: block; }

@media (max-width: 576px) {
    .forecast { grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
    .country-info > *, .hero-img, .shimmer { animation: none; }
}
</style>