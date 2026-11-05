<script setup>
defineProps({ theme: { type: Object, required: true } })
// Fixed seeds keep particles steady while the weather and day selection update.
const particles = Array.from({ length: 64 }, (_, index) => ({
  id: index,
  style: {
    '--x': `${(index * 37.37) % 100}%`,
    '--y': `${(index * 23.71) % 130 - 30}%`,
    '--size': `${2 + index % 4}px`,
    '--duration': `${14 + index % 17}s`,
    '--delay': `${-(index * 3.17) % 29}s`,
    '--drift': `${index % 2 ? 40 + index : -40 - index}px`,
    '--opacity': .3 + (index % 5) / 10,
  },
}))
</script>

<template>
  <div class="itinerary-atmosphere" :class="[`effect-${theme.effect}`, `region-${theme.region}`]" :data-effect="theme.effect" :data-source="theme.source" aria-hidden="true">
    <div class="atmosphere-glow"></div>
    <div class="atmosphere-haze"></div>
    <span v-for="particle in particles" :key="particle.id" class="atmosphere-particle" :style="particle.style">
      <svg v-if="theme.effect === 'snow'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
        <path v-for="angle in [0, 60, 120, 180, 240, 300]" :key="angle" :transform="`rotate(${angle} 12 12)`" d="M12 12V2M9 5l3 3 3-3" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.itinerary-atmosphere { --glow: 99 161 208; --particle: var(--travel-particle); position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: -1; border-radius: 1.5rem; mask-image: linear-gradient(transparent, #000 5%, #000 94%, transparent); }
.atmosphere-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at 85% 8%, rgb(var(--glow) / .2), transparent 50%), radial-gradient(ellipse at 5% 65%, rgb(var(--glow) / .12), transparent 45%); }
.atmosphere-haze { position: absolute; inset: 0; opacity: .4; background: radial-gradient(ellipse at 20% 15%, rgb(var(--glow) / .17), transparent 65%); animation: sky-drift 28s ease-in-out infinite alternate; }
.atmosphere-particle { position: absolute; top: var(--y); left: var(--x); width: var(--size); height: var(--size); border-radius: 50%; background: rgb(var(--particle)); opacity: var(--opacity); animation: snow-fall var(--duration) linear var(--delay) infinite; }
.effect-snow { --glow: 119 175 223; }
.effect-snow .atmosphere-particle { width: calc(var(--size) * 3 + 4px); height: calc(var(--size) * 3 + 4px); background: transparent; color: rgb(var(--particle)); animation-name: flake-fall; }
.effect-snow svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0 2px rgb(225 241 255 / .2)); }
.effect-petals { --glow: 176 126 162; --particle: 241 193 211; }
.effect-petals.region-japan { --glow: 206 143 170; --particle: 255 197 218; }
.effect-petals.region-france { --glow: 131 167 157; --particle: 239 201 210; }
.effect-petals .atmosphere-particle { width: calc(var(--size) * 1.6); height: calc(var(--size) * 2.4); border-radius: 80% 10% 80% 20%; animation-name: petal-fall; }
.effect-leaves { --glow: 176 120 62; --particle: 218 159 87; }
.effect-leaves .atmosphere-particle { width: calc(var(--size) * 1.8); height: calc(var(--size) * 2.5); border-radius: 80% 0 80% 0; animation-name: petal-fall; }
.effect-rain { --glow: 96 128 163; --particle: 166 197 220; }
.effect-rain .atmosphere-particle { height: 24px; width: 1px; border-radius: 999px; animation: rain-fall 2.2s linear var(--delay) infinite; opacity: .25; }
.effect-sunshine { --glow: 204 167 95; --particle: 241 218 166; }
.effect-sunshine .atmosphere-particle { opacity: .25; animation-name: warm-drift; animation-duration: 28s; }
.effect-frost { --glow: 135 171 191; }
.effect-frost .atmosphere-particle { opacity: .18; animation-name: warm-drift; }
.effect-clouds { --glow: 138 166 188; }
.effect-clouds .atmosphere-particle { display: none; }
.effect-clouds .atmosphere-haze { opacity: .8; }
@keyframes snow-fall { from { transform: translate3d(0, -15vh, 0); } to { transform: translate3d(var(--drift), 65vh, 0); } }
@keyframes flake-fall { from { transform: translate3d(0, -15vh, 0) rotate(0deg); } to { transform: translate3d(var(--drift), 65vh, 0) rotate(150deg); } }
@keyframes petal-fall { from { transform: translate3d(0, -15vh, 0) rotate(0deg); } to { transform: translate3d(var(--drift), 65vh, 0) rotate(300deg); } }
@keyframes rain-fall { from { transform: translate3d(0, -20vh, 0) rotate(12deg); } to { transform: translate3d(-80px, 80vh, 0) rotate(12deg); } }
@keyframes warm-drift { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(var(--drift), -25vh, 0); } }
@keyframes sky-drift { from { transform: translateX(-4%); } to { transform: translateX(4%); } }
@media (max-width: 600px) { .atmosphere-particle:nth-of-type(n+34) { display: none; } }
@media (prefers-reduced-motion: reduce) { .itinerary-atmosphere *, .itinerary-atmosphere .atmosphere-particle { animation: none; } }
</style>
