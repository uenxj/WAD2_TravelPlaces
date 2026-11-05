<script setup>
// The pop-up frame shared by the activity and trip forms: dimmed backdrop, Escape / outside click to close.
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({ title: { type: String, required: true }, titleId: { type: String, required: true }, testid: { type: String, default: '' } })
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-panel surface" role="dialog" aria-modal="true" :aria-labelledby="titleId" :data-testid="testid || undefined">
      <div class="modal-head">
        <h2 :id="titleId">{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="Close" @click="emit('close')">×</button>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: 1.5rem .75rem;
  background: rgb(5 10 20 / .72);
}

.modal-panel {
  width: 100%;
  max-width: 560px;
  margin: auto;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.modal-head h2 {
  margin: 0;
  font-size: 1.4rem;
}

.modal-close {
  border: 0;
  background: transparent;
  color: var(--travel-muted);
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
}

.modal-close:hover {
  color: var(--travel-text);
}
</style>
