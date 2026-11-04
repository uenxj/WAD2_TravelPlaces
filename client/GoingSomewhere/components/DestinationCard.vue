<script setup>
import { ref, watch } from 'vue'
import { getCurrentTemperature } from '../src/weather/api.js'

const props = defineProps({
  destination: { type: Object, required: true },
})
const emit = defineEmits(['close', 'add', 'save'])

const weather = ref(null)
const weatherFailed = ref(false)
const imageLoaded = ref(false)

async function loadWeather(d) {
  weather.value = null
  weatherFailed.value = false
  try {
    const temperature = await getCurrentTemperature(d)
    // Ignore the response if the user has already picked a different place.
    if (props.destination.id !== d.id) return
    weather.value = temperature
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
        <img :src="props.destination.image" :alt="props.destination.city" :class="{ loaded: imageLoaded }" class="flex-image"
          @load="imageLoaded = true" />
      </div>

      <div class="body">
        <h2 class="place">{{ props.destination.city }},</h2>
        <p class="country">{{ props.destination.country }}</p>

        <h4 class="label">Description</h4>
        <p class="text">{{ props.destination.description }}</p>

        <h4 class="label">Current temperature</h4>
        <p class="text">
          {{ weather ?? (weatherFailed ? 'Unavailable' : 'Loading…') }}
        </p>
        <RouterLink class="weather-link" :to="{ path: '/weather', query: { destination: props.destination.id } }">Check
          weather &amp; air quality for your dates →</RouterLink>

        <h4 class="label">Picture collage</h4>
        <div class="gallery">
          <img v-for="(image, i) in props.destination.gallery" :key="image" :src="image"
            :alt="`${props.destination.city} ${i + 1}`" />
        </div>


        <button class="add" type="button" @click="emit('add', props.destination)">
          Plan a trip here
        </button>
        <p class="account-hint">Log in to save places or create a trip.</p>
        <p class="account-hint">Weather data by <a href="https://open-meteo.com/" target="_blank"
            rel="noopener noreferrer">Open-Meteo</a>.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.weather-link {
  display: inline-block;
  color: #163c55;
  font-family: system-ui, sans-serif;
  font-size: .85rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.dest-card {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  flex-shrink: 0;
  height: 100%;
  margin: 24px;
  background: linear-gradient(180deg, #efe6d6 0%, #dcdcdc 45%, #d9d9d9 100%);
  color: #1b1b1b;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  font-family: 'IM Fell English', Georgia, serif;
  /* border: solid red 1px; */
  
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
  min-width: fit-content;
  height: auto;
  background: #efe6d6;
  overflow:hidden;
}

.hero img {
  width: 100%;
  height: auto;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.hero img.loaded {
  opacity: 1;
}

/* the blur transition to body */
.hero::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50px;
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
  font-size: 55px;
  z-index: 2;
  line-height: 1.1;
  margin: 0;
  /* border: 1px solid green; */
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
  margin-top: 20px;
  margin-bottom: 0px;
  /* border: solid 1px purple; */
}

.text {
  margin-top: 0px;
  font-size: 1rem;
  line-height: 1.4;
  /* border: 1px solid yellow; */
}

.gallery {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 8px;
  height: 300px;
}

.gallery img {
  flex: 0 0 80%;
  width: 100%;
  height: auto;
  object-fit: cover;
  border-radius: 6px;
  scroll-behavior: smooth;
  scroll-snap-align: center;
  /* scroll-snap-align: center; */
  /* scroll-behavior: smooth; */
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

.save {
  width: 100%;
  padding: .8rem;
  border: 1px solid #0d1a33;
  background: transparent;
  color: #0d1a33;
}

.account-hint {
  font-family: system-ui, sans-serif;
  font-size: .8rem;
  margin: .75rem 0 0;
}

@media (max-width: 768px) {
  .dest-card {
    width: calc(100% - 2rem);
    margin: 1rem;
    height: auto;
    max-height: none;
  }

  .scroll {
    overflow: visible;
  }
}
</style>
