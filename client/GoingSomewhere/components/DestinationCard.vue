<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  destination: { type: Object, required: true },
})
const emit = defineEmits(['close', 'add'])

const weather = ref(null)
const weatherFailed = ref(false)
const imageLoaded = ref(false)

async function loadWeather(d) {
  weather.value = null
  weatherFailed.value = false
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}` +
      `&current=temperature_2m`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`weather request failed: ${res.status}`)
    const data = await res.json()
    // Ignore the response if the user has already picked a different place.
    if (props.destination.id !== d.id) return
    weather.value = `${Math.round(data.current.temperature_2m)}${data.current_units.temperature_2m}`
  } catch (err) {
    console.error(err)
    if (props.destination.id === d.id) weatherFailed.value = true
  }
}

watch(
  () => props.destination,
  (d) => {
    imageLoaded.value = false
    loadWeather(d)
  },
  { immediate: true },
)
</script>

<template>
  <aside class="dest-card">
    <button class="close" type="button" aria-label="Close" @click="emit('close')">×</button>

    <div class="scroll">
      <div class="hero">
        <img
          :src="props.destination.image"
          :alt="props.destination.city"
          :class="{ loaded: imageLoaded }"
          @load="imageLoaded = true"
        />
      </div>

      <div class="body">
        <h2 class="place">{{ props.destination.city }},</h2>
        <p class="country">{{ props.destination.country }}</p>

        <h4 class="label">Description</h4>
        <p class="text">{{ props.destination.description }}</p>

        <h4 class="label">Weather</h4>
        <p class="text">
          {{ weather ?? (weatherFailed ? 'Unavailable' : 'Loading…') }}
        </p>

        <h4 class="label">Picture collage</h4>
        <div class="carousel">
          <img
            v-for="(src, i) in props.destination.gallery"
            :key="src + i"
            :src="src"
            :alt="`${props.destination.city} ${i + 1}`"
          />
        </div>

        <button class="add" type="button" @click="emit('add', props.destination)">
          Add to itinerary!
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.dest-card {
  position: relative;
  width: 360px;
  flex-shrink: 0;
  height: calc(100vh - 48px);
  margin: 24px 0 24px 24px;
  background: linear-gradient(180deg, #efe6d6 0%, #dcdcdc 45%, #d9d9d9 100%);
  color: #1b1b1b;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  font-family: 'IM Fell English', Georgia, serif;
}

.scroll {
  height: 100%;
  overflow-y: auto;
}

.close {
  position: absolute;
  top: 6px;
  right: 10px;
  z-index: 3;
  background: none;
  border: 0;
  font-size: 1.8rem;
  line-height: 1;
  color: #1b1b1b;
}

/* Picture fades into the card colour at the bottom */
.hero {
  position: relative;
  height: 260px;
  background: #efe6d6;
  overflow: hidden;
}

.hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.hero img.loaded {
  opacity: 1;
}

.hero::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 110px;
  background: linear-gradient(transparent, #d9d9d9);
  pointer-events: none;
}

.body {
  padding: 0 24px 24px;
  margin-top: -20px;
  position: relative;
}

.place {
  font-family: 'Pinyon Script', cursive;
  font-weight: 400;
  font-size: 2.4rem;
  line-height: 1.1;
  margin: 0;
}

.country {
  font-family: 'Pinyon Script', cursive;
  font-size: 1.6rem;
  margin: 0 0 1rem;
}

.label {
  font-family: 'IM Fell English SC', serif;
  font-weight: 400;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  margin: 1rem 0 0.25rem;
}

.text {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  line-height: 1.4;
}

.carousel {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 8px;
}

.carousel img {
  flex: 0 0 75%;
  height: 130px;
  object-fit: cover;
  scroll-snap-align: start;
  border-radius: 2px;
}

.add {
  width: 100%;
  margin: 1.2rem 0 0.5rem;
  padding: 0.9rem;
  background: #0d1a33;
  color: #ffd27f;
  border: 0;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.add:hover {
  background: #1c3561;
}
</style>