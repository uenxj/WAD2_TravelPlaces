<script setup>
// Shown when someone adds an activity that is already planned on another day:
// move the existing one to the day they picked, add it again as a duplicate, or go back.
import { computed } from 'vue'
import ModalShell from './ModalShell.vue'

const props = defineProps({
  title: { type: String, required: true }, // what they are adding
  date: { type: String, required: true }, // the day they are adding it to
  matches: { type: Array, required: true }, // the same activity on other days (saved items)
  days: { type: Array, required: true }, // [{ date, label }]
  currentUserId: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['move', 'duplicate', 'cancel'])

const dayName = (date) => {
  const i = props.days.findIndex((d) => d.date === date)
  return i < 0 ? date : `Day ${i + 1} · ${props.days[i].label}`
}
const target = computed(() => dayName(props.date))
const who = (item) => (props.currentUserId && item.createdBy !== props.currentUserId ? ` · added by ${item.createdByName || 'another traveller'}` : '')
</script>

<template>
  <ModalShell title="Already planned on another day" title-id="duplicate-modal-title" testid="duplicate-modal" @close="emit('cancel')">
    <p class="dup-intro">
      <strong>“{{ title }}”</strong> {{ matches.length === 1 ? 'is already planned on' : 'is already planned on these days:' }}
    </p>

    <ul class="dup-list" data-testid="duplicate-list">
      <li v-for="m in matches" :key="m._id" data-testid="duplicate-match">
        <span class="dup-when">
          <strong>{{ dayName(m.date) }}</strong>
          <span class="muted-copy">{{ m.startTime }}-{{ m.endTime }}{{ who(m) }}</span>
        </span>
        <button type="button" class="secondary-action small" :disabled="saving" data-testid="move-activity-btn" @click="emit('move', m)">
          Move it to {{ target }}
        </button>
      </li>
    </ul>

    <p class="muted-copy dup-help">
      Moving keeps one copy and changes its day and time. Duplicating adds a second copy on {{ target }}.
    </p>

    <div class="action-row">
      <button type="button" class="primary-action" :disabled="saving" data-testid="duplicate-activity-btn" @click="emit('duplicate')">
        {{ saving ? 'Saving…' : 'Duplicate it' }}
      </button>
      <button type="button" class="secondary-action" :disabled="saving" data-testid="duplicate-cancel-btn" @click="emit('cancel')">Go back</button>
    </div>
  </ModalShell>
</template>

<style scoped>
.dup-intro {
  margin: 0 0 .75rem;
}

.dup-list {
  display: grid;
  gap: .6rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.dup-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .6rem 1rem;
  padding: .75rem 1rem;
  border: 1px solid var(--travel-border);
  border-radius: .6rem;
  background: var(--travel-bg);
}

.dup-when {
  display: grid;
  gap: .15rem;
  min-width: 0;
}

.dup-help {
  margin: 0 0 1.25rem;
  font-size: .9rem;
}

button:disabled {
  opacity: .65;
  cursor: not-allowed;
}
</style>
