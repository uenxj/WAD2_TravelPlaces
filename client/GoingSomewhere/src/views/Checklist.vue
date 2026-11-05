<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import TripBackLink from '../components/TripBackLink.vue'
import QuickPack from '../../components/checklist/QuickPack.vue'
import EssentialsAlert from '../../components/checklist/EssentialsAlert.vue'
import SuitcaseStage from '../../components/checklist/SuitcaseStage.vue'
import FinalReview from '../../components/checklist/FinalReview.vue'
import CategoryModal from '../../components/checklist/CategoryModal.vue'
import { checklistApi } from '../checklist/api.js'
import { itineraryApi } from '../itinerary/api.js'
import { tripSignals } from '../checklist/tripSignals.js'
import { SAMPLE_TRIPS } from '../data/sampleTrips.js'
import {
  CATEGORIES, DEFAULT_KEYS, TRIP_TYPES, ITEMS,
  suggestionsFor, withoutExisting, toNewItem, guessCategory, generatePlan,
} from '../checklist/catalog.js'

// Same trip convention as the budget planner: a tripId prop when embedded in a
// trip page, otherwise ?trip=<id>, default demo-trip.
const props = defineProps({
  tripId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})
const route = useRoute()
const tripId = computed(() => props.tripId || (typeof route.query.trip === 'string' && route.query.trip) || 'demo-trip')
const trip = ref(null) // the real trip from the itinerary feature, when this checklist belongs to one

const items = ref([])
const status = ref('loading') // loading | ready | error
const loadError = ref('')
const pending = ref(new Set()) // item ids with a request in flight
const adding = ref(false)
const form = ref({ name: '', category: 'Essentials', priority: 'essential' })
const quickPackOpen = ref(false)

// Smart sorting: pick the category from what is typed, until the user chooses one themselves.
const categoryChosen = ref(false)
const autoSorted = ref(false)
watch(() => form.value.name, (name) => {
  if (categoryChosen.value) return
  const guess = guessCategory(name)
  autoSorted.value = !!guess
  if (guess) form.value.category = guess
})
function chooseCategory() {
  categoryChosen.value = true
  autoSorted.value = false
}

// ----- load -----
async function load() {
  const requestedTrip = tripId.value
  status.value = 'loading'
  celebrate = false
  try {
    const list = await checklistApi.list(requestedTrip)
    if (requestedTrip !== tripId.value) return // trip changed while loading
    items.value = list
    status.value = 'ready'
    await nextTick()
    celebrate = true // only celebrate progress the user makes, not loading a list
  } catch (err) {
    if (requestedTrip !== tripId.value) return
    loadError.value = err.message
    status.value = 'error'
  }
}
watch(tripId, () => {
  tripTypes.value = readTripTypes()
  notNeeded.value = readStored('notNeeded')
  finalChecked.value = readStored('finalCheck') === true
  query.value = ''
  openCategory.value = null
  load()
  loadTrip()
})

// ----- progress -----
const packedCount = computed(() => items.value.filter((i) => i.done).length)
const remaining = computed(() => items.value.length - packedCount.value)
const essentialsLeft = computed(() => items.value.filter((i) => !i.done && i.priority === 'essential').length)
const percent = computed(() => (items.value.length ? Math.round((packedCount.value / items.value.length) * 100) : 0))
const stage = computed(() => {
  if (!items.value.length) return 'Nothing to pack yet'
  if (percent.value === 100) return 'Ready to fly'
  if (essentialsLeft.value === 0) return 'All essentials packed'
  if (percent.value >= 80) return 'Almost there'
  if (percent.value >= 50) return 'Halfway there'
  if (percent.value > 0) return 'Packing in progress'
  return 'Not started'
})

const essentialCount = computed(() => items.value.filter((i) => i.priority === 'essential').length)
// Airport-style code for the boarding pass: destination "Tokyo, Japan" or id "preview-tokyo" -> "TOK"
const tripCode = computed(() => {
  const source = trip.value?.destination ?? tripId.value.split(/[-_]/).filter(Boolean).pop() ?? ''
  return source.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'TRP'
})

// Passport stamps: one per category in use, inked once every item in it is packed.
const stamps = computed(() =>
  CATEGORIES.map((c) => {
    const all = items.value.filter((i) => i.category === c.name)
    const packed = all.filter((i) => i.done).length
    return { ...c, total: all.length, packed, complete: all.length > 0 && packed === all.length }
  }).filter((s) => s.total),
)
const FINAL_ICON = '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5"/>'

// Milestone messages when progress passes 25 / 50 / 75 %.
let celebrate = false
const MILESTONES = [
  [75, '75% packed: nearly at the gate ✈'],
  [50, 'Halfway there! Your suitcase is taking shape'],
  [25, 'A quarter packed. Great start!'],
]
watch(percent, (now, before) => {
  if (!celebrate || now <= before || now === 100) return
  const hit = MILESTONES.find(([m]) => before < m && now >= m)
  if (hit) notify(hit[1], 'milestone')
})

const query = ref('')
const sections = computed(() => {
  const q = query.value.trim().toLowerCase()
  const show = (i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
  return CATEGORIES.map((c) => {
    const all = items.value.filter((i) => i.category === c.name)
    return { ...c, all, shown: all.filter(show) }
  }).filter((s) => s.shown.length)
})

// ----- category cards -----
// One small card per category; "Edit" opens all its items in a pop-up.
const openCategory = ref(null) // category name shown in the pop-up
const openSection = computed(() => sections.value.find((s) => s.name === openCategory.value) ?? null)
watch(openSection, (s) => { if (!s) openCategory.value = null }) // its last item was removed or searched away

// ----- per-trip preferences kept in this browser (not shared) -----
const storageKey = (name) => `checklist:${name}:${tripId.value}`
function readStored(name) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(name))) ?? []
  } catch {
    return []
  }
}
function writeStored(name, value) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value))
  } catch {
    // storage blocked: the choice just won't be remembered
  }
}

// ----- trip types and suggestions -----
const readTripTypes = () => readStored('tripTypes')
const tripTypes = ref(readTripTypes())
watch(tripTypes, (v) => writeStored('tripTypes', v), { deep: true })

// Critical items the user said this trip doesn't need (e.g. no passport for a domestic trip).
const notNeeded = ref(readStored('notNeeded'))
watch(notNeeded, (v) => writeStored('notNeeded', v), { deep: true })
function dismissEssential(key) {
  notNeeded.value = [...new Set([...notNeeded.value, key])]
  notify(`Got it: ${ITEMS[key].name} isn't needed for this trip`, 'ok', () => {
    notNeeded.value = notNeeded.value.filter((k) => k !== key)
    notice.value = null
  })
}

// ----- final departure review -----
// Done once everything is packed; unpacking anything afterwards resets it.
const finalChecked = ref(readStored('finalCheck') === true)
const finalOpen = ref(false)
watch(finalChecked, (v) => writeStored('finalCheck', v))
watch(percent, (now) => {
  if (status.value === 'ready' && items.value.length && now < 100 && finalChecked.value) finalChecked.value = false
})
function finishReview() {
  finalOpen.value = false
  finalChecked.value = true
  notify('Cleared for departure. Have a great trip! ✈', 'milestone')
}

// ----- generate a full list for the trip (the "Step 1" panel on an empty list) -----
const generating = ref(false)
const tripTypeLabel = computed(() =>
  TRIP_TYPES.filter((t) => tripTypes.value.includes(t.id)).map((t) => t.label).join(' + '),
)
const planSize = computed(() => generatePlan(planInput.value).length)
async function generateList() {
  if (generating.value) return
  generating.value = true
  adding.value = true
  try {
    const plan = generatePlan(planInput.value)
    const body = plan.map((p) => toNewItem(p.key, p.source, p.reason))
    let added = []
    for (let i = 0; i < body.length; i += 50) { // the batch API takes up to 50 at a time
      added = added.concat((await checklistApi.addMany(tripId.value, body.slice(i, i + 50))).added)
    }
    items.value.push(...added)
    notify(`Packed ${added.length} items into your suitcase${tripTypeLabel.value ? ` for your ${tripTypeLabel.value} trip` : ''}. Remove anything you don't need`, 'milestone')
  } catch (err) {
    notify(err.message, 'error')
    await load()
  } finally {
    generating.value = false
    adding.value = false
  }
}

// Add one catalogue item by key (from "Don't forget").
function addKey(key) {
  addCatalog([{ key, ...ITEMS[key] }], 'default')
}

function toggleTripType(id) {
  const set = new Set(tripTypes.value)
  set.has(id) ? set.delete(id) : set.add(id)
  tripTypes.value = TRIP_TYPES.map((t) => t.id).filter((t) => set.has(t))
}

// ----- what the recommendations are based on -----
// The trip types the user picks and, for a real trip, its itinerary activities (itinerary feature)
// plus its destination and weather (weather module) as signals, e.g. { tag: 'cold', reason: '…' }.
// See src/checklist/RECOMMENDATIONS.md.
const itineraryActivities = ref([])
const contextSignals = ref([])
const weatherDays = ref(0) // days the weather module answered for
const tripLoading = ref(false)

async function loadTrip() {
  const requestedTrip = tripId.value
  trip.value = null
  itineraryActivities.value = []
  contextSignals.value = []
  weatherDays.value = 0
  tripLoading.value = false
  if (requestedTrip === 'demo-trip') return
  // "Generate" waits for this (weather takes a few seconds), but never more than 15 s.
  tripLoading.value = true
  try {
    await Promise.race([loadTripContext(requestedTrip), new Promise((resolve) => setTimeout(resolve, 15000))])
  } finally {
    if (requestedTrip === tripId.value) tripLoading.value = false
  }
}

async function loadTripContext(requestedTrip) {
  if (requestedTrip.startsWith('preview-')) {
    // Sample trips (preview mode): their illustrative itinerary in src/data/sampleTrips.js, in the
    // same shape as a real trip from the itinerary API.
    const sample = SAMPLE_TRIPS.find((t) => `preview-${t.id}` === requestedTrip)
    if (!sample) return
    trip.value = {
      name: sample.name, destination: sample.place, timezone: sample.timezone,
      center: { lat: sample.latitude, lng: sample.longitude },
      startDate: sample.days[0].date, endDate: sample.days.at(-1).date,
    }
    itineraryActivities.value = sample.days.flatMap((d) => d.activities.map((a) => ({ title: a.name, date: a.date })))
  } else {
    try {
      const [found, activities] = await Promise.all([
        itineraryApi.getTrip(requestedTrip),
        itineraryApi.listItems(requestedTrip),
      ])
      if (requestedTrip !== tripId.value) return
      trip.value = found
      itineraryActivities.value = activities.map((a) => ({ title: a.title, date: a.date }))
    } catch {
      return // Not a trip this user can open (or not signed in): the checklist still works on its own.
    }
  }
  // Weather arrives a moment later; suggestions update when it does.
  let context
  try {
    context = await tripSignals(trip.value)
  } catch {
    return // no destination or weather ideas; the rest of the suggestions still work
  }
  if (requestedTrip !== tripId.value) return
  contextSignals.value = context.signals
  weatherDays.value = context.weatherDays
}

// What "Generate" uses, shown in short above the button.
const WEATHER_WORDS = { rain: 'Rainy', hot: 'Hot', cold: 'Cold', snow: 'Snowy' }
const basis = computed(() => {
  const t = trip.value
  const acts = itineraryActivities.value.length
  const abroad = contextSignals.value.some((s) => s.tag === 'abroad')
  const weather = contextSignals.value.map((s) => WEATHER_WORDS[s.tag]).filter(Boolean)
  return [
    { icon: '📍', label: 'Destination', used: !!t?.destination,
      text: t?.destination ? `${t.destination.split(',')[0]}${abroad ? ' · abroad' : ''}` : 'Not linked' },
    { icon: '🗓', label: 'Itinerary', used: !!acts,
      text: acts ? `${acts} activit${acts === 1 ? 'y' : 'ies'}` : 'No activities' },
    { icon: '🌦', label: 'Weather', used: !!weather.length || weatherDays.value > 0,
      text: tripLoading.value ? 'Checking…' : weather.length ? weather.join(', ') : weatherDays.value ? 'Mild' : 'No data' },
  ]
})

const planInput = computed(() => ({
  tripTypes: tripTypes.value,
  signals: contextSignals.value,
  activities: itineraryActivities.value,
}))

const suggestions = computed(() => withoutExisting(suggestionsFor(planInput.value), items.value))
const missingDefaults = computed(() =>
  withoutExisting(DEFAULT_KEYS.map((key) => ({ key, ...ITEMS[key] })), items.value),
)

// ----- notices -----
const notice = ref(null) // { text, kind: 'ok' | 'error', undo? }
let noticeTimer = null
function notify(text, kind = 'ok', undo = null) {
  clearTimeout(noticeTimer)
  notice.value = { text, kind, undo }
  if (!undo && kind !== 'error') noticeTimer = setTimeout(() => (notice.value = null), 3000)
}
onBeforeUnmount(() => clearTimeout(noticeTimer))

// The ideas list shows two suggestions, the rest scroll. Items differ in height (one or two lines
// of reasons), so the height is measured rather than fixed in CSS.
const SHOWN_SUGGESTIONS = 2
const suggestionList = ref(null)
function fitSuggestions() {
  const list = suggestionList.value
  if (!list) return
  list.style.maxHeight = ''
  const last = list.children[SHOWN_SUGGESTIONS - 1]
  if (!list.children[SHOWN_SUGGESTIONS]) return
  list.style.maxHeight = `${last.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop}px`
}
watch(() => suggestions.value.map((s) => s.key).join(), () => nextTick(fitSuggestions))
watch(status, () => nextTick(fitSuggestions))
window.addEventListener('resize', fitSuggestions)
onBeforeUnmount(() => window.removeEventListener('resize', fitSuggestions))

function setPending(id, on) {
  const next = new Set(pending.value)
  on ? next.add(id) : next.delete(id)
  pending.value = next
}
function replaceItem(updated) {
  const i = items.value.findIndex((x) => x.id === updated.id)
  if (i !== -1) items.value[i] = updated
}

// ----- actions -----
async function addCustom() {
  const name = form.value.name.trim()
  if (!name || adding.value) return
  if (items.value.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
    return notify(`“${name}” is already on your list`, 'error')
  }
  adding.value = true
  try {
    const item = await checklistApi.add(tripId.value, { ...form.value, name, source: 'custom' })
    items.value.push(item)
    form.value.name = ''
    categoryChosen.value = false
    autoSorted.value = false
    notify(`Added “${item.name}” to ${item.category}`)
  } catch (err) {
    notify(err.message, 'error')
  } finally {
    adding.value = false
  }
}

async function addCatalog(entries, source) {
  if (!entries.length || adding.value) return
  adding.value = true
  try {
    const body = entries.map((s) => toNewItem(s.key, source, source === 'suggested' ? s.reason : null))
    const { added, skipped } = await checklistApi.addMany(tripId.value, body)
    items.value.push(...added)
    const plural = (n) => `${n} item${n === 1 ? '' : 's'}`
    if (added.length) notify(`Packed ${plural(added.length)} into your suitcase${skipped ? ` · ${skipped} already listed` : ''}`)
    else notify('Those are already on your list')
    if (skipped) await load() // someone else added them; show the current list
  } catch (err) {
    notify(err.message, 'error')
  } finally {
    adding.value = false
  }
}

async function toggle(item) {
  const done = !item.done
  item.done = done // optimistic; reverted below if the save fails
  setPending(item.id, true)
  try {
    replaceItem(await checklistApi.update(item.id, { done }))
  } catch (err) {
    item.done = !done
    notify(`Couldn't update “${item.name}”: ${err.message}`, 'error')
    if (err.status === 404) await load()
  } finally {
    setPending(item.id, false)
  }
}

async function save(item, patch) {
  setPending(item.id, true)
  try {
    replaceItem(await checklistApi.update(item.id, patch))
    notify('Saved')
  } catch (err) {
    notify(`Couldn't save: ${err.message}`, 'error')
    if (err.status === 404) await load()
  } finally {
    setPending(item.id, false)
  }
}

async function remove(item) {
  setPending(item.id, true)
  try {
    await checklistApi.remove(item.id)
    items.value = items.value.filter((i) => i.id !== item.id)
    notify(`Removed “${item.name}”`, 'ok', () => restore(item))
  } catch (err) {
    if (err.status === 404) {
      items.value = items.value.filter((i) => i.id !== item.id)
    } else {
      notify(`Couldn't delete: ${err.message}`, 'error')
    }
  } finally {
    setPending(item.id, false)
  }
}

// Undo a delete by re-creating the item (it gets a new id).
async function restore(item) {
  notice.value = null
  const { name, category, priority, source, reason, suggestionKey, done } = item
  try {
    const restored = suggestionKey
      ? (await checklistApi.addMany(tripId.value, [{ name, category, priority, source, reason, suggestionKey, done }])).added[0]
      : await checklistApi.add(tripId.value, { name, category, priority, source, reason, done })
    if (!restored) return load()
    items.value.push(restored)
    notify(`Restored “${name}”`)
  } catch (err) {
    notify(`Couldn't restore: ${err.message}`, 'error')
  }
}

load()
loadTrip()
</script>

<template>
  <component :is="embedded ? 'section' : 'main'" class="checklist-page" :class="{ embedded }">
    <div :class="embedded ? 'checklist-body' : 'content-page checklist-body'">
      <TripBackLink v-if="!embedded" :trip-id="tripId" />

      <!-- Passport header -->
      <header class="passport">
        <div class="passport-top">
          <div>
            <p class="eyebrow">Packing passport</p>
            <component :is="embedded ? 'h2' : 'h1'" class="title">{{ embedded ? 'Packing checklist' : 'Packing list' }}</component>
            <p class="trip">Trip · <span data-testid="trip-id">{{ trip?.name ?? tripId }}</span></p>
          </div>
          <dl class="stats" v-if="status === 'ready'">
            <div>
              <dt>Packed</dt>
              <dd data-testid="packed">{{ packedCount }}</dd>
            </div>
            <div>
              <dt>To pack</dt>
              <dd data-testid="remaining">{{ remaining }}</dd>
            </div>
            <div>
              <dt>Essentials left</dt>
              <dd :class="{ warn: essentialsLeft }">{{ essentialsLeft }}</dd>
            </div>
          </dl>
        </div>

        <div class="route" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"
          :aria-label="`Packing progress: ${percent}%`">
          <span class="stop start">Home</span>
          <div class="track">
            <div class="track-fill" :style="{ width: percent + '%' }"></div>
            <span class="plane" :style="{ left: percent + '%', transform: `translate(-${percent}%, -54%)` }"
              aria-hidden="true">✈</span>
          </div>
          <span class="stop end">Departure</span>
        </div>
        <p class="stage"><strong>{{ percent }}%</strong> · {{ stage }}</p>

        <ul v-if="status === 'ready' && stamps.length" class="stamps" aria-label="Passport stamps by category"
          data-testid="stamps">
          <li v-for="s in stamps" :key="s.name" class="stamp" :class="{ inked: s.complete }"
            :aria-label="`${s.name}: ${s.complete ? 'stamped, all packed' : `${s.packed} of ${s.total} packed`}`">
            <span class="stamp-ring" :style="{ '--fill': (s.packed / s.total) * 360 + 'deg' }" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" v-html="s.icon"></svg>
            </span>
            <span class="stamp-name" aria-hidden="true">{{ s.complete ? 'Cleared' : `${s.packed}/${s.total}` }}</span>
            <span class="stamp-cat" aria-hidden="true">{{ s.name }}</span>
          </li>
          <li class="stamp final" :class="{ inked: finalChecked && percent === 100 }"
            :aria-label="`Final check: ${finalChecked && percent === 100 ? 'stamped' : 'pending'}`">
            <span class="stamp-ring" style="--fill: 0deg" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" v-html="FINAL_ICON"></svg>
            </span>
            <span class="stamp-name" aria-hidden="true">{{ finalChecked && percent === 100 ? 'Cleared' : 'Pending' }}</span>
            <span class="stamp-cat" aria-hidden="true">Final check</span>
          </li>
        </ul>
      </header>

      <!-- Interactive suitcase: tap or drag items in; the lid closes at 100% -->
      <SuitcaseStage v-if="status === 'ready' && items.length" class="mt-3 mb-0" :items="items" :pending="pending"
        :trip-code="tripCode" :cleared="finalChecked" @toggle="toggle" />

      <!-- Empty list: build it from the trip, then the user reviews what we packed -->
      <section v-if="status === 'ready' && !items.length" class="generator mt-3" data-testid="generator">
        <p class="eyebrow mb-1">Step 1</p>
        <h2 class="gen-title">We'll pack for you</h2>
        <p class="hint mb-3">Based on your trip. You just review it.</p>
        <ul class="gen-basis" aria-label="What the list is based on">
          <li v-for="b in basis" :key="b.label" :class="{ off: !b.used }">
            <span class="gen-icon" aria-hidden="true">{{ b.icon }}</span>
            <span><strong>{{ b.label }}</strong>{{ b.text }}</span>
          </li>
        </ul>
        <p class="gen-label">Trip type <span>optional</span></p>
        <div class="chips">
          <button v-for="t in TRIP_TYPES" :key="t.id" type="button" class="chip"
            :class="{ on: tripTypes.includes(t.id) }" :aria-pressed="tripTypes.includes(t.id)"
            @click="toggleTripType(t.id)">
            <span aria-hidden="true">{{ t.emoji }}</span> {{ t.label }}
          </button>
        </div>
        <button type="button" class="primary-action gen-btn" :disabled="adding || tripLoading" data-testid="generate" @click="generateList">
          {{ generating ? 'Packing…' : tripLoading ? 'Checking the weather…' : `Generate · ${planSize} items` }}
        </button>
      </section>

      <!-- Add item -->
      <form class="add-form" @submit.prevent="addCustom" v-if="status === 'ready' && items.length">
        <label class="visually-hidden" for="new-item">New item</label>
        <input id="new-item" v-model="form.name" class="form-control" maxlength="80"
          placeholder="Add something to pack…" autocomplete="off" data-testid="new-item">
        <select v-model="form.category" class="form-select" :class="{ auto: autoSorted && form.name.trim() }"
          aria-label="Category" @change="chooseCategory">
          <option v-for="c in CATEGORIES" :key="c.name">{{ c.name }}</option>
        </select>
        <select v-model="form.priority" class="form-select" aria-label="Priority">
          <option value="essential">Essential</option>
          <option value="optional">Optional</option>
        </select>
        <button class="primary-action" :disabled="adding || !form.name.trim()" data-testid="add-item">+ Add</button>
        <p class="auto-hint" aria-live="polite">
          <template v-if="autoSorted && form.name.trim()">✦ Smart sort: this looks like <strong>{{ form.category }}</strong>. Change it if you like.</template>
        </p>
      </form>

      <!-- Everything packed but not yet reviewed: last step before the boarding pass -->
      <Transition name="pass">
        <section v-if="status === 'ready' && items.length && percent === 100 && !finalChecked" class="final-call"
          data-testid="final-call">
          <div>
            <p class="eyebrow mb-1">Last step</p>
            <h2 class="final-title">Everything's in the bag. Ready for the final check?</h2>
            <p class="final-sub">Confirm the trip-critical items and lock up. Then your boarding pass is issued.</p>
          </div>
          <button type="button" class="primary-action" data-testid="start-final" @click="finalOpen = true">
            Start final check
          </button>
        </section>
      </Transition>

      <!-- Boarding pass: appears once everything is packed and the final check is done -->
      <Transition name="pass">
        <section v-if="status === 'ready' && items.length && percent === 100 && finalChecked" class="boarding-pass"
          aria-label="Boarding pass: everything is packed" data-testid="boarding-pass">
          <div class="bp-main">
            <p class="eyebrow mb-2">Boarding pass · Packing cleared</p>
            <div class="bp-route">
              <div>
                <span class="bp-code">HME</span>
                <small>Home</small>
              </div>
              <span class="bp-path" aria-hidden="true"><span>✈</span></span>
              <div class="text-end">
                <span class="bp-code">{{ tripCode }}</span>
                <small>{{ tripId }}</small>
              </div>
            </div>
            <dl class="bp-meta">
              <div><dt>Items</dt><dd>{{ items.length }}</dd></div>
              <div><dt>Essentials</dt><dd>{{ essentialCount }}/{{ essentialCount }}</dd></div>
              <div><dt>Gate</dt><dd>Front door</dd></div>
              <div><dt>Status</dt><dd class="bp-ok">Ready to fly</dd></div>
            </dl>
          </div>
          <div class="bp-stub" aria-hidden="true">
            <span class="bp-barcode"></span>
            <small>{{ tripCode }} · {{ items.length }} PCS</small>
          </div>
        </section>
      </Transition>

      <!-- Loading -->
      <div v-if="status === 'loading'" class="row g-3" aria-busy="true" aria-label="Loading checklist">
        <div class="col-12 col-md-6" v-for="n in 4" :key="n">
          <div class="sheet skeleton"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="status === 'error'" class="sheet error-sheet" role="alert" data-testid="error">
        <h2 class="h5">We couldn't open your checklist</h2>
        <p class="mb-3">{{ loadError }}</p>
        <button class="primary-action" @click="load">Try again</button>
      </div>

      <template v-else>
      <EssentialsAlert v-if="items.length" :items="items" :not-needed="notNeeded" :busy="adding"
        @add="addKey" @toggle="toggle" @dismiss="dismissEssential" />

      <div v-if="items.length" class="row g-3 g-lg-4">

        <!-- Checklist -->
        <section class="col-12 col-lg-8" aria-label="Packing items">
          <div class="review-panel">
            <!-- Review: the suitcase above is for packing, this list is for checking what's in it -->
            <div class="toolbar">
              <div class="review-head">
                <h2 class="section-title mb-0">Review your list</h2>
                <p class="hint my-0">Why each item is here. Edit or remove what you don't need.</p>
              </div>
              <label class="search">
                <span class="visually-hidden">Search items</span>
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m20 20-4.5-4.5" />
                </svg>
                <input v-model="query" type="search" placeholder="Search items…" autocomplete="off" data-testid="search">
              </label>
              <button v-if="remaining" type="button" class="primary-action sm quick-btn" data-testid="quick-pack"
                @click="quickPackOpen = true">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <rect x="3" y="8" width="18" height="12" rx="2" />
                  <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 12v4M10 14h4" />
                </svg>
                Quick pack
              </button>
            </div>

            <p v-if="!sections.length" class="sheet empty-filter">
              No items match “{{ query.trim() }}”.
              <button type="button" class="link-btn" @click="query = ''">Clear search</button>
            </p>

            <div class="sections">
              <section v-for="s in sections" :key="s.name" class="sheet category" :data-testid="`category-${s.name}`">
                <h3 class="cat-head">
                  <span class="cat-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" v-html="s.icon"></svg>
                  </span>
                  <span class="cat-name">{{ s.name }}</span>
                  <span class="cat-count">{{ s.shown.length }}</span>
                </h3>
                <button type="button" class="primary-action sm cat-edit" :aria-label="`Edit ${s.name}`"
                  :data-testid="`open-${s.name}`" @click="openCategory = s.name">Edit</button>
              </section>
            </div>
          </div>
        </section>

        <aside class="col-12 col-lg-4">
          <section class="sheet ideas" aria-labelledby="ideas-title">
            <div class="ideas-head">
              <h2 id="ideas-title" class="section-title mb-0">Trip-specific ideas</h2>
              <p class="hint my-0">More ideas, straight into your suitcase.</p>
            </div>
            <div class="chips">
              <button v-for="t in TRIP_TYPES" :key="t.id" type="button" class="chip"
                :class="{ on: tripTypes.includes(t.id) }" :aria-pressed="tripTypes.includes(t.id)"
                @click="toggleTripType(t.id)">
                <span aria-hidden="true">{{ t.emoji }}</span> {{ t.label }}
              </button>
              <button v-if="tripTypes.length" type="button" class="link-btn deselect" data-testid="deselect-trip-types"
                @click="tripTypes = []">Deselect all</button>
            </div>

            <template v-if="suggestions.length">
              <ul ref="suggestionList" class="suggestions">
                <li v-for="s in suggestions" :key="s.key">
                  <div class="min-w-0">
                    <span class="s-name">{{ s.name }}
                      <span class="s-level" :class="s.level.split(' ')[0].toLowerCase()"
                        :title="`Relevance score ${s.score}`">{{ s.level }}</span></span>
                    <span class="s-why">{{ s.category }} · {{ s.reason }}<template v-if="s.priority === 'optional'"> ·
                        optional</template></span>
                  </div>
                  <button type="button" class="secondary-action sm" :disabled="adding"
                    :aria-label="`Add ${s.name}`" @click="addCatalog([s], 'suggested')">+ Add</button>
                </li>
              </ul>
              <button type="button" class="primary-action sm w-100" :disabled="adding"
                @click="addCatalog(suggestions, 'suggested')">Add all {{ suggestions.length }}</button>
            </template>
            <p v-else-if="tripTypes.length" class="hint mb-0">✓ Everything suggested is already on your list.</p>
          </section>

          <section v-if="missingDefaults.length" class="sheet ideas mt-3">
            <h2 class="section-title">Starter essentials</h2>
            <p class="hint">{{ missingDefaults.length }} common item{{ missingDefaults.length === 1 ? ' is' : 's are' }}
              not on your list yet: {{ missingDefaults.slice(0, 3).map((d) => d.name).join(', ') }}{{
                missingDefaults.length > 3 ? '…' : '' }}</p>
            <button type="button" class="secondary-action sm" :disabled="adding"
              data-testid="add-defaults" @click="addCatalog(missingDefaults, 'default')">Add the {{ missingDefaults.length }} basics</button>
          </section>
        </aside>
      </div>
      </template>
    </div>

    <QuickPack v-if="quickPackOpen" :items="items" @toggle="toggle" @close="quickPackOpen = false" />
    <CategoryModal v-if="openSection" :section="openSection" :pending="pending" @close="openCategory = null"
      @toggle="toggle" @save="save" @remove="remove" />
    <FinalReview v-if="finalOpen" :items="items" @done="finishReview" @close="finalOpen = false" />

    <Transition name="toast">
      <div v-if="notice" class="toast-note" :class="notice.kind" role="status" aria-live="polite">
        <span>{{ notice.text }}</span>
        <button v-if="notice.undo" type="button" class="undo" @click="notice.undo()">Undo</button>
        <button type="button" class="close-note" aria-label="Dismiss" @click="notice = null">×</button>
      </div>
    </Transition>
  </component>

</template>

<style scoped>
/* Uses the shared theme in src/styles/app.css (--travel-* variables, .eyebrow,
   .primary-action, .secondary-action) so the checklist matches the other trip tabs. */
.checklist-page {
  color: var(--travel-text);
}

/* ---------- trip progress header ---------- */
.passport {
  position: relative;
  overflow: hidden;
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: linear-gradient(120deg, #19273d 0%, #1d3a3c 100%);
}

.passport::after {
  /* faint passport-cover ring */
  content: '';
  position: absolute;
  right: -70px;
  top: -70px;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  border: 1px solid rgba(185, 221, 210, 0.16);
  box-shadow: 0 0 0 16px rgba(185, 221, 210, 0.04), 0 0 0 32px rgba(185, 221, 210, 0.03);
  pointer-events: none;
}

.passport-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
}

.title {
  margin: 0;
  font-size: var(--travel-heading-size);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.trip {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--travel-muted);
  overflow-wrap: anywhere;
}

.trip a {
  color: var(--travel-accent);
}

.stats {
  display: flex;
  gap: 0.5rem;
  margin: 0;
}

.stats div {
  min-width: 84px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--travel-border);
  border-radius: 0.75rem;
  background: rgba(16, 26, 46, 0.55);
  text-align: center;
}

.stats dt {
  font-weight: 600;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--travel-muted);
}

.stats dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
}

.stats dd.warn {
  color: #f2c879;
}

.route {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.4rem;
}

.stop {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--travel-muted);
}

.track {
  position: relative;
  flex: 1;
  height: 4px;
  background-image: linear-gradient(90deg, rgba(189, 200, 216, 0.45) 50%, transparent 50%);
  background-size: 12px 4px;
  border-radius: 2px;
}

.track-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--travel-accent);
  border-radius: 2px;
  transition: width 0.6s ease;
}

.plane {
  position: absolute;
  top: 50%;
  font-size: 1.3rem;
  color: var(--travel-accent);
  transition: left 0.6s ease, transform 0.6s ease;
  text-shadow: 0 0 10px rgba(185, 221, 210, 0.55);
}

.stage {
  margin: 0.6rem 0 0;
  font-size: 0.9rem;
  color: var(--travel-muted);
}

.stage strong {
  color: var(--travel-text);
}




/* ---------- add form (same field style as .form-stack) ---------- */
/* Blocks below the suitcase (add form, final call / boarding pass, review) are 1.5rem apart */
.add-form {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 160px 140px auto;
  gap: 0.6rem;
  margin: 1.5rem 0;
}

.form-control,
.form-select {
  --bs-form-select-bg-img: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3e%3cpath fill=%27none%27 stroke=%27%23bdc8d8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m2 5 6 6 6-6%27/%3e%3c/svg%3e");
  min-height: 46px;
  border: 1px solid var(--travel-control-border);
  border-radius: 0.6rem;
  background-color: var(--travel-bg);
  color: var(--travel-text);
}

.form-control::placeholder {
  color: var(--travel-muted);
  opacity: 1;
}

.form-control:focus,
.form-select:focus {
  background-color: var(--travel-bg);
  color: var(--travel-text);
  border-color: var(--travel-accent);
  box-shadow: none;
}

/* ---------- passport stamps ---------- */
.stamps {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.1rem;
  margin: 1.1rem 0 0;
  padding: 1rem 0 0;
  border-top: 1px dashed var(--travel-border);
  list-style: none;
}

.stamp {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  width: 72px;
  text-align: center;
}

/* Ring fills clockwise with the share of the category that's packed */
.stamp-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: conic-gradient(var(--travel-accent) var(--fill), #2a3a52 0);
  color: var(--travel-muted);
  transition: transform 0.3s ease;
}

.stamp-ring::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #1b2f3f;
}

.stamp-ring svg {
  position: relative;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.inked .stamp-ring {
  background: none;
  border: 3px double var(--travel-accent);
  color: var(--travel-accent);
  transform: rotate(-12deg);
  animation: ink 0.4s cubic-bezier(0.2, 1.4, 0.5, 1);
}

.inked .stamp-ring::before {
  inset: 0;
  background: rgba(185, 221, 210, 0.08);
}

@keyframes ink {
  from {
    transform: scale(1.7) rotate(-30deg);
    opacity: 0;
  }
}

.stamp-name {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--travel-muted);
}

.inked .stamp-name {
  color: var(--travel-accent);
}

.stamp-cat {
  font-size: 0.72rem;
  color: var(--travel-text);
  opacity: 0.85;
}

/* ---------- smart sort ---------- */
/* Floats in the gap under the form, so it takes no space and the gaps stay even */
.auto-hint {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  margin: 0;
  font-size: 0.8rem;
  color: var(--travel-accent);
}

.auto-hint strong {
  font-weight: 700;
}

.form-select.auto {
  border-color: var(--travel-accent);
  box-shadow: 0 0 0 3px rgba(185, 221, 210, 0.15);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* ---------- boarding pass ---------- */
.boarding-pass {
  display: grid;
  grid-template-columns: 1fr 150px;
  margin-bottom: 1.5rem;
  border: 1px solid var(--travel-accent);
  border-radius: 1.25rem;
  background: linear-gradient(120deg, #1d3a3c 0%, #19273d 80%);
  overflow: hidden;
}

.bp-main {
  padding: 1.25rem 1.5rem;
}

.bp-route {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bp-route small {
  display: block;
  font-size: 0.75rem;
  color: var(--travel-muted);
  overflow-wrap: anywhere;
}

.bp-code {
  display: block;
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}

.bp-path {
  position: relative;
  flex: 1;
  height: 2px;
  background-image: linear-gradient(90deg, var(--travel-accent) 50%, transparent 50%);
  background-size: 10px 2px;
}

.bp-path span {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -55%);
  padding: 0 0.4rem;
  background: #1b3240;
  color: var(--travel-accent);
  font-size: 1.2rem;
}

.bp-meta {
  display: grid;
  grid-template-columns: repeat(4, auto);
  justify-content: space-between; /* lines up with HME … PAR above */
  gap: 0.5rem 1.75rem;
  margin: 1rem 0 0;
}

.bp-meta dt {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--travel-muted);
}

.bp-meta dd {
  margin: 0;
  font-weight: 700;
}

.bp-ok {
  color: var(--travel-accent);
}

/* Tear-off stub with a perforated edge and a CSS barcode */
.bp-stub {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-left: 2px dashed var(--travel-border);
}

.bp-stub::before,
.bp-stub::after {
  content: '';
  position: absolute;
  left: -11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--travel-bg);
  border: 1px solid var(--travel-accent);
}

.bp-stub::before {
  top: -11px;
}

.bp-stub::after {
  bottom: -11px;
}

.bp-barcode {
  width: 100%;
  max-width: 110px;
  height: 64px;
  background: repeating-linear-gradient(90deg,
      var(--travel-text) 0 2px, transparent 2px 4px,
      var(--travel-text) 4px 5px, transparent 5px 8px,
      var(--travel-text) 8px 11px, transparent 11px 12px);
  opacity: 0.85;
}

.bp-stub small {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: var(--travel-muted);
}

.pass-enter-active {
  transition: transform 0.45s cubic-bezier(0.2, 1.2, 0.4, 1), opacity 0.3s ease;
}

.pass-enter-from {
  transform: translateY(-14px) scale(0.97);
  opacity: 0;
}

/* ---------- generator (empty list) ---------- */
.generator {
  margin-bottom: 1.25rem;
  padding: 1.5rem 1.6rem;
  border: 1px solid var(--travel-accent);
  border-radius: 1.25rem;
  background: linear-gradient(120deg, #1d3a3c 0%, #19273d 80%);
}

.gen-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.gen-basis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem;
}

.gen-basis li {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--travel-border);
  border-radius: 0.9rem;
  background: rgba(16, 26, 46, 0.45);
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--travel-muted);
  overflow-wrap: anywhere;
}

.gen-basis li.off { opacity: 0.6; }
.gen-basis strong { display: block; color: var(--travel-text); }
.gen-icon { font-size: 1.15rem; line-height: 1.2; }

.gen-label {
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.gen-label span {
  margin-left: 0.35rem;
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--travel-muted);
}

.gen-btn {
  display: block;
  width: 100%;
  padding: 0.85rem 1rem;
  font-size: 1.05rem;
}

/* ---------- final call ---------- */
.final-call {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1.1rem 1.4rem;
  border: 1px dashed var(--travel-accent);
  border-radius: 1.25rem;
  background: linear-gradient(120deg, #1d3a3c 0%, #19273d 80%);
}

.final-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.final-sub {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--travel-muted);
}

.final-call .primary-action {
  animation: nudge 2.4s ease-in-out infinite;
}

@keyframes nudge {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 221, 210, 0);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(185, 221, 210, 0.15);
  }
}

.stamp.final:not(.inked) .stamp-ring {
  background: none;
  border: 2px dashed var(--travel-border);
}

.stamp.final:not(.inked) .stamp-ring::before {
  display: none;
}

/* ---------- toolbar ---------- */
.review-head {
  flex: 0 0 100%;
}

/* Two blocks side by side: the review panel (heading, search, cards) and the ideas panel */
.review-panel {
  padding: 1.1rem 1.25rem 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
}

/* cards sit darker inside the panel, like the suitcase on its stage */
.review-panel .category {
  background: var(--travel-bg);
}

.ideas-head {
  margin-bottom: 0.9rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 120px;
  min-height: 38px;
  margin: 0; /* as wide as the cards below; Quick pack, when shown, sits at its end */
  padding: 0 0.85rem;
  border: 1px solid var(--travel-border);
  border-radius: 999px;
  background: var(--travel-bg);
  color: var(--travel-muted);
}

.search:focus-within {
  border-color: var(--travel-accent);
}

.search svg {
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  width: 100%;
  min-width: 0;
  padding: 0.4rem 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--travel-text);
  font-size: 0.88rem;
}

.search input::placeholder {
  color: var(--travel-muted);
}

.link-btn {
  border: 0;
  background: none;
  color: var(--travel-accent);
  text-decoration: underline;
  padding: 0;
}

.quick-btn {
  flex-shrink: 0;
}

.deselect {
  align-self: center;
  margin-left: 0.25rem;
  font-size: 0.85rem;
}

.quick-btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ---------- panels (same look as .surface) ---------- */
.sheet {
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
}

.skeleton {
  height: 160px;
  background: linear-gradient(90deg, #19273d 0%, #22344f 50%, #19273d 100%) 0 0 / 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.error-sheet {
  border-color: #c4705f;
}

.error-sheet p {
  color: var(--travel-muted);
}

.section-title,
.cat-name {
  margin: 0;
  font-size: var(--travel-section-size);
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* ---------- ideas sidebar ---------- */
.hint {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--travel-muted);
  margin: 0.4rem 0 1rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.5rem;
  margin-bottom: 1.25rem;
}

/* Same pill style as the trip tabs */
.chip {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--travel-border);
  border-radius: 999px;
  background: transparent;
  color: var(--travel-text);
  font-size: 0.85rem;
}

.chip:hover {
  border-color: var(--travel-accent);
}

.chip.on {
  background: #354d51;
  border-color: var(--travel-accent);
}

.suggestions {
  list-style: none;
  padding: 0 0.75rem 0 0; /* room between the "+ Add" buttons and the scrollbar */
  margin: 0 0 1rem;
  max-height: 380px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--travel-border) transparent;
}

.suggestions::-webkit-scrollbar {
  width: 6px;
}

.suggestions::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: var(--travel-border);
}

.suggestions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--travel-border);
}

.min-w-0 {
  min-width: 0;
}

.s-name {
  display: block;
}

/* Relevance from the recommendation score */
.s-level {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  vertical-align: 1px;
  border: 1px solid var(--travel-border);
  color: var(--travel-muted);
}

.s-level.top {
  border-color: var(--travel-accent);
  background: #24403f;
  color: var(--travel-accent);
}

.s-level.recommended {
  color: var(--travel-text);
}

.s-why {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--travel-accent);
}

/* ---------- checklist ---------- */
.empty-filter {
  text-align: center;
  color: var(--travel-muted);
}

.sections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 0.9rem;
}

/* Same-size cards: icon, name and count, with "Edit" beside them */
.category {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 0.9rem;
}

.cat-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  margin: 0;
}

/* count right after the name */
.category .cat-name {
  flex: 0 1 auto;
  font-size: 1rem;
}

.category .cat-count {
  flex-shrink: 0;
}

/* same green as the page's other main buttons (.primary-action) */
.cat-edit {
  flex-shrink: 0;
  margin-left: auto;
}

.cat-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #354d51;
  color: var(--travel-accent);
}

.cat-icon svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cat-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-count {
  font-size: 0.85rem;
  color: var(--travel-muted);
}

/* ---------- buttons: shared .primary-action / .secondary-action, plus a small size ---------- */
.primary-action:disabled,
.secondary-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sm {
  padding: 0.4rem 0.95rem;
  font-size: 0.85rem;
  white-space: nowrap;
}

.add-form .primary-action {
  padding: 0 1.4rem;
}

/* ---------- toast ---------- */
.toast-note {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 20px;
  width: fit-content;
  max-width: 520px;
  margin: 0 auto;
  z-index: 1070; /* above the pop-ups, so "Undo" still works from inside one */
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem 0.65rem 1rem;
  border: 1px solid #6c8a87;
  border-radius: 0.75rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.toast-note.milestone {
  border-color: var(--travel-accent);
  background: linear-gradient(110deg, #10312f, #425e5c);
  font-weight: 600;
}

.toast-note.error {
  border-color: #c4705f;
  background: #3a2328;
}

.undo {
  border: 0;
  background: none;
  color: var(--travel-accent);
  font-weight: 600;
  padding: 0 0.25rem;
}

.close-note {
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  font-size: 1.3rem;
  line-height: 1;
  opacity: 0.7;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* ---------- responsive ---------- */
@media (max-width: 767.98px) {
  .add-form {
    grid-template-columns: 1fr 1fr;
  }

  .add-form input,
  .add-form button {
    grid-column: 1 / -1;
  }

  .add-form .primary-action {
    min-height: 46px;
  }


}

@media (max-width: 575.98px) {
  .boarding-pass {
    grid-template-columns: 1fr;
  }

  .bp-main {
    padding: 1rem;
  }

  .bp-code {
    font-size: 1.7rem;
  }

  .bp-meta {
    grid-template-columns: repeat(2, auto);
  }

  .bp-stub {
    grid-template-columns: 1fr auto;
    align-items: center;
    border-left: 0;
    border-top: 2px dashed var(--travel-border);
  }

  .bp-stub::before,
  .bp-stub::after {
    top: -11px;
    bottom: auto;
  }

  .bp-stub::before {
    left: -11px;
  }

  .bp-stub::after {
    left: auto;
    right: -11px;
  }

  .bp-barcode {
    max-width: none;
    height: 36px;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .search {
    max-width: none;
    min-height: 40px;
    margin: 0;
    flex-basis: 100%;
  }

  .stamps {
    gap: 0.6rem 0.4rem;
  }

  .stamp {
    width: 64px;
  }

  .quick-btn {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .stats {
    width: 100%;
  }

  .stats div {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0.25rem;
  }

  .stats dt {
    font-size: 0.6rem;
  }

  .sheet {
    padding: 0.9rem 0.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {

  .skeleton,
  .pass-enter-active,
  .final-call .primary-action,
  .inked .stamp-ring,
  .track-fill,
  .plane {
    animation: none;
    transition: none;
  }
}
</style>
