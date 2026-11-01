<script setup>
// "What if...?" stress test: for each scenario, is there a backup on the list?
import { computed } from 'vue'
import { ITEMS, checkScenarios } from '../../src/checklist/catalog.js'

const props = defineProps({
  items: { type: Array, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['add'])

const results = computed(() => checkScenarios(props.items))
const covered = computed(() => results.value.filter((r) => r.covered).length)
const verdict = computed(() => {
  const ratio = covered.value / results.value.length
  if (ratio === 1) return 'Ready for anything'
  if (ratio >= 0.7) return 'Well prepared'
  if (ratio >= 0.4) return 'A few gaps'
  return 'Hoping for the best'
})
</script>

<template>
  <section class="sheet whatif" aria-labelledby="whatif-title" data-testid="what-if">
    <div class="wi-head">
      <h2 id="whatif-title" class="section-title">What if…?</h2>
      <span class="wi-score" :class="{ full: covered === results.length }">{{ covered }}/{{ results.length }}</span>
    </div>
    <p class="hint">Stress-test your bag. Each scenario checks your list for a backup.</p>
    <div class="wi-bar" role="meter" :aria-valuenow="covered" aria-valuemin="0" :aria-valuemax="results.length"
      :aria-label="`${covered} of ${results.length} scenarios covered`">
      <span :style="{ width: (covered / results.length) * 100 + '%' }"></span>
    </div>
    <p class="wi-verdict">{{ verdict }}</p>

    <ul class="wi-list">
      <li v-for="r in results" :key="r.id" :class="{ ok: r.covered }">
        <span class="wi-emoji" aria-hidden="true">{{ r.emoji }}</span>
        <div class="wi-text">
          <span class="wi-label">{{ r.label }}</span>
          <span v-if="r.covered" class="wi-by">✓ {{ r.by.name }}{{ r.by.done ? ' · packed' : ' · on your list' }}</span>
          <span v-else class="wi-gap">No backup yet</span>
        </div>
        <button v-if="!r.covered" type="button" class="wi-fix" :disabled="busy"
          :aria-label="`Add ${ITEMS[r.fixKey].name} for: ${r.label}`" @click="emit('add', r.fixKey, `What if: ${r.label.toLowerCase()}`)">
          + {{ ITEMS[r.fixKey].name }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.sheet {
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
}

.wi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.wi-score {
  padding: 0.1rem 0.6rem;
  border: 1px solid #b8955a;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #f2c879;
}

.wi-score.full {
  border-color: var(--travel-accent);
  color: var(--travel-accent);
}

.hint {
  margin: 0.35rem 0 0.75rem;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--travel-muted);
}

.wi-bar {
  height: 4px;
  border-radius: 2px;
  background: #2a3a52;
  overflow: hidden;
}

.wi-bar span {
  display: block;
  height: 100%;
  background: var(--travel-accent);
  transition: width 0.4s ease;
}

.wi-verdict {
  margin: 0.4rem 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--travel-muted);
}

.wi-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wi-list li {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--travel-border);
}

.wi-list li:last-child {
  border-bottom: 0;
}

.wi-emoji {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #2b2a2c;
  font-size: 1rem;
  filter: grayscale(0.2);
}

.ok .wi-emoji {
  background: #29473f;
}

.wi-text {
  flex: 1;
  min-width: 0;
}

.wi-label {
  display: block;
  font-size: 0.9rem;
}

.wi-by {
  display: block;
  font-size: 0.75rem;
  color: var(--travel-accent);
  overflow-wrap: anywhere;
}

.wi-gap {
  display: block;
  font-size: 0.75rem;
  color: #f2c879;
}

.wi-fix {
  flex-shrink: 0;
  max-width: 45%;
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--travel-border);
  border-radius: 999px;
  background: transparent;
  color: var(--travel-text);
  font-size: 0.75rem;
  text-align: center;
}

.wi-fix:hover:not(:disabled) {
  border-color: var(--travel-accent);
  background: #354d51;
}

.wi-fix:disabled {
  opacity: 0.5;
}
</style>
