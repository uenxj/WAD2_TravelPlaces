<script setup>
// Quick pack: walk through unpacked items one at a time, essentials first.
// Pack = button, P key or swipe right. Skip = button, S / → key or swipe left. Esc closes.
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { CATEGORIES } from '../../src/checklist/catalog.js'
import { artUrl } from '../../src/checklist/itemArtUrls.js'

const props = defineProps({
  items: { type: Array, required: true },
})
const emit = defineEmits(['toggle', 'close'])

const order = (i) => (i.priority === 'essential' ? 0 : 100) + CATEGORIES.findIndex((c) => c.name === i.category)
function buildQueue() {
  return props.items.filter((i) => !i.done).sort((a, b) => order(a) - order(b)).map((i) => i.id)
}

const queue = ref(buildQueue())
const index = ref(0)
const packedCount = ref(0)
const skipped = ref([])
const leaving = ref('left') // which way the card flies out
const dragX = ref(0)
const packBtn = ref(null)
const touchHint = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const current = computed(() => props.items.find((i) => i.id === queue.value[index.value]) ?? null)
const finished = computed(() => index.value >= queue.value.length)

async function advance() {
  index.value++
  // Skip anything deleted or packed elsewhere while this was open.
  while (index.value < queue.value.length && (!current.value || current.value.done)) index.value++
  dragX.value = 0
  await nextTick()
  packBtn.value?.focus()
}

function pack() {
  if (!current.value || finished.value) return
  leaving.value = 'right'
  emit('toggle', current.value)
  packedCount.value++
  advance()
}

function skip() {
  if (!current.value || finished.value) return
  leaving.value = 'left'
  skipped.value.push(current.value.id)
  advance()
}

async function again() {
  queue.value = buildQueue()
  index.value = 0
  skipped.value = []
  await nextTick()
  packBtn.value?.focus()
}

// ----- swipe -----
let startX = null
function onDown(e) {
  startX = e.clientX
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onMove(e) {
  if (startX !== null) dragX.value = e.clientX - startX
}
function onUp() {
  if (startX === null) return
  startX = null
  if (dragX.value > 80) pack()
  else if (dragX.value < -80) skip()
  else dragX.value = 0
}

// ----- keyboard -----
function onKey(e) {
  if (e.key === 'Escape') return emit('close')
  if (finished.value || e.target.closest?.('input, textarea, select')) return
  const key = e.key.toLowerCase()
  if (key === 'p') { e.preventDefault(); pack() }
  else if (key === 's' || e.key === 'ArrowRight') { e.preventDefault(); skip() }
}

let previousOverflow = ''
onMounted(() => {
  window.addEventListener('keydown', onKey)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  packBtn.value?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div class="qp-backdrop" @click.self="emit('close')">
    <section class="qp" role="dialog" aria-modal="true" aria-labelledby="qp-title">
      <header class="qp-head">
        <div>
          <p class="eyebrow mb-1">Quick pack</p>
          <h2 id="qp-title" class="qp-title">{{ finished ? 'Sweep complete' : 'Is it in the bag?' }}</h2>
        </div>
        <button type="button" class="qp-close" aria-label="Close quick pack" @click="emit('close')">×</button>
      </header>

      <div class="qp-progress" aria-hidden="true">
        <span :style="{ width: (Math.min(index, queue.length) / (queue.length || 1)) * 100 + '%' }"></span>
      </div>
      <p class="qp-count" aria-live="polite">
        <template v-if="!finished">Item {{ index + 1 }} of {{ queue.length }}</template>
        <template v-else>{{ packedCount }} packed · {{ skipped.length }} skipped</template>
      </p>

      <div class="qp-stage">
        <Transition :name="`fly-${leaving}`" mode="out-in">
          <article v-if="!finished && current" :key="current.id" class="qp-card"
            :style="{ transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)` }"
            :class="{ dragging: dragX !== 0, 'lean-pack': dragX > 40, 'lean-skip': dragX < -40 }"
            @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
            <img class="qp-shape" :src="artUrl(current)" alt="" draggable="false">
            <p class="qp-cat">{{ current.category }}</p>
            <h3 class="qp-name">{{ current.name }}</h3>
            <div class="qp-tags">
              <span class="qp-tag" :class="current.priority">{{ current.priority === 'essential' ? 'Essential' : 'Optional' }}</span>
              <span v-if="current.reason" class="qp-tag reason">✦ {{ current.reason }}</span>
            </div>
            <span class="qp-lean pack" aria-hidden="true">Packed</span>
            <span class="qp-lean skip" aria-hidden="true">Later</span>
          </article>

          <article v-else key="done" class="qp-card qp-done">
            <span class="qp-icon big" aria-hidden="true">✈</span>
            <h3 class="qp-name">{{ skipped.length ? 'Nearly there' : 'All checked!' }}</h3>
            <p class="qp-summary">
              <template v-if="skipped.length">{{ skipped.length }} item{{ skipped.length === 1 ? '' : 's' }} still to find.</template>
              <template v-else-if="queue.length">Everything on this sweep is in the bag.</template>
              <template v-else>Nothing left to pack.</template>
            </p>
          </article>
        </Transition>
      </div>

      <div v-if="!finished" class="qp-actions">
        <button type="button" class="secondary-action" @click="skip">Not yet <kbd>S</kbd></button>
        <button ref="packBtn" type="button" class="primary-action" @click="pack">Packed it ✓ <kbd>P</kbd></button>
      </div>
      <div v-else class="qp-actions">
        <button v-if="skipped.length" type="button" class="secondary-action" @click="again">Go through skipped</button>
        <button ref="packBtn" type="button" class="primary-action" @click="emit('close')">Done</button>
      </div>
      <p v-if="!finished" class="qp-help">{{ touchHint ? 'Swipe right to pack, left for later' : 'Swipe or use P / S · Esc to close' }}</p>
    </section>
  </div>
</template>

<style scoped>
.qp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--travel-backdrop-strong);
  backdrop-filter: blur(4px);
}

.qp {
  width: min(100%, 440px);
  padding: 1.25rem 1.25rem 1rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
  color: var(--travel-text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.qp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.qp-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.qp-close {
  border: 0;
  background: none;
  color: var(--travel-muted);
  font-size: 1.6rem;
  line-height: 1;
}

.qp-progress {
  height: 4px;
  margin-top: 1rem;
  border-radius: 2px;
  background: var(--travel-track);
  overflow: hidden;
}

.qp-progress span {
  display: block;
  height: 100%;
  background: var(--travel-accent);
  transition: width 0.3s ease;
}

.qp-count {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  color: var(--travel-muted);
}

.qp-stage {
  display: grid;
  min-height: 250px;
  margin: 1rem 0;
}

.qp-card {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.35rem;
  padding: 1.75rem 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1rem;
  background: linear-gradient(160deg, var(--travel-panel-alt) 0%, var(--travel-panel) 70%);
  text-align: center;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.qp-card.dragging {
  transition: none;
  cursor: grabbing;
}

.qp-card.lean-pack {
  border-color: var(--travel-accent);
}

.qp-card.lean-skip {
  border-color: var(--travel-gold);
}

.qp-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--travel-strong);
  color: var(--travel-accent);
  margin-bottom: 0.35rem;
}

.qp-icon svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.qp-shape {
  width: 84px;
  height: 84px;
  margin-bottom: 0.5rem;
  filter: saturate(0.45) brightness(0.92) drop-shadow(0 8px 8px rgba(0, 0, 0, 0.45));
  animation: bob 2.6s ease-in-out infinite;
}

@keyframes bob {
  50% {
    transform: translateY(-4px) rotate(-3deg);
  }
}

.qp-icon.big {
  font-size: 1.8rem;
}

.qp-cat {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--travel-accent);
}

.qp-name {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.qp-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.qp-tag {
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid var(--travel-border);
  color: var(--travel-muted);
}

.qp-tag.essential {
  border-color: var(--travel-accent);
  color: var(--travel-accent);
}

.qp-tag.reason {
  border: 0;
  background: var(--travel-selected);
  color: var(--travel-selected-text);
}

.qp-summary {
  margin: 0;
  color: var(--travel-muted);
}

/* "Packed" / "Later" labels that fade in while swiping */
.qp-lean {
  position: absolute;
  top: 1rem;
  padding: 0 0.5rem;
  border: 2px solid currentColor;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.qp-lean.pack {
  left: 1rem;
  color: var(--travel-accent);
  transform: rotate(-10deg);
}

.qp-lean.skip {
  right: 1rem;
  color: var(--travel-gold);
  transform: rotate(10deg);
}

.lean-pack .qp-lean.pack,
.lean-skip .qp-lean.skip {
  opacity: 1;
}

.qp-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.qp-actions> :only-child {
  grid-column: 1 / -1;
}

.qp-actions button {
  padding: 0.75rem 1rem;
}

kbd {
  padding: 0 0.35rem;
  border: 1px solid rgb(var(--travel-text-rgb) / 0.25);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 0.7rem;
  opacity: 0.75;
}

.qp-help {
  margin: 0.75rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--travel-muted);
}

/* Card flies right when packed, left when skipped */
.fly-right-leave-active,
.fly-left-leave-active {
  transition: transform 0.22s ease-in, opacity 0.22s ease-in;
}

.fly-right-leave-to {
  transform: translateX(120%) rotate(12deg) !important;
  opacity: 0;
}

.fly-left-leave-to {
  transform: translateX(-120%) rotate(-12deg) !important;
  opacity: 0;
}

.fly-right-enter-active,
.fly-left-enter-active {
  transition: transform 0.22s ease-out, opacity 0.22s ease-out;
}

.fly-right-enter-from,
.fly-left-enter-from {
  transform: scale(0.94);
  opacity: 0;
}

@media (max-width: 420px) {
  kbd {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {

  .qp-shape {
    animation: none;
  }

  .qp-card,
  .fly-right-leave-active,
  .fly-left-leave-active,
  .fly-right-enter-active,
  .fly-left-enter-active {
    transition: none;
  }
}
</style>
