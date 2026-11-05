<script setup>
// "Don't forget": the easy-to-forget items that are missing or not packed yet.
// Items marked "not needed" (e.g. no passport for a domestic trip) are hidden.
import { computed } from 'vue'
import { essentialsCheck } from '../../src/checklist/catalog.js'

const props = defineProps({
  items: { type: Array, required: true },
  notNeeded: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['add', 'toggle', 'dismiss'])

const open = computed(() =>
  essentialsCheck(props.items).filter((e) => e.state !== 'packed' && !props.notNeeded.includes(e.key)),
)
</script>

<template>
  <section v-if="open.length" class="forget" aria-labelledby="forget-title" data-testid="essentials-alert">
    <div class="forget-head">
      <span class="forget-icon" aria-hidden="true">!</span>
      <div>
        <h2 id="forget-title" class="forget-title">Don't forget</h2>
        <p class="forget-sub">{{ open.length }} trip-critical item{{ open.length === 1 ? ' still needs' : 's still need' }} attention</p>
      </div>
    </div>
    <ul class="forget-list">
      <li v-for="e in open" :key="e.key" class="forget-item" :class="e.state">
        <span class="f-name">{{ e.item?.name ?? e.name }}</span>
        <span class="f-state">{{ e.state === 'missing' ? 'Not on list' : 'Not packed' }}</span>
        <button v-if="e.state === 'missing'" type="button" class="f-btn" :disabled="busy"
          :aria-label="`Add ${e.name}`" @click="emit('add', e.key)">+ Add</button>
        <button v-else type="button" class="f-btn" :aria-label="`Mark ${e.item.name} as packed`"
          @click="emit('toggle', e.item)">Pack ✓</button>
        <button v-if="e.state === 'missing'" type="button" class="f-skip" :aria-label="`${e.name} is not needed for this trip`"
          title="Not needed for this trip" @click="emit('dismiss', e.key)">×</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.forget {
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--travel-gold-border);
  border-radius: 1.25rem;
  background: linear-gradient(120deg, var(--travel-warn-panel) 0%, var(--travel-panel) 70%);
}

.forget-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.forget-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  /* A gold badge with navy ink: readable on navy and on cream, so the same in both themes. */
  background: #f2c879;
  color: #101a2e;
  font-weight: 800;
}

.forget-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.forget-sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--travel-muted);
}

.forget-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
}

.forget-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.35rem 0.3rem 0.85rem;
  border: 1px solid var(--travel-border);
  border-radius: 999px;
  background: rgb(var(--travel-bg-rgb) / 0.6);
}

.forget-item.missing {
  border-style: dashed;
  border-color: var(--travel-gold-border);
}

.f-name {
  font-weight: 600;
  font-size: 0.88rem;
}

.f-state {
  font-size: 0.72rem;
  color: var(--travel-gold);
}

.f-btn {
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--travel-accent);
  border-radius: 999px;
  background: transparent;
  color: var(--travel-accent);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.f-btn:hover:not(:disabled) {
  background: var(--travel-strong);
  color: var(--travel-on-strong);
}

.f-btn:disabled {
  opacity: 0.5;
}

.f-skip {
  border: 0;
  background: none;
  color: var(--travel-muted);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.25rem;
}

@media (max-width: 420px) {
  .forget {
    padding: 0.9rem;
  }

  .forget-item {
    width: 100%;
  }

  .f-name {
    flex: 1;
  }
}
</style>
