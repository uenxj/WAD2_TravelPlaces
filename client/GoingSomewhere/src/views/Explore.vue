<script setup>
import BackLink from '../components/BackLink.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DESTINATIONS } from '../data/destinations.js'
const route = useRoute()
const destination = computed(() => DESTINATIONS.find(d => d.country.toLowerCase() === String(route.params.country).toLowerCase()))
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
  </main>
</template>
