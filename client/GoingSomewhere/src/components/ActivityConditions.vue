<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getActivityConditions } from '../weather/api.js'
import { aqiCategory, isNumber, planningHints, psiCategory } from '../weather/conditions.js'
import { reviewActivities } from '../weather/review.js'
import { planningIssues } from '../planning/review.js'

const props = defineProps({
  activity: { type: Object, required: true }, compact: Boolean,
  heading: { type: String, default: '' },
  activities: { type: Array, default: null }, budget: { type: Object, default: null },
  plannedActivities: { type: Array, default: null },
  tripId: { type: String, default: '' }, externalIssues: { type: Array, default: () => [] },
})
const emit = defineEmits(['conditions', 'planning-issues', 'refreshed'])
const result = ref(null)
const review = ref(null)
const budgetStatus = ref('')
const missingEstimates = ref(0)
const loading = ref(false)
const error = ref('')
let generation = 0
const weather = computed(() => result.value?.weather)
const air = computed(() => result.value?.air)
const hints = computed(() => {
  if (props.compact) return []
  if (!props.activities) return planningHints(props.activity, weather.value, air.value)
  const preparation = review.value?.outdoorCount && weather.value?.kind === 'seasonal' ? planningHints(props.activity, weather.value, null) : []
  return [...preparation, ...(review.value?.issues ?? [])]
})
const psi = computed(() => result.value?.psi)
const psiTime = value => new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const number = value => isNumber(value) ? Math.round(value) : '—'
const range = (low, high) => Math.round(low) === Math.round(high) ? `${Math.round(low)}°C` : `${Math.round(low)}–${Math.round(high)}°C`
const slotTemperature = computed(() => isNumber(weather.value?.slotLow) && isNumber(weather.value?.slotHigh) ? range(weather.value.slotLow, weather.value.slotHigh) : null)
const dateLabel = computed(() => {
  const date = props.activity.date
  return date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`)) : 'Choose a date'
})
async function load(refresh = false) {
  const current = ++generation
  loading.value = true
  error.value = ''
  result.value = null
  review.value = null
  budgetStatus.value = ''
  if (!props.compact) emit('conditions', null)
  if (!props.compact) emit('planning-issues', null)
  try {
    const now = new Date()
    const activities = props.activities?.map(activity => ({ ...activity }))
    if (refresh && activities) {
      const locations = [...new Map(activities.map(a => [`${a.latitude}:${a.longitude}:${a.date}:${a.timezone}`, a])).values()]
      await Promise.all(locations.map(a => getActivityConditions({ ...a, startTime: '00:00', endTime: '23:59' }, now, { refresh: true }).catch(() => null)))
    }
    const budgetPromise = (async () => {
      if (props.budget) return { value: props.budget, status: 'ready' }
      if (!props.tripId || props.compact) return { value: null, status: '' }
      try {
        const response = await fetch(`/api/trips/${encodeURIComponent(props.tripId)}/budget/summary`, { signal: AbortSignal.timeout(8000) })
        if (response.status === 404) return { value: null, status: 'missing' }
        if (!response.ok) throw new Error('Budget unavailable')
        return { value: await response.json(), status: 'ready' }
      } catch { return { value: null, status: 'unavailable' } }
    })()
    const [data, plan, budget] = await Promise.all([
      getActivityConditions({ ...props.activity }, now, { refresh: refresh && !activities }),
      activities ? reviewActivities(activities, { now, externalIssues: props.externalIssues }) : null,
      budgetPromise,
    ])
    if (current === generation) {
      result.value = data
      budgetStatus.value = budget.status
      if (plan) {
        const tripActivities = props.plannedActivities ?? activities
        plan.issues.push(...planningIssues(tripActivities, { budget: budget.value }).filter(issue => issue.source === 'budget'))
        missingEstimates.value = tripActivities.filter(a => !a.completed && !isNumber(a.estimatedCostHome)).length
        review.value = plan
        emit('planning-issues', plan)
      }
      if (!props.compact) emit('conditions', data)
      if (refresh) emit('refreshed')
    }
  } catch (err) { if (current === generation) error.value = err.message }
  finally { if (current === generation) loading.value = false }
}
watch(() => JSON.stringify([props.activity, props.activities, props.plannedActivities, props.budget, props.tripId, props.externalIssues]), () => load(), { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <section :class="['conditions-panel', { 'compact-conditions': compact }]" :aria-label="compact ? `Conditions during ${activity.name || 'your activity'}` : 'Day weather and air quality summary'" :aria-busy="loading">
    <header v-if="!compact" class="conditions-header">
      <p :class="heading ? 'eyebrow day-label' : 'muted-copy'">{{ heading || `${dateLabel} · ${activity.name || 'Your destination'}` }}</p>
      <button type="button" class="secondary-action check-button" :disabled="loading" @click="load(true)">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
    </header>
    <slot name="after-header"></slot>
    <p v-if="loading" role="status" class="muted-copy loading-copy" :class="{ 'cloud-loading': !compact }">
      <svg v-if="!compact" class="loading-clouds" viewBox="0 0 64 44" width="56" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
        <path class="cloud-behind" d="M33 23h20a6 6 0 0 0 0-12h-1a9 9 0 0 0-17-2 7 7 0 0 0-2 14Z" />
        <path class="cloud-front" d="M17 35h27a9 9 0 0 0 0-18h-1a13 13 0 0 0-24-3 10.5 10.5 0 1 0-2 21Z" />
      </svg>
      <span>{{ compact ? 'Checking conditions…' : 'Asking the clouds…' }}</span>
    </p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="result && compact">
      <div class="slot-conditions">
        <div class="slot-item">
          <span class="slot-label">Temperature</span>
          <strong v-if="slotTemperature">≈ {{ slotTemperature }}</strong>
          <strong v-else-if="weather.kind === 'seasonal' && isNumber(weather.low) && isNumber(weather.high)">≈ {{ range(weather.low, weather.high) }}</strong>
          <span v-else class="muted-copy">{{ weather.kind === 'error' ? 'Unable to load' : 'Not available yet' }}</span>
          <small v-if="weather.kind === 'seasonal'">{{ slotTemperature ? 'Typical for this time of day' : 'Typical daily range; hourly estimate unavailable' }}</small>
          <small v-else-if="weather.kind === 'forecast'">{{ activity.startTime }}–{{ activity.endTime }} forecast</small>
        </div>
        <div class="slot-item">
          <span class="slot-label">Air quality</span>
          <strong v-if="air.kind === 'forecast'" :class="{ 'poor-air': air.aqi > 100 }">{{ aqiCategory(air.aqi) }} · US AQI {{ number(air.aqi) }}</strong>
          <span v-else class="muted-copy">{{ air.kind === 'error' ? 'Unable to load' : 'Not available yet' }}</span>
          <small>{{ air.kind === 'forecast' ? 'Peak during this activity' : 'Check again closer to the date' }}</small>
        </div>
      </div>
      <p v-if="weather.partial || air.partial" class="coverage-note">Some hours are not available.</p>
    </template>
    <template v-else-if="result">
      <div class="conditions-grid">
        <article class="condition-card">
          <p class="condition-label">Weather Forecast</p>
          <template v-if="weather.kind === 'seasonal'">
            <p class="condition-number">{{ number(weather.low) }}–{{ number(weather.high) }}°C</p>
            <p class="muted-copy">Historical monthly average · Daily low–high</p>
            <p>Wet days: {{ number(weather.wetDayPercent) }}% of historical days.</p>
          </template>
          <template v-else-if="weather.kind === 'forecast'">
            <p class="condition-number">{{ number(weather.low) }}–{{ number(weather.high) }}°C</p>
            <p>Daily low–high</p>
            <p>Peak precipitation probability: {{ number(weather.precipitationChance) }}% · Peak wind: {{ number(weather.wind) }} km/h</p>
            <p v-if="weather.partial" class="coverage-note">Partial hourly coverage for this day.</p>
          </template>
          <p v-else :role="weather.kind === 'error' ? 'alert' : undefined">{{ weather.message }}</p>
        </article>
        <article class="condition-card">
          <p class="condition-label">Air quality · US AQI</p>
          <template v-if="air.kind === 'forecast'">
            <p class="condition-number">{{ number(air.aqi) }}</p>
            <p><strong>{{ aqiCategory(air.aqi) }}</strong> · Peak for the day</p>
            <p>Peak PM₂.₅: {{ number(air.pm25) }} µg/m³ · PM₁₀: {{ number(air.pm10) }} µg/m³</p>
            <p v-if="air.partial" class="coverage-note">Partial hourly coverage for this day.</p>
          </template>
          <p v-else :role="air.kind === 'error' ? 'alert' : undefined">{{ air.message }}</p>
          <div v-if="psi && psi.kind !== 'not-applicable'" class="psi-observation">
            <p class="condition-label">Singapore PSI · NEA observation</p>
            <template v-if="psi.kind === 'observation'">
              <p><strong>{{ psi.value }} · {{ psiCategory(psi.value) }}</strong> · {{ psi.region }} region</p>
              <p class="muted-copy">24-hour PSI observed {{ psiTime(psi.observedAt) }} SGT. Not a forecast for an activity's time slot.</p>
            </template>
            <p v-else>{{ psi.kind === 'error' ? 'Singapore PSI is temporarily unavailable.' : psi.message }}</p>
          </div>
        </article>
      </div>
      <ul v-if="hints.length" class="conditions-hints" aria-label="Day planning advice">
        <li v-for="hint in hints" :key="hint.id ?? hint.title" :class="hint.level"><span v-if="hint.source" class="issue-source">{{ hint.source }}</span><strong>{{ hint.title }}</strong><p>{{ hint.text }}</p></li>
      </ul>
      <p v-if="review?.outdoorCount === 0" class="planning-coverage">All activities are indoors. No outdoor weather warnings apply.</p>
      <p v-else-if="review?.incompleteCount" class="planning-coverage">Forecast checks are incomplete for {{ review.incompleteCount }} outdoor {{ review.incompleteCount === 1 ? 'activity' : 'activities' }}. Check again closer to the date; unavailable data does not mean favourable conditions.</p>
      <p v-if="budgetStatus === 'missing'" class="planning-coverage">Set a trip budget in the Budget tab to include it in these planning checks.</p>
      <p v-else-if="budgetStatus === 'unavailable'" class="planning-coverage">Budget check is unavailable. Weather and schedule checks are shown independently.</p>
      <p v-else-if="budgetStatus === 'ready' && missingEstimates" class="planning-coverage">Upcoming costs are incomplete for {{ missingEstimates }} activities. The budget check includes recorded spending and available estimates.</p>
    </template>
  </section>
</template>

<style scoped>
.conditions-panel { min-width: 0; }
.conditions-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: .75rem; margin-bottom: 1.1rem; }
.conditions-header p { font-size: .85rem; margin: 0; overflow-wrap: anywhere; }
.conditions-header .day-label { text-transform: none; letter-spacing: .02em; }
.check-button { font-size: .8rem; padding: .45rem .9rem; }
.check-button:disabled { opacity: .6; cursor: wait; }
.conditions-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.condition-card { padding: 1.2rem; border: 1px solid var(--travel-border); border-radius: .9rem; background: var(--travel-bg); }
.condition-card p { font-size: .85rem; line-height: 1.65; margin: 0 0 .65rem; }
.condition-card .condition-label { color: var(--travel-accent); font-weight: 700; }
.condition-card .condition-number { font-size: 2rem; line-height: 1.2; font-weight: 650; letter-spacing: -.03em; }
.conditions-hints { display: grid; gap: .6rem; padding: 0; margin: 1rem 0; list-style: none; }
.conditions-hints li { padding: .9rem 1rem; background: #332d22; border: 1px solid #9c854b; border-radius: .75rem; color: #ffedbf; }
.conditions-hints .warning { background: #3c252c; color: #ffd8dc; border-color: #bc7c86; }
.conditions-hints .info { background: #203c3b; color: #d5ebe4; border-color: #638d84; }
.conditions-hints p { margin: .35rem 0 0; line-height: 1.6; font-size: .88rem; }
.psi-observation { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--travel-border); }
.planning-coverage { color: var(--travel-muted); font-size: .8rem; line-height: 1.6; margin: .8rem 0 0; }
.issue-source { display: block; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .25rem; }
.coverage-note { color: #ffe3a3; font-size: .8rem; margin: .6rem 0 0; }
.slot-conditions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; padding: .9rem 1rem; border-radius: .75rem; background: var(--travel-bg); }
.slot-item { display: grid; align-content: start; gap: .25rem; font-size: .9rem; }
.slot-label, .slot-item small { font-size: .75rem; color: var(--travel-muted); }
.slot-item .poor-air { color: #ffd898; }
.loading-copy { font-size: .85rem; }
.cloud-loading { display: flex; align-items: center; gap: .75rem; min-height: 56px; }
.loading-clouds { flex-shrink: 0; overflow: visible; color: var(--travel-accent); }
.cloud-behind { opacity: .45; }
.cloud-front { fill: var(--travel-panel); }
@media (prefers-reduced-motion: no-preference) {
  .cloud-front { animation: cloud-drift 1.8s ease-in-out infinite alternate; }
  .cloud-behind { animation: cloud-drift 2.4s ease-in-out -.6s infinite alternate-reverse; }
}
@keyframes cloud-drift { from { transform: translate(0, 1px); } to { transform: translate(3px, -3px); } }
@media (max-width: 650px) { .conditions-grid { grid-template-columns: 1fr; } }
@media (max-width: 450px) { .slot-conditions { grid-template-columns: 1fr; gap: .8rem; } }
</style>
