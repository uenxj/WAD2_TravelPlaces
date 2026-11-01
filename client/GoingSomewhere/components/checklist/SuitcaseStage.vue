<script setup>
// Interactive suitcase: every item is a token. Unpacked tokens lie around the open case,
// packed ones sit inside it. Tap a token (or drag it in / out) to pack or unpack it.
// When everything is packed the lid swings shut.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CATEGORIES } from '../../src/checklist/catalog.js'
import { SHAPES, shapeFor, CATEGORY_TINTS as COLORS } from '../../src/checklist/shapes.js'

const props = defineProps({
  items: { type: Array, required: true },
  pending: { type: Object, default: () => new Set() },
  tripCode: { type: String, default: 'TRP' },
  cleared: { type: Boolean, default: false }, // final check done: show the luggage tag
})
const emit = defineEmits(['toggle'])


// ----- size -----
const stage = ref(null)
const caseEl = ref(null)
const width = ref(700)
let observer = null
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  observer.observe(stage.value)
})
onBeforeUnmount(() => observer?.disconnect())

const mobile = computed(() => width.value < 576)
const height = computed(() => (mobile.value ? 400 : 360))
const tok = computed(() => (mobile.value ? 38 : 46))
const box = computed(() => {
  const w = Math.min(width.value * (mobile.value ? 0.72 : 0.4), 380)
  const h = w * 0.6
  return { x: (width.value - w) / 2, y: height.value - h - 28, w, h, lid: h * 0.5 }
})

// ----- counts -----
const packed = computed(() => props.items.filter((i) => i.done).length)
const closed = computed(() => props.items.length > 0 && packed.value === props.items.length)

// ----- layout -----
const catIndex = (i) => CATEGORIES.findIndex((c) => c.name === i.category)
const sorted = computed(() =>
  [...props.items].sort((a, b) => catIndex(a) - catIndex(b) || String(a.createdAt).localeCompare(String(b.createdAt))),
)
function hash(text) {
  let h = 0
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

// Inside the case: fill rows from the bottom up; squeeze together when it gets full.
function insideSlots(n) {
  const { x, y, w, h } = box.value
  const s = tok.value
  const pad = 14
  const iw = w - pad * 2 - s
  const ih = h - pad * 2 - s
  let cols = Math.max(1, Math.floor((w - pad * 2) / (s + 6)))
  let rows = Math.max(1, Math.floor((h - pad * 2) / (s + 6)))
  if (n > cols * rows) {
    cols = Math.ceil(Math.sqrt(n * (iw / ih)))
    rows = Math.ceil(n / cols)
  }
  const stepX = Math.min(cols > 1 ? iw / (cols - 1) : 0, s + 6)
  const stepY = Math.min(rows > 1 ? ih / (rows - 1) : 0, s + 6)
  const usedW = (Math.min(n, cols) - 1) * stepX + s
  const offsetX = x + (w - usedW) / 2
  return Array.from({ length: n }, (_, k) => ({
    left: offsetX + (k % cols) * stepX,
    top: y + h - pad - s - Math.floor(k / cols) * stepY,
  }))
}

// Around the case: a staggered grid of spots outside the case and its open lid, closest
// to the case first, so items look scattered on the bed rather than lined up.
function outsideSlots(n) {
  const s = tok.value
  const { x, y, w, h, lid } = box.value
  const block = { x: x - 10, y: y - lid - 10, w: w + 20, h: h + lid + 20 }
  const cx = x + w / 2
  const cy = y - lid / 2
  for (let step = s + 18; step >= s * 0.6; step *= 0.85) {
    const spots = []
    let row = 0
    for (let top = 8; top <= height.value - s - 22; top += step * 0.86, row++) {
      for (let left = 8 + (row % 2) * (step / 2); left <= width.value - s - 8; left += step) {
        const hits = left + s > block.x && left < block.x + block.w && top + s > block.y && top < block.y + block.h
        if (!hits) spots.push({ left, top, d: Math.hypot(left + s / 2 - cx, top + s / 2 - cy) })
      }
    }
    if (spots.length >= n || step * 0.85 < s * 0.6) {
      spots.sort((a, b) => a.d - b.d)
      return Array.from({ length: n }, (_, k) => spots[k % Math.max(spots.length, 1)] ?? { left: 8, top: 8 })
    }
  }
  return []
}

const positions = computed(() => {
  const inside = sorted.value.filter((i) => i.done)
  const outside = sorted.value.filter((i) => !i.done)
  const map = {}
  insideSlots(inside.length).forEach((p, k) => {
    const id = inside[k].id
    map[id] = { ...p, rot: (hash(id) % 9) - 4, z: 3 + k }
  })
  outsideSlots(outside.length).forEach((p, k) => {
    const id = outside[k].id
    const jitter = hash(id)
    map[id] = { left: p.left + ((jitter % 11) - 5), top: p.top + (((jitter >> 3) % 11) - 5), rot: (jitter % 31) - 15, z: 3 }
  })
  return map
})

// ----- interaction: tap or drag -----
const drag = ref(null) // { id, sx, sy, dx, dy, moved }
function onDown(e, item) {
  if (props.pending.has(item.id)) return
  drag.value = { id: item.id, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onMove(e) {
  const d = drag.value
  if (!d) return
  d.dx = e.clientX - d.sx
  d.dy = e.clientY - d.sy
  if (Math.hypot(d.dx, d.dy) > 6) d.moved = true
}
function onUp(e, item) {
  const d = drag.value
  drag.value = null
  if (!d) return
  if (!d.moved) return emit('toggle', item)
  const r = caseEl.value.getBoundingClientRect()
  const inCase = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (inCase !== item.done) emit('toggle', item)
}
// Keyboard (Enter / Space) fires click with detail 0; pointer taps are handled in onUp.
function onClick(e, item) {
  if (e.detail === 0) emit('toggle', item)
}

function tokenStyle(item) {
  const p = positions.value[item.id] ?? { left: 0, top: 0, rot: 0, z: 3 }
  const d = drag.value?.id === item.id ? drag.value : null
  return {
    left: p.left + 'px',
    top: p.top + 'px',
    width: tok.value + 'px',
    height: tok.value + 'px',
    zIndex: d ? 30 : p.z,
    '--c': COLORS[item.category] ?? '#b9ddd2',
    transform: d
      ? `translate(${d.dx}px, ${d.dy}px) scale(1.18) rotate(0deg)`
      : `rotate(${p.rot}deg)`,
  }
}
</script>

<template>
  <section class="suitcase-panel" aria-labelledby="suitcase-title" data-testid="suitcase">
    <header class="sp-head">
      <div>
        <h2 id="suitcase-title" class="sp-title">Your suitcase</h2>
        <p class="sp-sub">
          <strong>{{ packed }}</strong> in the case · <strong>{{ items.length - packed }}</strong> still on the bed
        </p>
      </div>
      <ul class="legend" aria-label="Colour key">
        <li v-for="(color, name) in COLORS" :key="name" :style="{ '--c': color }">{{ name }}</li>
      </ul>
    </header>

    <div ref="stage" class="stage" :class="{ closed, cleared: closed && cleared, dragging: !!drag }"
      :style="{ height: height + 'px' }" @pointermove="onMove">
      <p class="stage-hint" aria-hidden="true">
        <template v-if="closed">{{ cleared ? 'Tagged and cleared. Ready to fly!' : 'All packed. Lid closed, one final check to go.' }}</template>
        <template v-else>{{ mobile ? 'Tap an item to pack it' : 'Tap an item, or drag it into the case' }}</template>
      </p>

      <!-- the case: lining + lid that swings shut at 100% -->
      <div ref="caseEl" class="case" :style="{ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }">
        <div class="case-body">
          <span class="strap s1"></span>
          <span class="strap s2"></span>
        </div>
        <div class="lid">
          <div class="lid-face lid-inside">
            <span class="pocket"></span>
          </div>
          <div class="lid-face lid-outside">
            <span class="handle"></span>
            <span class="band"></span>
            <span class="sticker">Ready to fly</span>
          </div>
        </div>
        <div class="tag" aria-hidden="true">
          <span class="tag-string"></span>
          <span class="tag-card">{{ tripCode }}<small>✈ cleared</small></span>
        </div>
      </div>

      <!-- item tokens -->
      <button v-for="item in sorted" :key="item.id" type="button" class="token"
        :class="{ packed: item.done, busy: pending.has(item.id), held: drag?.id === item.id }"
        :style="tokenStyle(item)" :data-name="item.name"
        :aria-label="`${item.name} (${item.category}): ${item.done ? 'in the suitcase, press to unpack' : 'not packed, press to pack'}`"
        @pointerdown="onDown($event, item)" @pointerup="onUp($event, item)" @pointercancel="drag = null"
        @click="onClick($event, item)">
        <svg class="shape" viewBox="0 0 40 40" aria-hidden="true" v-html="SHAPES[shapeFor(item)]"></svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.suitcase-panel {
  margin-bottom: 1.25rem;
  padding: 1.1rem 1.25rem 1.25rem;
  border: 1px solid var(--travel-border);
  border-radius: 1.25rem;
  background: var(--travel-panel);
}

.sp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.sp-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.sp-sub {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--travel-muted);
}

.sp-sub strong {
  color: var(--travel-text);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  color: var(--travel-muted);
}

.legend li::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.3rem;
  border-radius: 50%;
  background: var(--c);
}

/* The "bed": soft spotlight with a faint woven texture */
.stage {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  background:
    radial-gradient(ellipse at 50% 75%, rgba(185, 221, 210, 0.1), transparent 60%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.018) 0 2px, transparent 2px 9px),
    #142036;
  user-select: none;
}

.stage-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  margin: 0;
  text-align: center;
  font-size: 0.72rem;
  color: var(--travel-muted);
  opacity: 0.8;
  pointer-events: none;
}

/* ---------- the case ---------- */
/* Below the tokens while open; above them (so the lid covers them) once closed.
   Both wait until the last token has landed. */
.case {
  position: absolute;
  z-index: 1;
  perspective: 900px;
  transform-style: preserve-3d;
}

.closed .case {
  z-index: 40;
  transition: z-index 0s linear 0.5s;
}

.case-body {
  position: absolute;
  inset: 0;
  border: 4px solid #6c8a87;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.25), transparent 30%),
    #1d3440;
  box-shadow: inset 0 0 0 2px #29473f, 0 14px 30px rgba(0, 0, 0, 0.35);
}

/* zip line */
.case-body::after {
  content: '';
  position: absolute;
  inset: 7px;
  border: 1px dashed rgba(185, 221, 210, 0.3);
  border-radius: 9px;
}

.strap {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  background: rgba(185, 221, 210, 0.08);
}

.s1 {
  left: 28%;
}

.s2 {
  right: 28%;
}

/* Lid hinges on the case's top edge: tilted back when open, flat on top when closed */
.lid {
  position: absolute;
  inset: 0;
  z-index: 50;
  transform-origin: top center;
  transform-style: preserve-3d;
  transform: rotateX(-118deg);
  transition: transform 0.9s cubic-bezier(0.5, 0, 0.3, 1.25);
  pointer-events: none;
}

.closed .lid {
  transform: rotateX(0deg);
  transition-delay: 0.5s;
}

.lid-face {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  backface-visibility: hidden;
}

.lid-outside {
  border: 4px solid #6c8a87;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 2px, transparent 2px 14px),
    linear-gradient(160deg, #3e5f5c, #24403f);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.4);
}

.lid-inside {
  transform: rotateX(180deg);
  border: 4px solid #6c8a87;
  background: #24404a;
}

.pocket {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 14%;
  bottom: 30%;
  border: 1px dashed rgba(185, 221, 210, 0.35);
  border-radius: 8px;
}

.handle {
  position: absolute;
  left: 50%;
  top: 12px;
  width: 64px;
  height: 14px;
  transform: translateX(-50%);
  border: 4px solid #b9ddd2;
  border-radius: 10px;
  opacity: 0.85;
}

.band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 12px;
  background: rgba(185, 221, 210, 0.22);
}

.sticker {
  position: absolute;
  right: 12%;
  bottom: 14%;
  padding: 0.15rem 0.6rem;
  border: 2px solid #101a2e;
  border-radius: 999px;
  background: #b9ddd2;
  color: #101a2e;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-8deg);
}

/* Luggage tag that swings in once the lid is shut */
.tag {
  position: absolute;
  left: 8%;
  top: 10px;
  z-index: 60;
  transform-origin: top left;
  transform: rotate(-80deg) scale(0.6);
  opacity: 0;
  transition: opacity 0.2s ease 0.7s;
  pointer-events: none;
}

.cleared .tag {
  opacity: 1;
  transition-delay: 1.2s;
  animation: swing 1.6s ease-out 1.25s both;
}

@keyframes swing {
  0% {
    transform: rotate(-80deg) scale(0.6);
  }

  35% {
    transform: rotate(28deg) scale(1);
  }

  60% {
    transform: rotate(10deg);
  }

  80% {
    transform: rotate(19deg);
  }

  100% {
    transform: rotate(15deg);
  }
}

.tag-string {
  display: block;
  width: 2px;
  height: 22px;
  margin-left: 6px;
  background: #b9ddd2;
}

.tag-card {
  display: grid;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: #f2c879;
  color: #101a2e;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.08em;
  line-height: 1.1;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}

.tag-card small {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ---------- tokens ---------- */
/* Each token is a flat illustration of the item (see src/checklist/shapes.js),
   tinted by category, lying on the bed like a flat-lay. */
.token {
  position: absolute;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: grab;
  touch-action: none;
  filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.45));
  transition:
    left 0.65s cubic-bezier(0.3, 1.3, 0.5, 1),
    top 0.65s cubic-bezier(0.3, 1.3, 0.5, 1),
    transform 0.25s ease,
    filter 0.2s ease;
}

.shape {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: var(--c);
  stroke: #0f1a2c;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

/* Packed: tucked in, a little smaller, shadow flattened */
.token.packed {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

.token.packed .shape {
  transform: scale(0.9);
  transform-origin: center;
}

.token:hover,
.token:focus-visible {
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c) 70%, transparent)) drop-shadow(0 6px 6px rgba(0, 0, 0, 0.45));
}

.token:focus-visible {
  outline: 2px solid #8ecae6;
  outline-offset: 2px;
}

.token.held {
  cursor: grabbing;
  transition: filter 0.2s ease;
  filter: drop-shadow(0 12px 10px rgba(0, 0, 0, 0.5));
}

.token.busy {
  opacity: 0.6;
}

/* Name tooltip */
.token::after {
  content: attr(data-name);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: #0b1424;
  color: var(--travel-text);
  font-size: 0.72rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.token:hover::after,
.token:focus-visible::after,
.token.held::after {
  opacity: 1;
}

.dragging .token:not(.held)::after {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {

  .token,
  .lid {
    transition: none;
  }

  .cleared .tag {
    animation: none;
    transform: rotate(15deg);
  }
}
</style>
