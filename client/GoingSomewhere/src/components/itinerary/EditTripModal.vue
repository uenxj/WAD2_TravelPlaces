<script setup>
import { reactive, ref, computed, watch } from 'vue'
import ModalShell from './ModalShell.vue'
import DestinationInput from './DestinationInput.vue'
import { selectionFromTrip } from '../../itinerary/destination.js'
import { todayLocal } from '../../itinerary/dates.js'

const props = defineProps({
  trip: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  serverError: { type: String, default: '' },
})
const emit = defineEmits(['save', 'close'])

const today = todayLocal()
const form = reactive({
  name: props.trip.name,
  destination: props.trip.destination,
  destinationLocation: selectionFromTrip(props.trip),
  startDate: props.trip.startDate,
  endDate: props.trip.endDate,
})
const localError = ref('')

// Nothing can be moved into the past. A trip that already started keeps its current dates selectable.
const startMin = computed(() => (props.trip.startDate < today ? props.trip.startDate : today))
const endMin = computed(() => {
  const earliest = props.trip.endDate < today ? props.trip.endDate : today
  return form.startDate > earliest ? form.startDate : earliest
})

// If the start moves past the end, move the end along with it
watch(() => form.startDate, (start) => {
  if (start && form.endDate && form.endDate < start) form.endDate = start
})

function submit() {
  localError.value = ''
  if (!form.name.trim() || !form.destination.trim()) return (localError.value = 'Trip name and destination are required.')
  if (!form.startDate || !form.endDate) return (localError.value = 'Pick a start and end date.')
  if (form.endDate < form.startDate) return (localError.value = 'End date must be on or after the start date.')
  if (form.startDate < today && form.startDate !== props.trip.startDate) return (localError.value = 'Start date cannot be in the past.')
  if (form.endDate < today && form.endDate !== props.trip.endDate) return (localError.value = 'End date cannot be in the past.')
  emit('save', {
    name: form.name.trim(),
    destination: form.destination.trim(),
    destinationLocation: form.destinationLocation,
    startDate: form.startDate,
    endDate: form.endDate,
  })
}
</script>

<template>
  <ModalShell title="Edit trip details" title-id="trip-modal-title" testid="trip-modal" @close="emit('close')">
    <form class="form-stack trip-edit-form" @submit.prevent="submit">
      <label for="edit-trip-name">Trip name
        <input id="edit-trip-name" v-model="form.name" maxlength="80" required data-testid="edit-trip-name" />
      </label>
      <DestinationInput id="edit-trip-destination" testid="edit-trip-destination" v-model="form.destination" v-model:location="form.destinationLocation" />
      <div class="two-up">
        <label for="edit-trip-start">Start date
          <input id="edit-trip-start" v-model="form.startDate" type="date" :min="startMin" required data-testid="edit-trip-start" />
        </label>
        <label for="edit-trip-end">End date
          <input id="edit-trip-end" v-model="form.endDate" type="date" :min="endMin" required data-testid="edit-trip-end" />
        </label>
      </div>

      <p v-if="localError || serverError" class="form-error" role="alert" data-testid="trip-form-error">{{ localError || serverError }}</p>

      <div class="action-row">
        <button class="primary-action" :disabled="saving" data-testid="save-trip-btn">{{ saving ? 'Saving…' : 'Save changes' }}</button>
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
