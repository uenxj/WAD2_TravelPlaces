<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { previewMode } from '../services/preview.js'
import { user } from '../services/auth.js'
import { DESTINATIONS } from '../data/destinations.js'
import { useTheme } from '../composables/useTheme.js'

const router = useRouter()
const { theme, toggleTheme } = useTheme()
const isLight = computed(() => theme.value === 'light')
const headerEl = ref(null)
let headerObserver
onMounted(() => {
  headerObserver = new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty('--app-header-height', `${entry.target.getBoundingClientRect().height}px`)
  })
  headerObserver.observe(headerEl.value)
})
onBeforeUnmount(() => headerObserver?.disconnect())

// Destination search lives in the nav. Picking a match opens Discover with that
// place selected via the ?destination= query, which Discover already watches.
const search = ref('')
const results = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  return DESTINATIONS.filter(d => `${d.city} ${d.country}`.toLowerCase().includes(q))
})

function pickDestination(d) {
  search.value = ''
  router.push({ path: '/discover', query: { destination: d.id } })
}

</script>

<template>
  <header ref="headerEl" class="app-header">
    <RouterLink class="app-brand" to="/" aria-label="GoingSomewhere home"><span aria-hidden="true">✈</span>
      GoingSomewhere</RouterLink>

    <!-- Search is its own grid cell: middle of the bar on tablet, second row on phone -->
    <div v-if="$route.path === '/discover'" class="app-search" role="search">
      <input id="destination-search" v-model="search" type="search" class="app-search-input"
        placeholder="Search a city or country" aria-label="Find a destination" @keydown.esc="search = ''" />
      <ul v-if="search.trim()" class="app-search-results" aria-label="Destinations">
        <li v-for="d in results" :key="d.id">
          <button type="button" @click="pickDestination(d)">
            {{ d.city }} <span class="app-search-country">{{ d.country }}</span>
          </button>
        </li>
        <li v-if="!results.length" class="app-search-empty">No destinations found.</li>
      </ul>
    </div>

    <nav class="app-links" aria-label="Main navigation">
      <RouterLink to="/discover">Discover</RouterLink>
      <template v-if="user || previewMode">
        <RouterLink to="/trips">My Trips</RouterLink>
        <RouterLink class="primary-action" to="/trips/new">+ New trip</RouterLink>
        <RouterLink to="/profile">Profile</RouterLink>
      </template>
      <RouterLink v-else class="primary-action" :to="{ path: '/login', query: { from: $route.fullPath } }">Log in
      </RouterLink>
    </nav>

    <!-- Light / dark theme. The icon shows the theme you would switch to. -->
    <button type="button" class="theme-toggle" data-testid="theme-toggle" :aria-pressed="isLight ? 'true' : 'false'"
      :aria-label="isLight ? 'Switch to dark theme' : 'Switch to light theme'" :title="isLight ? 'Switch to dark theme' : 'Switch to light theme'"
      @click="toggleTheme">
      <svg v-if="isLight" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
    </button>
  </header>
</template>

<style scoped>
.app-header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: .75rem 1.5rem; padding: 1rem 5% .75rem; }
.app-brand { grid-column: 1; }
.app-links { grid-column: 3; }
.theme-toggle { grid-column: 4; grid-row: 1; justify-self: end; display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--travel-action-border); border-radius: 50%; background: transparent; color: var(--travel-text); cursor: pointer; }
.theme-toggle svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) { .theme-toggle:hover { border-color: var(--travel-accent); color: var(--travel-text-hover); } }
.app-links > a { display: inline-flex; align-items: center; min-height: 44px; }
.app-links > a[aria-current="page"]:not(.primary-action) { text-decoration: underline; text-underline-offset: .35em; }
.app-search { position: relative; grid-column: 2; justify-self: end; width: 100%; max-width: 350px; min-width: 0; }
.app-search-input { width: 100%; min-height: 44px; padding: .55rem 1rem; border: 1px solid var(--travel-control-border); border-radius: 999px; background: var(--travel-panel); color: var(--travel-text); font: inherit; }
.app-search-input::placeholder { color: var(--travel-muted); opacity: 1; }
.app-search-results { position: absolute; top: calc(100% + .5rem); inset-inline: 0; z-index: 20; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; margin: 0; padding: .35rem; list-style: none; border: 1px solid var(--travel-border); border-radius: .85rem; background: var(--travel-panel); box-shadow: 0 12px 32px rgb(0 0 0 / .25); }
.app-search-results button { width: 100%; min-height: 44px; padding: .5rem .75rem; border: 0; border-radius: .5rem; background: none; color: var(--travel-text); font: inherit; text-align: start; cursor: pointer; }
.app-search-results button:focus-visible { background: var(--travel-selected); outline-offset: -3px; }
.app-search-country { color: var(--travel-muted); font-size: .85rem; margin-inline-start: .3rem; }
.app-search-empty { padding: .5rem .75rem; color: var(--travel-muted); font-size: .85rem; }
@media (hover: hover) { .app-search-results button:hover { background: var(--travel-selected); } }
@media (max-width: 1100px) {
  .app-header { grid-template-columns: auto minmax(0, 1fr) auto; }
  .app-links { grid-column: 2; grid-row: 1; justify-self: end; gap: 1rem; }
  .theme-toggle { grid-column: 3; }
  .app-search { grid-column: 1 / -1; grid-row: 2; max-width: none; }
}
@media (max-width: 575.98px) {
  .app-header { grid-template-columns: minmax(0, 1fr) auto; gap: .35rem; }
  .app-brand { grid-column: 1; grid-row: 1; }
  .theme-toggle { grid-column: 2; }
  .app-links { grid-column: 1 / -1; grid-row: 2; justify-self: stretch; justify-content: space-between; gap: .35rem .5rem; font-size: .85rem; }
  .app-links .primary-action { padding: .55rem .8rem; }
  .app-search { grid-row: 3; }
}
</style>
