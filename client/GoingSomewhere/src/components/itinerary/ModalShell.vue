<script setup>
// Native modal behavior contains keyboard focus and makes the rest of the page inert.
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({ title: { type: String, required: true }, titleId: { type: String, required: true }, testid: { type: String, default: '' } })
const emit = defineEmits(['close'])
const dialog = ref(null)
let returnFocus
let previousOverflow
onMounted(() => {
  returnFocus = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value.showModal()
  dialog.value.querySelector('input, select, textarea')?.focus()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
})
</script>

<template>
  <dialog ref="dialog" class="trip-dialog" :aria-labelledby="titleId" :data-testid="testid || undefined" @cancel.prevent="emit('close')" @click.self="emit('close')">
    <div class="modal-panel surface">
      <div class="modal-head">
        <h2 :id="titleId">{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="Close" @click="emit('close')">×</button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.trip-dialog {
  width: min(560px, calc(100% - 1.5rem));
  max-height: calc(100dvh - 3rem);
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 1.25rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.trip-dialog::backdrop { background: rgb(5 10 20 / .72); }
.modal-panel { width: 100%; }

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
  min-width: 44px;
  min-height: 44px;
  flex-shrink: 0;
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
