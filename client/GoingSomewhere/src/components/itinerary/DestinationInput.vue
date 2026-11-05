<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import PlaneLoader from '../PlaneLoader.vue'
import { searchLocations } from '../../weather/api.js'
import { destinationLabel, destinationSelection } from '../../itinerary/destination.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  location: { type: Object, default: null },
  id: { type: String, required: true },
  testid: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'update:location'])
const root = ref(null)
const input = ref(null)
const results = ref([])
const loading = ref(false)
const searched = ref(false)
const error = ref('')
const open = ref(false)
const active = ref(-1)
let timer
let generation = 0
const showResults = computed(() => open.value && (loading.value || searched.value || error.value))
const status = computed(() => loading.value ? 'Searching destinations…' : error.value || (searched.value && !results.value.length ? 'No matching places. Try a city and country, such as Zurich, Switzerland.' : ''))

function change(event) {
  emit('update:location', null)
  emit('update:modelValue', event.target.value)
  open.value = true
}
async function search(query) {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const matches = await searchLocations(query)
    if (current !== generation) return
    results.value = matches
    searched.value = true
  } catch {
    if (current !== generation) return
    error.value = 'Location search is unavailable. You can still enter a city and country, or try again.'
    results.value = []
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(() => props.modelValue, query => {
  clearTimeout(timer)
  generation++
  loading.value = false
  searched.value = false
  error.value = ''
  results.value = []
  active.value = -1
  if (props.location && props.location.label === query) { open.value = false; return }
  if (query.trim().length < 2) return
  timer = setTimeout(() => search(query.trim()), 300)
})
function choose(location) {
  const selection = destinationSelection(location)
  emit('update:location', selection)
  emit('update:modelValue', selection.label)
  open.value = false
  input.value?.focus()
}
async function move(direction) {
  if (!results.value.length) return
  open.value = true
  active.value = active.value < 0
    ? (direction > 0 ? 0 : results.value.length - 1)
    : (active.value + direction + results.value.length) % results.value.length
  await nextTick()
  document.getElementById(`${props.id}-option-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}
function onKey(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' && open.value && results.value.length) {
    event.preventDefault()
    choose(results.value[Math.max(active.value, 0)])
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
  }
}
function focusSearch() {
  open.value = !props.location
  if (open.value && props.modelValue.trim().length >= 2 && !searched.value && !loading.value) {
    clearTimeout(timer)
    search(props.modelValue.trim())
  }
}
function leave(event) {
  if (!root.value?.contains(event.relatedTarget)) open.value = false
}
onBeforeUnmount(() => { clearTimeout(timer); generation++ })
</script>

<template>
  <div ref="root" class="destination-field" @focusout="leave">
    <label :for="id">Destination</label>
    <div class="destination-search">
      <input ref="input" :id="id" :value="modelValue" :data-testid="testid || undefined" name="destination"
        type="text" role="combobox" aria-autocomplete="list" :aria-expanded="showResults"
        :aria-controls="`${id}-results`" :aria-activedescendant="showResults && active >= 0 ? `${id}-option-${active}` : undefined"
        :aria-describedby="`${id}-hint`" maxlength="100" placeholder="Search a city or country" autocomplete="off"
        required @input="change" @keydown="onKey" @focus="focusSearch" />
      <div v-if="showResults" class="destination-results">
        <ul :id="`${id}-results`" role="listbox" aria-label="Destination suggestions">
          <li v-for="(place, index) in results" :key="place.id ?? index" role="presentation">
            <button :id="`${id}-option-${index}`" type="button" role="option" tabindex="-1" :aria-selected="active === index"
              @mousedown.prevent @click="choose(place)">
              <span>{{ destinationLabel(place) }}</span>
            </button>
          </li>
        </ul>
        <PlaneLoader v-if="loading" compact class="search-status" label="Searching destinations…" />
        <p v-else-if="status" class="search-status" role="status">{{ status }}</p>
        <button v-if="error" type="button" class="secondary-action search-retry" @click="search(modelValue.trim())">Try again</button>
      </div>
    </div>
    <p :id="`${id}-hint`" class="destination-hint" role="status">
      <template v-if="location?.scope === 'country'">Country selected. Choose a city for more local weather conditions.</template>
      <template v-else-if="location">Location selected. Weather will use this place.</template>
      <template v-else>Choose a suggested city for local weather. Countries are also supported.</template>
    </p>
  </div>
</template>

<style scoped>
.destination-field { display: grid; min-width: 0; gap: .5rem; }
.destination-field > label { font-weight: 500; }
.destination-search { position: relative; min-width: 0; }
.destination-search input { width: 100%; min-width: 0; min-height: 44px; padding: .8rem 1rem; border: 1px solid var(--travel-control-border); border-radius: .6rem; background: var(--travel-bg); color: var(--travel-text); font: inherit; }
.destination-search input::placeholder { color: var(--travel-muted); opacity: 1; }
.destination-results { position: absolute; inset-inline: 0; top: calc(100% + .4rem); z-index: 10; max-height: 15rem; overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--travel-border); border-radius: .75rem; background: var(--travel-panel); box-shadow: 0 12px 28px rgb(0 0 0 / .25); }
.destination-results ul { margin: 0; padding: .35rem; list-style: none; }
.destination-results [role="option"] { display: grid; gap: .25rem; width: 100%; min-height: 44px; padding: .7rem .8rem; border: 0; border-radius: .4rem; background: transparent; color: var(--travel-text); text-align: start; font: inherit; overflow-wrap: anywhere; }
.destination-results [aria-selected="true"], .destination-results [role="option"]:focus-visible { background: var(--travel-selected); }
.destination-hint, .search-status { margin: 0; font-size: .8rem; line-height: 1.5; color: var(--travel-muted); }
.search-status { padding: .8rem; }
.search-retry { margin: 0 .8rem .8rem; font-size: .8rem; }
@media (hover: hover) { .destination-results [role="option"]:hover { background: var(--travel-selected); } }
</style>
