<script>
// More than one dialog can be open at once (the "already planned" prompt opens over the activity form), so the page
// scroll lock is shared: the first dialog to open locks the page, and only the last one to close unlocks it.
// (Each dialog restoring "whatever it saw when it opened" left the page stuck locked when two closed together.)
let openDialogs = 0
let overflowBeforeLock = ''
function lockPageScroll() {
  if (openDialogs++ === 0) {
    overflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}
function unlockPageScroll() {
  if (openDialogs > 0 && --openDialogs === 0) document.body.style.overflow = overflowBeforeLock
}
</script>

<script setup>
// Native modal behavior contains keyboard focus and makes the rest of the page inert.
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({ title: { type: String, required: true }, titleId: { type: String, required: true }, testid: { type: String, default: '' } })
const emit = defineEmits(['close'])
const dialog = ref(null)
let returnFocus
onMounted(() => {
  returnFocus = document.activeElement
  lockPageScroll()
  dialog.value.showModal()
  dialog.value.querySelector('input, select, textarea')?.focus()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  unlockPageScroll()
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
.trip-dialog::backdrop { background: var(--travel-backdrop); }
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
