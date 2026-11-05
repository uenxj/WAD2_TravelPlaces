<script setup>
import { computed } from 'vue'
import { SETTING_LABELS, TYPE_LABELS } from '../../itinerary/activity.js'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['edit', 'delete'])

const hasError = computed(() => props.item.conflicts.some((c) => c.severity === 'error'))
const hasWarning = computed(() => !hasError.value && props.item.conflicts.length > 0)
</script>

<template>
  <li class="activity surface" :class="{ 'has-error': hasError, 'has-warning': hasWarning }" data-testid="item-row">
    <div class="activity-time">
      <time>{{ item.startTime }}</time>
      <span>{{ item.endTime }}</span>
    </div>

    <div class="activity-body">
      <div class="activity-heading">
        <h3 data-testid="item-title">{{ item.title }}</h3>
        <span class="pill">{{ SETTING_LABELS[item.setting] ?? 'Indoor' }}</span>
      </div>
      <p class="muted-copy activity-meta">
        {{ TYPE_LABELS[item.type] || 'Item' }}<template v-if="item.cost > 0"> · ${{ item.cost }}</template> · Added by {{ item.createdByName }}
      </p>
      <p v-if="item.notes" class="activity-notes">{{ item.notes }}</p>

      <ul v-if="item.conflicts.length" class="conflicts" data-testid="conflict-list">
        <li v-for="(c, i) in item.conflicts" :key="i" :class="c.severity" data-testid="conflict-message">{{ c.message }}</li>
      </ul>

      <!-- The weather module's conditions for this activity go here -->
      <slot />

      <div class="action-row activity-actions">
        <button type="button" class="chip-button" data-testid="edit-item-btn" @click="emit('edit', item)">Edit</button>
        <button type="button" class="chip-button danger" data-testid="delete-item-btn" @click="emit('delete', item)">Delete</button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.activity {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  border-left: 4px solid var(--travel-accent);
}

.activity.has-warning {
  border-left-color: #e8b04b;
}

.activity.has-error {
  border-left-color: #e5736b;
}

.activity-time {
  display: grid;
  align-content: start;
  gap: .3rem;
  min-width: 55px;
  color: var(--travel-muted);
  font-size: .8rem;
}

.activity-time time {
  color: var(--travel-accent);
  font-size: 1rem;
  font-weight: 650;
}

.activity-body {
  min-width: 0;
  flex: 1;
}

.activity-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .5rem 1rem;
}

.activity-heading h3 {
  margin: 0;
  font-size: 1.1rem;
}

.pill {
  display: inline-flex;
  padding: .35rem .8rem;
  border-radius: 999px;
  background: #29473f;
  color: #cce9df;
  font-size: .8rem;
}

.activity-meta {
  margin: .25rem 0 0;
  font-size: .85rem;
  line-height: 1.5;
}

.activity-notes {
  margin: .6rem 0 0;
  font-size: .9rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.conflicts {
  display: grid;
  gap: .4rem;
  margin: .8rem 0 0;
  padding: 0;
  list-style: none;
}

.conflicts li {
  padding: .55rem .8rem;
  border: 1px solid #9c854b;
  border-radius: .6rem;
  background: #332d22;
  color: #ffedbf;
  font-size: .85rem;
  line-height: 1.5;
}

.conflicts li.error {
  border-color: #bc7c86;
  background: #3c252c;
  color: #ffd8dc;
}

.activity-actions {
  margin-top: .9rem;
  gap: .5rem;
}

.chip-button {
  padding: .3rem .8rem;
  border: 1px solid var(--travel-border);
  border-radius: 999px;
  background: transparent;
  color: var(--travel-muted);
  font-size: .8rem;
  cursor: pointer;
}

.chip-button:hover {
  border-color: var(--travel-accent);
  color: var(--travel-text);
}

.chip-button.danger:hover {
  border-color: #bc7c86;
  color: #ffd8dc;
}

@media (max-width: 500px) {
  .activity {
    gap: .8rem;
    padding: 1rem;
  }
}
</style>
