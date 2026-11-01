<script setup>
import { ref, nextTick } from 'vue'
import { CATEGORIES } from '../../src/checklist/catalog.js'

const props = defineProps({
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'save', 'remove'])

const editing = ref(false)
const draft = ref({})
const nameInput = ref(null)
const checkboxId = `item-${props.item.id}`

async function startEdit() {
  draft.value = { name: props.item.name, category: props.item.category, priority: props.item.priority }
  editing.value = true
  await nextTick()
  nameInput.value?.focus()
}

function save() {
  const name = draft.value.name.trim()
  if (!name) return
  const patch = {}
  for (const field of ['category', 'priority']) {
    if (draft.value[field] !== props.item[field]) patch[field] = draft.value[field]
  }
  if (name !== props.item.name) patch.name = name
  editing.value = false
  if (Object.keys(patch).length) emit('save', patch)
}
</script>

<template>
  <li class="item" :class="{ done: item.done, optional: item.priority === 'optional', busy }">
    <form v-if="editing" class="edit" @submit.prevent="save" @keydown.esc="editing = false">
      <input ref="nameInput" v-model="draft.name" class="form-control form-control-sm" maxlength="80" required
        aria-label="Item name">
      <div class="edit-row">
        <select v-model="draft.category" class="form-select form-select-sm" aria-label="Category">
          <option v-for="c in CATEGORIES" :key="c.name">{{ c.name }}</option>
        </select>
        <select v-model="draft.priority" class="form-select form-select-sm" aria-label="Priority">
          <option value="essential">Essential</option>
          <option value="optional">Optional</option>
        </select>
        <button class="primary-action sm">Save</button>
        <button type="button" class="secondary-action sm" @click="editing = false">Cancel</button>
      </div>
    </form>

    <template v-else>
      <input :id="checkboxId" type="checkbox" class="tick" :checked="item.done"
        :disabled="busy" @change="emit('toggle')">
      <label :for="checkboxId" class="tick-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="m5 12 5 5 9-10" /></svg>
      </label>

      <label :for="checkboxId" class="body">
        <span class="name">{{ item.name }}</span>
        <span class="meta" v-if="item.priority === 'optional' || item.source === 'suggested'">
          <span v-if="item.priority === 'optional'" class="tag tag-optional">Optional</span>
          <span v-if="item.source === 'suggested'" class="tag tag-trip" :title="item.reason">✦ {{ item.reason || 'Suggested' }}</span>
        </span>
      </label>

      <div class="actions">
        <button type="button" class="icon-btn" :disabled="busy" :aria-label="`Edit ${item.name}`" title="Edit"
          @click="startEdit">
          <svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
        </button>
        <button type="button" class="icon-btn danger" :disabled="busy" :aria-label="`Delete ${item.name}`"
          title="Delete" @click="emit('remove')">
          <svg viewBox="0 0 24 24" width="17" height="17"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>
        </button>
      </div>
    </template>
  </li>
</template>

<style scoped>
.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.25rem;
  border-bottom: 1px solid var(--travel-border);
  transition: opacity 0.2s ease;
}

.item:last-child {
  border-bottom: 0;
}

.item.busy {
  opacity: 0.6;
}

/* Real checkbox kept for keyboard and screen readers; the label draws it. */
.tick {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.tick-box {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 2px solid var(--travel-accent);
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s ease;
}

.optional .tick-box {
  border-style: dashed;
  border-color: var(--travel-muted);
}

.tick-box svg {
  fill: none;
  stroke: var(--travel-bg);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
}

.tick:checked+.tick-box {
  background: var(--travel-accent);
  border-color: var(--travel-accent);
  animation: pop 0.3s cubic-bezier(0.2, 1.4, 0.5, 1);
}

@keyframes pop {
  50% {
    transform: scale(1.18);
  }
}

.tick:checked+.tick-box svg {
  opacity: 1;
}

.tick:focus-visible+.tick-box {
  outline: 3px solid #8ecae6;
  outline-offset: 3px;
}

.body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  margin: 0;
}

.name {
  display: block;
  color: var(--travel-text);
  overflow-wrap: anywhere;
}

.done .name {
  color: var(--travel-muted);
  text-decoration: line-through;
  text-decoration-color: rgba(185, 221, 210, 0.6);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.tag {
  font-size: 0.72rem;
  line-height: 1.6;
  padding: 0 0.5rem;
  border-radius: 999px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-optional {
  border: 1px dashed var(--travel-border);
  color: var(--travel-muted);
}

/* Same badge colours as the team's .sample-badge */
.tag-trip {
  background: #29473f;
  color: #cce9df;
}

.actions {
  display: flex;
  flex-shrink: 0;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--travel-muted);
}

.icon-btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-btn:hover:not(:disabled) {
  background: #354d51;
  color: var(--travel-text);
}

.icon-btn.danger:hover:not(:disabled) {
  background: #3a2328;
  color: #f0a597;
}

.edit {
  flex: 1;
  display: grid;
  gap: 0.4rem;
}

.edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.edit-row .form-select {
  width: auto;
  flex: 1 1 120px;
}

.form-control,
.form-select {
  --bs-form-select-bg-img: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3e%3cpath fill=%27none%27 stroke=%27%23bdc8d8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m2 5 6 6 6-6%27/%3e%3c/svg%3e");
  border: 1px solid var(--travel-border);
  border-radius: 0.6rem;
  background-color: var(--travel-bg);
  color: var(--travel-text);
}

.form-control:focus,
.form-select:focus {
  background-color: var(--travel-bg);
  color: var(--travel-text);
  border-color: var(--travel-accent);
  box-shadow: none;
}

.sm {
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .tick:checked+.tick-box {
    animation: none;
  }
}
</style>
