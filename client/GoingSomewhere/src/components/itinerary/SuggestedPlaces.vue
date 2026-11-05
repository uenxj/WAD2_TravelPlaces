<script setup>
// "Suggested places in <destination>": the top places from OpenTripMap. Add opens the activity form pre-filled.
import { ref, watch } from 'vue'
import PlaneLoader from '../PlaneLoader.vue'
import { itineraryApi } from '../../itinerary/api.js'

const props = defineProps({ destination: { type: String, required: true } })
const emit = defineEmits(['pick'])

const places = ref([])
const area = ref('')
const loading = ref(false)
const error = ref('')
const open = ref(false)
const loadedFor = ref('')

async function load() {
  if (loadedFor.value === props.destination && places.value.length) return
  loading.value = true
  error.value = ''
  try {
    const result = await itineraryApi.topPlaces(props.destination)
    places.value = result.places
    area.value = result.area
    loadedFor.value = props.destination
  } catch (e) {
    error.value = e.message
    places.value = []
    area.value = ''
  } finally {
    loading.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) load()
}

watch(() => props.destination, () => {
  places.value = []
  loadedFor.value = ''
  if (open.value) load()
})
</script>

<template>
  <section class="surface places" data-testid="top-places" aria-label="Suggested places">
    <div class="places-head">
      <h2>Suggested places in {{ destination }}</h2>
      <button type="button" class="secondary-action small" :aria-expanded="open" data-testid="top-places-toggle" @click="toggle">
        {{ open ? 'Hide' : 'Show ideas' }}
      </button>
    </div>

    <template v-if="open">
      <PlaneLoader v-if="loading" compact class="places-note" label="Finding ideas…" />
      <div v-else-if="error" class="places-error" role="alert"><p>{{ error }}</p><button type="button" class="secondary-action small" @click="load">Try again</button></div>
      <template v-else>
        <p class="muted-copy places-note" data-testid="top-places-area">
          Popular spots around {{ area }}. Not the right place? Add the country, e.g. “Paris, France”.
        </p>
        <ol class="places-list">
          <li v-for="p in places" :key="p.id">
            <div>
              <strong>{{ p.name }}</strong>
              <span class="muted-copy kinds">{{ p.kinds.join(' · ') }}</span>
            </div>
            <button type="button" class="secondary-action small" @click="emit('pick', p)">Add</button>
          </li>
        </ol>
        <p class="muted-copy places-note credit">Data © OpenStreetMap contributors via OpenTripMap.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.places {
  padding: 1.25rem;
}

.places-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .75rem;
}

.places-head h2 {
  margin: 0;
  font-size: var(--travel-section-size);
}

.small {
  padding: .35rem .9rem;
  font-size: .85rem;
}

.places-note {
  margin: .8rem 0 0;
  font-size: .8rem;
  line-height: 1.5;
}

.places-note.credit {
  font-size: .72rem;
}

.places-error {
  margin: .8rem 0 0;
  padding: .7rem .9rem;
  border: 1px solid var(--travel-warn-border);
  border-radius: .6rem;
  background: var(--travel-warn-bg);
  color: var(--travel-warn-text);
  font-size: .85rem;
}

.places-list {
  max-height: 24rem;
  margin: .8rem 0 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.places-list li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem;
  padding: .6rem 0;
  border-top: 1px solid var(--travel-border);
}

.places-list strong {
  display: block;
  font-size: .9rem;
}

.kinds {
  font-size: .75rem;
  line-height: 1.4;
}
</style>
