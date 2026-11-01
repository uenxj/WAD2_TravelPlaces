<script setup>
// Final departure review: confirm the trip-critical items are really in the bag,
// then run through the leaving-home checks. All confirmed -> "cleared".
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { essentialsCheck, DEPARTURE_CHECKS } from '../../src/checklist/catalog.js'

const props = defineProps({
  items: { type: Array, required: true },
})
const emit = defineEmits(['done', 'close'])

const checks = computed(() => [
  ...essentialsCheck(props.items)
    .filter((e) => e.item)
    .map((e) => ({ id: 'item-' + e.key, label: e.item.name, group: 'In your bag' })),
  ...DEPARTURE_CHECKS.map((c) => ({ ...c, group: 'Before you leave' })),
])
const groups = computed(() => [...new Set(checks.value.map((c) => c.group))])
const confirmed = ref(new Set())
const allDone = computed(() => checks.value.every((c) => confirmed.value.has(c.id)))

function flip(id) {
  const next = new Set(confirmed.value)
  next.has(id) ? next.delete(id) : next.add(id)
  confirmed.value = next
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
      <p class="fr-sub">Touch each one to confirm. {{ confirmed.size }} of {{ checks.length }} done.</p>
      <div class="fr-bar" aria-hidden="true">
        <span :style="{ width: (confirmed.size / checks.length) * 100 + '%' }"></span>
      </div>

      <div v-for="g in groups" :key="g" class="fr-group">
        <h3 class="fr-group-title">{{ g }}</h3>
        <ul class="fr-list">
          <li v-for="c in checks.filter((x) => x.group === g)" :key="c.id">
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
        {{ allDone ? 'Cleared for departure ✈' : `${checks.length - confirmed.size} left to confirm` }}
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
  background: rgba(6, 11, 22, 0.78);
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

.fr-sub {
  margin: 0.5rem 0 0.5rem;
  font-size: 0.85rem;
  color: var(--travel-muted);
}

.fr-bar {
  height: 4px;
  border-radius: 2px;
  background: #2a3a52;
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
  margin: 0 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--travel-accent);
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
  border: 1px solid var(--travel-border);
  border-radius: 0.75rem;
  background: rgba(16, 26, 46, 0.5);
  color: var(--travel-text);
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.fr-check:hover {
  border-color: var(--travel-accent);
}

.fr-check.on {
  border-color: var(--travel-accent);
  background: #24403f;
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
  stroke: #101a2e;
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
