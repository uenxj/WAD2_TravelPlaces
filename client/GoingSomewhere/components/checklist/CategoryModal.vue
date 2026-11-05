<script setup>
// One category of the list in a pop-up: every item with its reason, to edit or remove.
// Opened from a category card; Esc, × or a click outside closes it.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ChecklistItem from './ChecklistItem.vue'

defineProps({
  section: { type: Object, required: true }, // { name, icon, shown: items }
  pending: { type: Set, required: true },
})
const emit = defineEmits(['toggle', 'save', 'remove', 'close'])

const closeBtn = ref(null)
function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
let previousOverflow = ''
let previousFocus = null
onMounted(() => {
  window.addEventListener('keydown', onKey)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  previousFocus = document.activeElement
  closeBtn.value?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
  previousFocus?.focus?.()
})
</script>

<template>
  <div class="cm-backdrop" @click.self="emit('close')">
    <section class="cm" role="dialog" aria-modal="true" aria-labelledby="cm-title" data-testid="category-modal">
      <header class="cm-head">
        <span class="cm-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" v-html="section.icon"></svg>
        </span>
        <h2 id="cm-title" class="cm-title">{{ section.name }} <span>{{ section.shown.length }}</span></h2>
        <button ref="closeBtn" type="button" class="cm-close" :aria-label="`Close ${section.name}`" @click="emit('close')">×</button>
      </header>
      <ul class="list-unstyled mb-0 cm-list">
        <ChecklistItem v-for="item in section.shown" :key="item.id" :item="item" :busy="pending.has(item.id)"
          @toggle="emit('toggle', item)" @save="(patch) => emit('save', item, patch)" @remove="emit('remove', item)" />
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--travel-backdrop-strong);
  backdrop-filter: blur(4px);
}

.cm {
  display: flex;
  flex-direction: column;
  width: min(100%, 520px);
  max-height: min(85vh, 720px);
  padding: 1.25rem 1.25rem 0.5rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  animation: cm-in 0.2s ease-out;
}

.cm-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--travel-border);
}

.cm-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--travel-strong);
  color: var(--travel-accent);
}

.cm-icon svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cm-title {
  flex: 1;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.cm-title span {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--travel-muted);
}

.cm-close {
  border: 0;
  background: none;
  color: var(--travel-muted);
  font-size: 1.6rem;
  line-height: 1;
}

.cm-close:hover {
  color: var(--travel-text);
}

.cm-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

@keyframes cm-in {
  from {
    transform: translateY(10px) scale(0.98);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cm {
    animation: none;
  }
}
</style>
