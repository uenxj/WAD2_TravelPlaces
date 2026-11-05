<script setup>
import BackLink from '../components/BackLink.vue'
import { computed, nextTick, ref } from 'vue'
import { DESTINATIONS } from '../data/destinations.js'
const interest = ref('')
const pace = ref('')
const region = ref('')
const submitted = ref(false)
const resultsPanel = ref(null)
async function findDestinations() {
  submitted.value = true
  await nextTick()
  resultsPanel.value?.focus({ preventScroll: true })
  if (window.innerWidth < 900) {
    resultsPanel.value?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }
}
const recommendations = computed(() => {
  const interests = { culture: ['paris', 'cairo', 'tokyo'], nature: ['cape-town', 'sydney', 'rio'], city: ['nyc', 'singapore', 'tokyo'] }
  const regions = { asia: ['tokyo', 'singapore'], europe: ['paris'], africa: ['cairo', 'cape-town'], americas: ['nyc', 'rio'], oceania: ['sydney'] }
  const relaxed = ['sydney', 'cape-town', 'rio']
  return DESTINATIONS.map(d => ({ ...d, score: (interests[interest.value]?.includes(d.id) ? 3 : 0) + (regions[region.value]?.includes(d.id) ? 4 : 0) + ((pace.value === 'relaxed') === relaxed.includes(d.id) ? 1 : 0) })).sort((a,b) => b.score - a.score).slice(0,3)
})
</script>
<template>
  <main class="content-page quiz-page">
    <BackLink to="/discover">Back to Discover</BackLink>
    <p class="eyebrow">Travel Preference Quiz</p>
    <h1 class="page-heading">What does your next trip look like?</h1>
    <div class="quiz-layout">
    <form class="surface form-stack quiz-form" @submit.prevent="findDestinations" @change="submitted = false">
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
    <section v-if="submitted" ref="resultsPanel" class="quiz-results" aria-label="Recommended destinations" tabindex="-1">
      <div class="recommendations">
        <article v-for="d in recommendations" :key="d.id" class="surface">
          <div class="result-heading"><h3>{{ d.city }}</h3><span class="muted-copy">{{ d.country }}</span></div>
          <p class="muted-copy result-description">{{ d.description }}</p>
          <RouterLink class="secondary-action" :to="{ path: '/discover', query: { destination: d.id } }">Explore destination</RouterLink>
        </article>
      </div>
    </section>
    </div>
  </main>
</template>
<style scoped>
.quiz-page .page-heading { margin-bottom: 1.5rem; }
.quiz-layout { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); align-items: start; gap: 2rem; }
.quiz-form { width: 100%; padding: 1.25rem; gap: 1.1rem; }
.quiz-form label { font-size: .9rem; }
.quiz-form select { padding: .65rem .75rem; }
.quiz-form .primary-action { padding: .7rem 1rem; font-size: .9rem; }
.quiz-results { min-width: 0; scroll-margin-top: 1rem; }
.quiz-results:focus-visible { outline: 2px solid var(--travel-accent); outline-offset: 5px; border-radius: .2rem; }
.recommendations { display: grid; gap: .75rem; }
.recommendations article { padding: 1rem 1.25rem; }
.result-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: .35rem .75rem; }
.result-heading h3 { font-size: 1.15rem; margin: 0; }
.result-heading span { font-size: .8rem; }
.result-description { font-size: .85rem; line-height: 1.5; margin: .45rem 0 .75rem; }
.recommendations .secondary-action { padding: .4rem .85rem; font-size: .8rem; }
@media (max-width: 899px) { .quiz-layout { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; } .quiz-form { max-width: 400px; } }
</style>
