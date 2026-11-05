<script setup>
import { ref, computed, watch } from 'vue'
import PlaneLoader from '../src/components/PlaneLoader.vue'
import { user } from '../src/services/auth.js'
import { getCurrentTemperature } from '../src/weather/api.js'

const props = defineProps({
  destination: { type: Object, required: true },
})
const emit = defineEmits(['close', 'add', 'save'])


const API_NINJAS_KEY = import.meta.env.VITE_API_NINJAS_KEY //vue runs in browser, so cant access process.env/Node variables
const countryStatsCache = {} // country name -> response, so switching between pins does not fetch again

//gets the number of tourist according to NinjaAPI
async function getCountryStats(countryName) {
  if (countryStatsCache[countryName]) return countryStatsCache[countryName]
  if (!API_NINJAS_KEY) {
    throw new Error('Add VITE_API_NINJAS_KEY to .env.local and restart the dev server.')
  }

  const url = 'https://api.api-ninjas.com/v1/country?name=' + encodeURIComponent(countryName)
  const response = await fetch(url, { headers: { 'X-Api-Key': API_NINJAS_KEY } })
  if (!response.ok) {
    throw new Error('Country facts failed (HTTP ' + response.status + ')')
  }

  const stats = await response.json() //convert to json array/obj
  // console.log(stats)
  countryStatsCache[countryName] = stats // only successful responses are kept, so a failure is retried next time
  return stats
}

//for getting the tourist stat from getCountryStats
//api returns [{tourist:1234}]
function findTouristCount(apiResponse) {
  if (!Array.isArray(apiResponse) || apiResponse.length === 0) return null

  const count = apiResponse[0].tourists
  if (typeof count !== 'number') return null //check whether the data has anything
  return count

}

const weather = ref(null)
const weatherFailed = ref(false)
const touristCount = ref(null) // a number, or null when the source has no figure
const touristStatus = ref('loading') // 'loading' | 'ready' | 'unavailable'
const imageLoaded = ref(false)

const weatherText = computed(function () {
  if (weather.value !== null) return weather.value
  return 'Unavailable'
})

const touristText = computed(() => {
  if (touristStatus.value === 'loading') return 'Loading…'
  if (touristCount.value === null) return 'Not enough data'
  return touristCount.value.toLocaleString('en-US')
})

async function loadWeather(destination) {
  weather.value = null
  weatherFailed.value = false
  try {
    const temperature = await getCurrentTemperature(destination)
    // Ignore the answer if the user has already picked a different place
    if (props.destination.id !== destination.id) return
    weather.value = temperature
  } catch (error) {
    console.error(error)
    if (props.destination.id === destination.id) weatherFailed.value = true
  }
}

async function loadTourists(destination) {
  touristCount.value = null
  touristStatus.value = 'loading'
  try {
    const stats = await getCountryStats(destination.country)
    if (props.destination.id !== destination.id) return
    touristCount.value = findTouristCount(stats)
    touristStatus.value = touristCount.value === null ? 'loading' : 'ready'
  } catch (error) {
    console.error(error)
    if (props.destination.id === destination.id) touristStatus.value = 'loading'
  }
}

watch(
  function () { return props.destination },
  function (destination) {
    imageLoaded.value = false
    loadWeather(destination)
    loadTourists(destination)
  },
  { immediate: true },
)
</script>

<template>
  <aside class="dest-card">
    <button class="close" type="button" aria-label="Close" @click="emit('close')">×</button>

    <div class="scroll">
      <div class="hero">
        <img :src="props.destination.image" :alt="props.destination.city" :class="{ loaded: imageLoaded }"
          class="flex-image" @load="imageLoaded = true" />
      </div>

      <div class="body">
        <h1 class="place" tabindex="-1">{{ props.destination.city }},</h1>
        <p class="country">{{ props.destination.country }}</p>

        <h4 class="label">Description</h4>
        <p class="text">{{ props.destination.description }}</p>

        <h4 class="label">Current temperature</h4>
        <PlaneLoader v-if="weather === null && !weatherFailed" compact class="temperature-loader"
          label="Loading temperature…" />
        <p v-else class="text">{{ weatherText }}</p>
        <RouterLink class="weather-link" :to="{ path: '/weather', query: { destination: props.destination.id } }">Check
          weather &amp; air quality for your dates →</RouterLink>

        <h4 class="label">Tourists</h4>
        <p class="text">{{ touristText }}</p>

        <h4 class="label">Picture collage</h4>
        <div class="gallery">
          <img v-for="(image, index) in props.destination.gallery" :key="image" :src="image"
            :alt="props.destination.city + ' ' + (index + 1)" />
        </div>


        <button class="add" type="button" @click="emit('add', props.destination)">
          Plan a trip here
        </button>
        <p v-if="!user" class="account-hint">Log in to save places or create a trip.</p>
        <p class="account-hint">Weather data by <a href="https://open-meteo.com/" target="_blank"
            rel="noopener noreferrer">Open-Meteo</a>. Country facts by <a href="https://api-ninjas.com/" target="_blank"
            rel="noopener noreferrer">API Ninjas</a>.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.dest-card {
  --card-text: var(--travel-discover-card-text);
  --card-muted: var(--travel-discover-card-muted);
  --card-label: var(--travel-discover-card-label);
  --card-link: var(--travel-discover-card-link);

  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  margin: 24px;
  background: var(--travel-discover-card-bg);
  color: var(--card-text);
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  /* font-family: 'IM Fell English', Georgia, serif; */
}

.temperature-loader {
  --plane-loader-color: var(--card-text);
  --plane-loader-label-color: var(--card-text);
  /* font-family: system-ui, sans-serif; */
  margin-bottom: .75rem;
}

.weather-link {
  display: inline-block;
  color: var(--card-link);
  /* font-family: system-ui, sans-serif; */
  font-size: .85rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.close {
  position: absolute;
  top: 6px;
  right: 10px;
  z-index: 3;
  background: none;
  border: 0;
  min-width: 44px;
  min-height: 44px;
  border-radius: 999px;
  background: var(--travel-discover-card-chip);
  font-size: 1.8rem;
  line-height: 1;
  color: var(--travel-discover-card-chip-text);
}

/* Picture fades into the card colour at the bottom */
.hero {
  position: relative;
  min-width: fit-content;
  height: auto;
  background: var(--travel-discover-card-fade);
  overflow: hidden;
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
  background: linear-gradient(transparent, var(--travel-discover-card-fade));
  pointer-events: none;
}

.body {
  padding: 0 24px 24px;
  margin-top: -20px;
  position: relative;
}

.place {
  font-family: 'Pinyon Script', cursive;
  font-weight: bold;
  font-size: clamp(2.5rem, 4vw, 3.4rem);
  /* overflow-wrap: anywhere; */
  z-index: 2;
  line-height: 1.1;
  margin: 0;
  color: var(--card-text);
}

.country {
  font-family: 'Pinyon Script', cursive;
  font-weight: bold;
  font-size: 1.6rem;
  margin: 0 0 1rem;
  color: var(--card-text);
}

.label {
  /* font-family: 'IM Fell English SC', serif; */
  font-weight: 400;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  margin-top: 20px;
  margin-bottom: 0px;
  color: var(--card-label);
}

.text {
  margin-top: 0px;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--card-text);
}

.gallery {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 8px;
  height: 220px;
}

.gallery img {
  flex: 0 0 80%;
  width: 100%;
  height: auto;
  object-fit: cover;
  border-radius: 6px;
  scroll-behavior: smooth;
  scroll-snap-align: center;
}

.add {
  width: 100%;
  margin: 1.2rem 0 0.5rem;
  padding: 0.9rem;
  border-radius: 999px;
  /* font-family: system-ui, sans-serif; */
  font-weight: 600;
  background: var(--travel-discover-cta-bg);
  color: var(--travel-discover-cta-text);
  border: 0;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.add:hover {
  background: var(--travel-discover-cta-hover);
}

.account-hint {
  font-family: system-ui, sans-serif;
  font-size: .8rem;
  margin: .75rem 0 0;
  color: var(--card-muted);
}

.account-hint a {
  color: var(--card-link);
}

/* Phones (767px and below): unchanged from the original card */
@media (max-width: 767.98px) {
  .dest-card {
    width: calc(100% - 2rem);
    margin: 1rem;
    height: auto;
    max-height: none;
  }

  .scroll {
    flex: none;
    overflow: visible;
    overscroll-behavior: auto;
  }
}

/* iPad and small laptops (768px to 1199px): a wider card with larger type, filling the left column */
@media (min-width: 768px) and (max-width: 1199.98px) {
  .dest-card {
    margin: 16px;
    width: calc(100% - 32px);
  }

  .body {
    padding: 0 32px 28px;
  }

  .place {
    font-size: clamp(3rem, 6vw, 3.8rem);
  }

  .country {
    font-size: 1.9rem;
  }

  .label {
    font-size: 1.05rem;
  }

  .text,
  .account-hint {
    font-size: 1.08rem;
  }

  .weather-link {
    font-size: .95rem;
  }

  .gallery {
    height: 260px;
  }

  .add {
    font-size: 1.15rem;
    padding: 1rem;
  }
}

/* Laptops and desktops (1200px and up): fills its column edge to edge, larger type and gallery */
@media (min-width: 1200px) {
  .dest-card {
    margin: 0;
  }

  .body {
    padding: 0 36px 32px;
  }

  .place {
    font-size: clamp(3.2rem, 4.4vw, 4.2rem);
  }

  .country {
    font-size: 2rem;
  }

  .label {
    font-size: 1.1rem;
  }

  .text,
  .account-hint {
    font-size: 1.1rem;
  }

  .gallery {
    height: 300px;
  }

  .add {
    font-size: 1.2rem;
    padding: 1rem;
  }
}
</style>

<style scoped>
@media (min-width: 768px) {
  .scroll {
    overscroll-behavior: contain;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero img {
    transition: none;
  }
}
</style>