<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { previewMode } from '../services/preview.js'
import { user, logout } from '../services/auth.js'
import { DESTINATIONS } from '../data/destinations.js'

const router = useRouter()

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

async function signOut() {
  await logout()
  router.push('/discover')
}
</script>

<template>
  <header class="app-header">
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
        <button v-if="user" type="button" class="app-logout" @click="signOut">Log out</button>
      </template>
      <RouterLink v-else class="primary-action" :to="{ path: '/login', query: { from: $route.fullPath } }">Log in
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-logout {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.app-logout:hover {
  text-decoration: underline;
}

/* Laptop (768px and up): brand | search | links in one row, search sits left of the links */
.app-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 10px 20px;
}

.app-brand {
  grid-column: 1;
}

.app-links {
  grid-column: 3;
}

.app-search {
  position: relative;
  grid-column: 2;
  justify-self: end;
  width: 100%;
  max-width: 350px;
  margin-right: 50px;
}

.app-search-input {
  width: 100%;
  padding: .45rem 1rem;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 999px;
  background: rgba(255, 255, 255, .06);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
  color: var(--travel-text);
  font: inherit;
  font-size: .9rem;
  outline: none;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}

.app-search-input::placeholder {
  color: var(--travel-muted);
}

.app-search-input:focus {
  border-color: rgba(185, 221, 210, .55);
  background: rgba(255, 255, 255, .1);
  box-shadow: 0 0 0 3px rgba(185, 221, 210, .12);
}

.app-search-results {
  position: absolute;
  top: calc(100% + .5rem);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: .35rem;
  list-style: none;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 14px;
  background: rgba(16, 26, 46, .55);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .35);
}

.app-search-results button {
  width: 100%;
  padding: .5rem .75rem;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--travel-text);
  font: inherit;
  font-size: .9rem;
  text-align: left;
  cursor: pointer;
}

.app-search-results button:hover,
.app-search-results button:focus-visible {
  background: rgba(255, 255, 255, .1);
  outline: none;
}

.app-search-country {
  color: var(--travel-muted);
  font-size: .8rem;
  margin-left: .3rem;
}

.app-search-empty {
  padding: .5rem .75rem;
  color: var(--travel-muted);
  font-size: .85rem;
}

/* Tablet (576px to 767px, Bootstrap sm to md): brand | search (centred) | links */
@media (min-width: 576px) and (max-width: 767.98px) {
  .app-header {
    gap: .75rem;
    padding: 12px;
  }

  .app-brand {
    font-size: .85rem;
  }

  .app-links {
    gap: .75rem;
    font-size: .9rem;
  }

  .app-search {
    justify-self: center;
    max-width: 360px;
    margin-right: 0;
  }
}

/* Phone (below 576px, Bootstrap xs): row 1 = brand + links, row 2 = search */
@media (max-width: 575.98px) {
  .app-header {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: .6rem;
    padding: .75rem 16px;
  }

  .app-brand {
    grid-column: 1;
    grid-row: 1;
    font-size: .95rem;
  }

  .app-links {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    gap: .9rem;
    font-size: .9rem;
  }

  .app-search {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: stretch;
    max-width: none;
    margin-right: 0;
  }
}

</style>