<script setup>
import { computed, ref } from 'vue'
import { DESTINATIONS } from '../data/destinations.js'
const interest = ref('')
const pace = ref('')
const region = ref('')
const submitted = ref(false)
const recommendations = computed(() => {
  const interests = { culture: ['paris', 'cairo', 'tokyo'], nature: ['cape-town', 'sydney', 'rio'], city: ['nyc', 'singapore', 'tokyo'] }
  const regions = { asia: ['tokyo', 'singapore'], europe: ['paris'], africa: ['cairo', 'cape-town'], americas: ['nyc', 'rio'], oceania: ['sydney'] }
  const relaxed = ['sydney', 'cape-town', 'rio']
  return DESTINATIONS.map(d => ({ ...d, score: (interests[interest.value]?.includes(d.id) ? 3 : 0) + (regions[region.value]?.includes(d.id) ? 4 : 0) + ((pace.value === 'relaxed') === relaxed.includes(d.id) ? 1 : 0) })).sort((a,b) => b.score - a.score).slice(0,3)
})
</script>
<template>
  <main class="content-page">
    <RouterLink class="quiz-back" to="/discover">← Back to Discover</RouterLink>
    <p class="eyebrow mt-4">Travel Preference Quiz</p>
    <h1 class="page-heading">What does your next trip look like?</h1>
    <p class="muted-copy">Answer three quick questions to find ideas from our destination collection. No account needed.</p>
    <form class="surface form-stack quiz-form" @submit.prevent="submitted = true" @change="submitted = false">
      <label for="interest">What interests you most?
        <select id="interest" v-model="interest" required><option disabled value="">Choose an interest</option><option value="culture">Culture and history</option><option value="nature">Nature and scenery</option><option value="city">City life and food</option></select>
      </label>
      <label for="pace">What is your preferred pace?
        <select id="pace" v-model="pace" required><option disabled value="">Choose a pace</option><option value="relaxed">Relaxed and easy-going</option><option value="busy">Busy and full of activities</option></select>
      </label>
      <label for="region">Where would you like to explore?
        <select id="region" v-model="region" required><option disabled value="">Choose a region</option><option value="any">Anywhere</option><option value="asia">Asia</option><option value="europe">Europe</option><option value="africa">Africa</option><option value="americas">Americas</option><option value="oceania">Oceania</option></select>
      </label>
      <button class="primary-action" type="submit">Find my destinations</button>
    </form>
    <section v-if="submitted" class="mt-4" aria-labelledby="recommendation-title" aria-live="polite">
      <h2 id="recommendation-title">A few places you might love</h2>
      <p class="muted-copy">Ranked using your interests, preferred region and travel pace.</p>
      <div class="recommendations">
        <article v-for="d in recommendations" :key="d.id" class="surface">
          <h3>{{ d.city }}</h3><p class="muted-copy">{{ d.country }} · {{ d.description }}</p>
          <RouterLink class="secondary-action" :to="{ path: '/discover', query: { destination: d.id } }">Explore destination</RouterLink>
        </article>
      </div>
    </section>
  </main>
</template>
<style scoped>
.quiz-back { color: var(--travel-accent); }
.quiz-form { max-width: 650px; }
.recommendations { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
@media (max-width: 800px) { .recommendations { grid-template-columns: 1fr; } }
</style>
