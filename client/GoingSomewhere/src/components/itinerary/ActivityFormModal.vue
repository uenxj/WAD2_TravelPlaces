<script setup>
import { reactive, ref } from 'vue'
import ModalShell from './ModalShell.vue'

const props = defineProps({
  item: { type: Object, default: null }, // null = adding a new activity
  prefill: { type: Object, default: null }, // a place picked from the suggestions: { id, name, lat, lng, setting }
  defaultDate: { type: String, required: true },
  days: { type: Array, required: true }, // [{ date, label }]
  saving: { type: Boolean, default: false },
  serverError: { type: String, default: '' },
})
const emit = defineEmits(['save', 'close'])

const form = reactive({
  title: props.item?.title ?? props.prefill?.name ?? '',
  type: props.item?.type ?? 'place',
  date: props.item?.date ?? props.defaultDate,
  startTime: props.item?.startTime ?? '09:00',
  endTime: props.item?.endTime ?? '10:00',
  setting: props.item?.setting ?? props.prefill?.setting ?? 'indoor',
  notes: props.item?.notes ?? '',
})
const localError = ref('')

function submit() {
  localError.value = ''
  if (!form.title.trim()) return (localError.value = 'Enter a title.')
  if (form.endTime <= form.startTime) return (localError.value = 'End time must be after the start time.')
  emit('save', {
    title: form.title,
    type: form.type,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    setting: form.setting,
    notes: form.notes,
    // A place picked from the suggestions keeps its id and coordinates (there is no location field to fill in).
    // An edit sends no location at all, so the server keeps whatever is already saved.
    ...(props.prefill && !props.item
      ? { placeId: props.prefill.id, location: { address: props.prefill.name, lat: props.prefill.lat, lng: props.prefill.lng } }
      : {}),
  })
}
</script>

<template>
  <ModalShell :title="item ? 'Edit activity' : 'Add activity'" title-id="item-modal-title" testid="item-modal" @close="emit('close')">
    <form class="form-stack activity-form" @submit.prevent="submit">
      <label for="item-title">Title
        <input id="item-title" v-model="form.title" maxlength="120" required data-testid="item-title-input" />
      </label>

      <div class="two-up">
        <label for="item-type">Type
          <select id="item-type" v-model="form.type" data-testid="item-type-input">
            <option value="place">Place to visit</option>
            <option value="event">Event (e.g. film festival)</option>
            <option value="transport">Transport</option>
            <option value="custom">Something else</option>
          </select>
        </label>
        <label for="item-date">Day
          <select id="item-date" v-model="form.date" data-testid="item-date-input">
            <option v-for="d in days" :key="d.date" :value="d.date">{{ d.label }}</option>
          </select>
        </label>
      </div>

      <div class="two-up">
        <label for="item-start">Start time
          <input id="item-start" v-model="form.startTime" type="time" required data-testid="item-start-input" />
        </label>
        <label for="item-end">End time
          <input id="item-end" v-model="form.endTime" type="time" required data-testid="item-end-input" />
        </label>
      </div>

      <label for="item-setting">Indoor or outdoor
        <select id="item-setting" v-model="form.setting" data-testid="item-setting-input">
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
          <option value="both">Indoor &amp; Outdoor</option>
        </select>
      </label>

      <label for="item-notes">Notes
        <textarea id="item-notes" v-model="form.notes" rows="2" maxlength="1000" data-testid="item-notes-input"></textarea>
      </label>

      <p v-if="localError || serverError" class="form-error" role="alert" data-testid="form-error">{{ localError || serverError }}</p>

      <div class="action-row">
        <button class="primary-action" :disabled="saving" data-testid="save-item-btn">
          {{ saving ? 'Saving…' : item ? 'Save changes' : 'Add to Itinerary' }}
        </button>
        <button type="button" class="secondary-action" @click="emit('close')">Cancel</button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.two-up {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 480px) {
  .two-up {
    grid-template-columns: 1fr;
  }
}


.activity-form textarea {
  width: 100%;
  padding: .8rem 1rem;
  border: 1px solid var(--travel-action-border);
  border-radius: .6rem;
  background: var(--travel-bg);
  color: var(--travel-text);
  font: inherit;
  resize: vertical;
}

.form-error {
  margin: 0;
  padding: .75rem 1rem;
  border: 1px solid var(--travel-danger-border);
  border-radius: .6rem;
  background: var(--travel-danger-bg);
  color: var(--travel-danger-text);
}

button:disabled {
  opacity: .65;
  cursor: not-allowed;
}
</style>
