<script setup>
// Final departure review. Trip-critical items the list already shows as packed are confirmed
// automatically (shown as a summary); the user only confirms the leaving-home checks, one by one
// or all at once. All confirmed -> "cleared".
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { essentialsCheck, DEPARTURE_CHECKS } from '../../src/checklist/catalog.js'

const props = defineProps({
  items: { type: Array, required: true },
})
const emit = defineEmits(['done', 'close'])

const inBag = computed(() => essentialsCheck(props.items).filter((e) => e.item?.done).map((e) => e.item.name))
const confirmed = ref(new Set())
const allDone = computed(() => DEPARTURE_CHECKS.every((c) => confirmed.value.has(c.id)))

function flip(id) {
  const next = new Set(confirmed.value)
  next.has(id) ? next.delete(id) : next.add(id)
  confirmed.value = next
}
function confirmAll() {
  confirmed.value = new Set(DEPARTURE_CHECKS.map((c) => c.id))
}

const firstBtn = ref(null)
function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
let previousOverflow = ''
onMounted(() => {
  window.addEventListener('keydown', onKey)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  firstBtn.value?.[0]?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div class="fr-backdrop" @click.self="emit('close')">
    <section class="fr" role="dialog" aria-modal="true" aria-labelledby="fr-title" data-testid="final-review">
      <header class="fr-head">
        <div>
          <p class="eyebrow mb-1">Final departure check</p>
          <h2 id="fr-title" class="fr-title">Before you head out</h2>
        </div>
        <button type="button" class="fr-close" aria-label="Close final check" @click="emit('close')">×</button>
      </header>
      <div v-if="inBag.length" class="fr-group">
        <h3 class="fr-group-title">In your bag <span class="fr-auto">✓ from your list</span></h3>
        <ul class="fr-bag" data-testid="final-in-bag">
          <li v-for="name in inBag" :key="name">✓ {{ name }}</li>
        </ul>
      </div>

      <div class="fr-group">
        <h3 class="fr-group-title">
          Before you leave
          <button v-if="!allDone" type="button" class="fr-all" data-testid="final-all-done" @click="confirmAll">All done</button>
        </h3>
        <div class="fr-bar" aria-hidden="true">
          <span :style="{ width: (confirmed.size / DEPARTURE_CHECKS.length) * 100 + '%' }"></span>
        </div>
        <ul class="fr-list">
          <li v-for="c in DEPARTURE_CHECKS" :key="c.id">
            <button ref="firstBtn" type="button" class="fr-check" :class="{ on: confirmed.has(c.id) }"
              :aria-pressed="confirmed.has(c.id)" @click="flip(c.id)">
              <span class="fr-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="m5 12 5 5 9-10" /></svg>
              </span>
              {{ c.label }}
            </button>
          </li>
        </ul>
      </div>

      <button type="button" class="primary-action fr-go" :disabled="!allDone" data-testid="final-cleared"
        @click="emit('done')">
        {{ allDone ? 'Cleared for departure ✈' : `${DEPARTURE_CHECKS.length - confirmed.size} left to confirm` }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.fr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--travel-backdrop-strong);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.fr {
  width: min(100%, 460px);
  padding: 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.fr-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.fr-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.fr-close {
  border: 0;
  background: none;
  color: var(--travel-muted);
  font-size: 1.6rem;
  line-height: 1;
}

.fr-bar {
  margin-bottom: 0.6rem;
  height: 4px;
  border-radius: 2px;
  background: var(--travel-track);
  overflow: hidden;
}

.fr-bar span {
  display: block;
  height: 100%;
  background: var(--travel-accent);
  transition: width 0.3s ease;
}

.fr-group {
  margin-top: 1rem;
}

.fr-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--travel-accent);
}

.fr-auto {
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: none;
  color: var(--travel-muted);
}

.fr-all {
  padding: 0.2rem 0.75rem;
  border: 1px solid var(--travel-accent);
  border-radius: 999px;
  background: transparent;
  color: var(--travel-accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
}

.fr-all:hover {
  background: var(--travel-selected-deep);
}

/* Items already packed on the list: a compact confirmed summary */
.fr-bag {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fr-bag li {
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--travel-selected-deep);
  color: var(--travel-selected-text);
  font-size: 0.8rem;
}

.fr-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fr-check {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--travel-action-border);
  border-radius: 0.75rem;
  background: rgb(var(--travel-bg-rgb) / 0.5);
  color: var(--travel-text);
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.fr-check:hover {
  border-color: var(--travel-accent);
}

.fr-check.on {
  border-color: var(--travel-accent);
  background: var(--travel-selected-deep);
}

.fr-box {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 2px solid var(--travel-accent);
  border-radius: 50%;
}

.fr-box svg {
  fill: none;
  stroke: var(--travel-on-accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
}

.on .fr-box {
  background: var(--travel-accent);
  animation: pop 0.3s cubic-bezier(0.2, 1.4, 0.5, 1);
}

.on .fr-box svg {
  opacity: 1;
}

@keyframes pop {
  50% {
    transform: scale(1.2);
  }
}

.fr-go {
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.8rem 1rem;
}

.fr-go:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .on .fr-box {
    animation: none;
  }
}
</style>
