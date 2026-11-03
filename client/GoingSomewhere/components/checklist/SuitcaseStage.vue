<script setup>
// Flat-lay suitcase seen from above: lid (top) and base (bottom), each with compartments.
// Every checklist item is a picture. Unpacked items lie around the case; packed ones sit in
// their compartment slot, and empty slots show a faint outline of what still belongs there.
// Tap an item (or drag it in / out) to pack or unpack it. At 100% the lid folds shut.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CATEGORIES } from '../../src/checklist/catalog.js'
import { artUrl } from '../../src/checklist/itemArtUrls.js'

const props = defineProps({
  items: { type: Array, required: true },
  pending: { type: Object, default: () => new Set() },
  tripCode: { type: String, default: 'TRP' },
  cleared: { type: Boolean, default: false }, // final check done: show the luggage tag
})
const emit = defineEmits(['toggle'])

// Compartments: two mesh pockets in the lid, two sections in the base.
const ZONES = [
  { id: 'docs', label: 'Documents', short: 'Docs', cats: ['Documents'], part: 'lid' },
  { id: 'wash', label: 'Wash & health', short: 'Wash', cats: ['Toiletries', 'Health'], part: 'lid' },
  { id: 'clothes', label: 'Clothing', short: 'Clothes', cats: ['Clothing'], part: 'base' },
  { id: 'gear', label: 'Tech & essentials', short: 'Tech', cats: ['Electronics', 'Essentials'], part: 'base' },
]
const zoneFor = (item) => ZONES.find((z) => z.cats.includes(item.category)) ?? ZONES[3]

// ----- size -----
const stage = ref(null)
const lidEl = ref(null)
const baseEl = ref(null)
const width = ref(700)
let observer = null
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  observer.observe(stage.value)
})
onBeforeUnmount(() => observer?.disconnect())

const mobile = computed(() => width.value < 640)
const tok = computed(() => (mobile.value ? 38 : 46)) // size of items lying outside

const closed = computed(() => props.items.length > 0 && props.items.every((i) => i.done))

// Lid and base are the same size so the lid can fold exactly over the base.
// Once closed, the base moves to the top and the panel shrinks to fit (after the lid has folded).
const geo = computed(() => {
  const W = width.value
  const cw = mobile.value ? W - 24 : Math.min(W * 0.5, 540)
  const h = cw * (mobile.value ? 0.66 : 0.44)
  const x = (W - cw) / 2
  if (closed.value) {
    const baseY = 24
    return { W, cw, h, x, lidY: baseY - h - 14, baseY, height: baseY + h + 44 }
  }
  const band = mobile.value ? 118 : 24 // room for loose items above the case on phones
  const lidY = band
  const baseY = lidY + h + 14
  const height = baseY + h + (mobile.value ? 150 : 46)
  return { W, cw, h, x, lidY, baseY, height }
})

// Compartment rectangles inside the lining.
const zoneRects = computed(() => {
  const { cw, h, x, lidY, baseY } = geo.value
  const p = 16
  const gap = 10
  const w = cw - 2 * p
  const ih = h - 2 * p
  return {
    docs: { x: x + p, y: lidY + p, w: w * 0.48 - gap / 2, h: ih },
    wash: { x: x + p + w * 0.48 + gap / 2, y: lidY + p, w: w * 0.52 - gap / 2, h: ih },
    clothes: { x: x + p, y: baseY + p, w: w * 0.58 - gap / 2, h: ih },
    gear: { x: x + p + w * 0.58 + gap / 2, y: baseY + p, w: w * 0.42 - gap / 2, h: ih },
  }
})

// ----- items -----
const catIndex = (i) => CATEGORIES.findIndex((c) => c.name === i.category)
const sorted = computed(() =>
  [...props.items].sort((a, b) => catIndex(a) - catIndex(b) || String(a.createdAt).localeCompare(String(b.createdAt))),
)

function hash(text) {
  let h = 0
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

// One fixed slot per item inside its compartment, so outline and packed item share a place.
const slots = computed(() => {
  const map = {}
  for (const z of ZONES) {
    const r = zoneRects.value[z.id]
    const mine = sorted.value.filter((i) => zoneFor(i) === z)
    const n = mine.length
    if (!n) continue
    const top = 20
    const iw = r.w - 12
    const ih = r.h - top - 6
    let cols = Math.max(1, Math.round(Math.sqrt((n * iw) / ih)))
    let rows = Math.ceil(n / cols)
    if (cols * (rows - 1) >= n) rows -= 1
    const cell = Math.min(iw / cols, ih / rows)
    const s = Math.min(cell * 0.86, 56)
    const ox = r.x + 6 + (iw - cols * cell) / 2
    const oy = r.y + top + (ih - rows * cell) / 2
    mine.forEach((it, k) => {
      map[it.id] = {
        left: ox + (k % cols) * cell + (cell - s) / 2,
        top: oy + Math.floor(k / cols) * cell + (cell - s) / 2,
        size: s,
      }
    })
  }
  return map
})

const zoneStats = computed(() =>
  Object.fromEntries(ZONES.map((z) => {
    const mine = props.items.filter((i) => zoneFor(i) === z)
    const done = mine.filter((i) => i.done).length
    return [z.id, { total: mine.length, done, complete: mine.length > 0 && done === mine.length }]
  })),
)

// Spots on the "bed" around the case, closest to the case first.
const outsideSpots = computed(() => {
  const { W, cw, h, x, lidY, baseY, height } = geo.value
  const s = tok.value
  const step = s + 14
  const block = { x: x - 14, y: lidY - 14, w: cw + 28, h: baseY + h + 24 - lidY + 14 }
  const spots = []
  for (let top = 10, row = 0; top <= height - s - 22; top += step * 0.85, row++) {
    for (let left = 10 + (row % 2) * (step / 2); left <= W - s - 10; left += step) {
      const hits = left + s > block.x && left < block.x + block.w && top + s > block.y && top < block.y + block.h
      if (!hits) spots.push({ left, top, d: Math.hypot(left + s / 2 - (x + cw / 2), (top + s / 2 - (lidY + h)) * 1.3) })
    }
  }
  return spots.sort((a, b) => a.d - b.d)
})

const positions = computed(() => {
  const map = {}
  let k = 0
  for (const it of sorted.value) {
    const jitter = hash(it.id)
    if (it.done) {
      const s = slots.value[it.id]
      map[it.id] = { left: s.left, top: s.top, size: s.size, rot: (jitter % 7) - 3 }
    } else {
      const spot = outsideSpots.value[k++ % Math.max(outsideSpots.value.length, 1)] ?? { left: 8, top: 8 }
      map[it.id] = {
        left: spot.left + ((jitter % 9) - 4),
        top: spot.top + (((jitter >> 3) % 9) - 4),
        size: tok.value,
        rot: (jitter % 27) - 13,
      }
    }
  }
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
const inside = (el, e) => {
  const r = el?.getBoundingClientRect()
  return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
}
function onUp(e, item) {
  const d = drag.value
  drag.value = null
  if (!d) return
  if (!d.moved) return emit('toggle', item)
  const inCase = inside(lidEl.value, e) || inside(baseEl.value, e)
  if (inCase !== item.done) emit('toggle', item)
}
// Keyboard (Enter / Space) fires click with detail 0; pointer taps are handled in onUp.
function onClick(e, item) {
  if (e.detail === 0) emit('toggle', item)
}

const px = (r) => ({ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' })
function tokenStyle(item) {
  const p = positions.value[item.id] ?? { left: 0, top: 0, size: tok.value, rot: 0 }
  const d = drag.value?.id === item.id ? drag.value : null
  return {
    left: p.left + 'px',
    top: p.top + 'px',
    width: p.size + 'px',
    height: p.size + 'px',
    transform: d ? `translate(${d.dx}px, ${d.dy}px) scale(1.15)` : `rotate(${p.rot}deg)`,
  }
}
function ghostStyle(item) {
  const s = slots.value[item.id]
  return s ? { left: s.left + 'px', top: s.top + 'px', width: s.size + 'px', height: s.size + 'px' } : { display: 'none' }
}
</script>

<template>
  <section class="suitcase-panel" aria-labelledby="suitcase-title" data-testid="suitcase">
    <h2 id="suitcase-title" class="sp-title">Your suitcase</h2>

    <div ref="stage" class="stage" :class="{ closed, cleared: closed && cleared, dragging: !!drag }"
      :style="{ height: geo.height + 'px' }" @pointermove="onMove">

      <!-- lid: inside face (open) and outside face (shown once it folds shut) -->
      <div ref="lidEl" class="lid" :style="px({ x: geo.x, y: geo.lidY, w: geo.cw, h: geo.h })">
        <div class="face lid-inside"><span class="zip"></span></div>
        <div class="face lid-outside">
          <span class="grip"></span>
          <span class="band"></span>
          <span class="sticker">Ready to fly</span>
          <span class="tag" aria-hidden="true">{{ tripCode }} ✈<small>cleared</small></span>
        </div>
      </div>
      <div class="hinge" :style="px({ x: geo.x + geo.cw * 0.2, y: geo.lidY + geo.h + 2, w: geo.cw * 0.6, h: 10 })"></div>
      <div ref="baseEl" class="base" :style="px({ x: geo.x, y: geo.baseY, w: geo.cw, h: geo.h })"><span class="zip"></span></div>
      <div class="handle" :style="{ left: geo.x + geo.cw / 2 + 'px', top: geo.baseY + geo.h + 'px' }"></div>

      <!-- compartments -->
      <div v-for="z in ZONES" :key="z.id" class="zone" :class="[z.part === 'lid' ? 'mesh' : 'main', { complete: zoneStats[z.id].complete }]"
        :style="px(zoneRects[z.id])">
        <span class="zl">{{ mobile ? z.short : z.label }}</span>
        <span class="zc">{{ zoneStats[z.id].done }}/{{ zoneStats[z.id].total }}</span>
        <span class="ok" aria-hidden="true">Packed</span>
      </div>

      <!-- faint outlines of what still belongs in each slot -->
      <img v-for="item in sorted.filter((i) => !i.done)" :key="'g' + item.id" class="ghost" :src="artUrl(item)" alt=""
        aria-hidden="true" draggable="false" :style="ghostStyle(item)">

      <!-- the items -->
      <button v-for="item in sorted" :key="item.id" type="button" class="token"
        :class="{ packed: item.done, busy: pending.has(item.id), held: drag?.id === item.id }"
        :style="tokenStyle(item)" :data-name="item.name"
        :aria-label="`${item.name} (${item.category}): ${item.done ? 'in the suitcase, press to unpack' : 'not packed, press to pack'}`"
        @pointerdown="onDown($event, item)" @pointerup="onUp($event, item)" @pointercancel="drag = null"
        @click="onClick($event, item)">
        <img :src="artUrl(item)" alt="" draggable="false">
      </button>

      <p class="stage-hint" aria-hidden="true">
        <template v-if="closed">{{ cleared ? 'Tagged and cleared. Ready to fly!' : 'All packed. Lid closed, one final check to go.' }}</template>
        <template v-else>{{ mobile ? 'Tap an item to pack it' : 'Tap an item, or drag it into the case' }}</template>
      </p>
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

.sp-title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
}

/* The "bed": soft spotlight with a faint woven texture.
   Closing: the lid folds first (≈1.4 s), then the panel shrinks to the closed case.
   Opening: the panel grows straight away while the lid unfolds. */
.stage {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  perspective: 1600px;
  transition: height 0.6s ease;
  background:
    radial-gradient(ellipse at 50% 55%, rgba(185, 221, 210, 0.09), transparent 65%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.018) 0 2px, transparent 2px 9px),
    #142036;
  user-select: none;
}

.stage.closed {
  transition-delay: 1.4s;
}

.stage-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
  margin: 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--travel-muted);
  pointer-events: none;
}

/* ---------- the case (top-down) ---------- */
.base,
.face {
  border-radius: 22px;
  background: #3e5f5c;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.4), inset 0 0 0 3px #6c8a87;
}

.base {
  position: absolute;
}

/* The case slides up into the smaller closed panel, after the lid has folded */
.base,
.hinge,
.handle {
  transition: top 0.6s ease;
}

.closed .base,
.closed .hinge,
.closed .handle {
  transition-delay: 1.4s;
}

/* lining */
.base::before,
.lid-inside::before {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: 15px;
  background: #1d3440;
  box-shadow: inset 0 0 0 2px #29473f;
}

.zip {
  position: absolute;
  inset: 5px;
  border-radius: 18px;
  border: 2px dashed rgba(185, 221, 210, 0.35);
  pointer-events: none;
}

.hinge {
  position: absolute;
  border-radius: 5px;
  background: #2c4a48;
  box-shadow: inset 0 0 0 2px #6c8a87;
}

.handle {
  position: absolute;
  width: 80px;
  height: 16px;
  border: 5px solid #6c8a87;
  border-top: 0;
  border-radius: 0 0 12px 12px;
  transform: translateX(-50%);
}

/* The lid folds down over the base along the hinge when everything is packed */
/* Opening: the lid stays on top (z-index) until it has fully unfolded, so the compartments
   underneath never show through it. Closing: it jumps on top at once, then folds. */
.lid {
  position: absolute;
  z-index: 1;
  transform-style: preserve-3d;
  transform-origin: 50% calc(100% + 7px);
  transition:
    transform 1s cubic-bezier(0.5, 0, 0.25, 1.15) 0.1s,
    top 0.6s ease,
    z-index 0s linear 1.15s;
  pointer-events: none;
}

.closed .lid {
  z-index: 20;
  transform: rotateX(-180deg);
  transition:
    transform 1s cubic-bezier(0.5, 0, 0.25, 1.15) 0.35s,
    top 0.6s ease 1.4s,
    z-index 0s;
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.lid-outside {
  transform: rotateX(180deg);
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 16px),
    linear-gradient(160deg, #4a6e6a, #2c4a48);
}

.grip {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 90px;
  height: 18px;
  border: 5px solid #b9ddd2;
  border-radius: 12px;
  transform: translateX(-50%);
  opacity: 0.85;
}

.band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 12px;
  background: rgba(185, 221, 210, 0.2);
}

.sticker {
  position: absolute;
  right: 10%;
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

/* Luggage tag: only after the final check */
.tag {
  position: absolute;
  left: 10%;
  top: 16%;
  display: grid;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: #f2c879;
  color: #101a2e;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.1;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: rotate(-60deg) scale(0.6);
  transform-origin: top left;
}

.tag small {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cleared .tag {
  opacity: 1;
  animation: swing 1.6s ease-out 1.3s both;
}

@keyframes swing {
  0% {
    transform: rotate(-60deg) scale(0.6);
  }

  40% {
    transform: rotate(24deg) scale(1);
  }

  65% {
    transform: rotate(8deg);
  }

  100% {
    transform: rotate(14deg);
  }
}

/* ---------- compartments ---------- */
.zone {
  position: absolute;
  z-index: 2;
  border-radius: 12px;
  transition: box-shadow 0.3s ease, opacity 0.25s ease;
}

.zone.mesh {
  background:
    repeating-linear-gradient(45deg, rgba(185, 221, 210, 0.06) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(-45deg, rgba(185, 221, 210, 0.06) 0 1px, transparent 1px 7px),
    rgba(0, 0, 0, 0.12);
  box-shadow: inset 0 0 0 2px rgba(185, 221, 210, 0.25);
}

.zone.main {
  background: rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 0 0 1px rgba(185, 221, 210, 0.15);
}

.zl,
.zc {
  position: absolute;
  top: 6px;
  font-size: 0.66rem;
  color: rgba(189, 200, 216, 0.8);
}

.zl {
  left: 10px;
  max-width: calc(100% - 50px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.zc {
  right: 10px;
}

.zone.complete {
  box-shadow: inset 0 0 0 2px var(--travel-accent), 0 0 18px rgba(185, 221, 210, 0.25);
}

.zone.complete .zl,
.zone.complete .zc {
  color: var(--travel-accent);
}

.ok {
  position: absolute;
  right: 8px;
  bottom: 6px;
  padding: 0 0.45rem;
  border: 2px solid var(--travel-accent);
  border-radius: 4px;
  color: var(--travel-accent);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-8deg) scale(0);
  transition: transform 0.35s cubic-bezier(0.2, 1.5, 0.5, 1);
}

.complete .ok {
  transform: rotate(-8deg) scale(1);
}

/* ---------- outlines + items (Fluent Emoji, softened to sit on the dark theme) ---------- */
.ghost {
  position: absolute;
  z-index: 2;
  opacity: 0.14;
  filter: grayscale(1) brightness(1.6);
  pointer-events: none;
}

.token {
  position: absolute;
  z-index: 3;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: grab;
  touch-action: none;
  filter: drop-shadow(0 5px 4px rgba(0, 0, 0, 0.45));
  transition:
    left 0.65s cubic-bezier(0.3, 1.25, 0.5, 1),
    top 0.65s cubic-bezier(0.3, 1.25, 0.5, 1),
    width 0.65s ease,
    height 0.65s ease,
    transform 0.25s ease,
    opacity 0.3s ease;
}

.token img {
  display: block;
  width: 100%;
  height: 100%;
  filter: saturate(0.45) brightness(0.92);
  pointer-events: none;
}

.token.packed {
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
}

.token:hover,
.token:focus-visible {
  z-index: 10;
  filter: drop-shadow(0 0 6px rgba(185, 221, 210, 0.55)) drop-shadow(0 6px 6px rgba(0, 0, 0, 0.45));
}

.token:focus-visible {
  outline: 2px solid #8ecae6;
  outline-offset: 2px;
}

.token.held {
  z-index: 30;
  cursor: grabbing;
  transition: filter 0.2s ease;
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

/* Closed: compartments, outlines and packed items go under the lid (fading as it covers them).
   Reopened: they only come back once the lid has unfolded, together with the case. */
.zone,
.ghost,
.stage:not(.closed) .token.packed {
  transition-property: box-shadow, opacity, left, top, width, height, transform;
  transition-duration: 0.3s, 0.35s, 0.65s, 0.65s, 0.65s, 0.65s, 0.25s;
  transition-delay: 0s, 1.1s, 0s, 0s, 0s, 0s, 0s;
}

.closed .zone,
.closed .ghost,
.closed .token.packed {
  opacity: 0;
  transition: opacity 0.3s ease 0.6s;
}

.closed .token.packed {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {

  .token,
  .lid,
  .ok,
  .stage,
  .base,
  .hinge,
  .handle {
    transition: none;
  }

  .cleared .tag {
    animation: none;
    transform: rotate(14deg);
  }
}
</style>
