<script setup>
defineProps({ label: { type: String, default: 'Loading…' }, compact: Boolean })
</script>

<template>
  <div class="plane-loading" :class="{ compact }" role="status">
    <span class="flight-loader" aria-hidden="true">
      <span class="flight-track"></span>
      <span class="flight-orbit">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" /></svg>
      </span>
    </span>
    <p class="loader-label">{{ label }}</p>
  </div>
</template>

<style scoped>
.plane-loading { display: grid; place-items: center; align-content: center; gap: .75rem; min-height: 14rem; text-align: center; }
.loader-label { margin: 0; color: var(--plane-loader-label-color, var(--travel-muted)); font-size: .9rem; line-height: 1.5; }
.flight-loader { position: relative; display: block; flex-shrink: 0; width: 72px; height: 72px; color: var(--plane-loader-color, var(--travel-accent)); }
.flight-track { position: absolute; inset: 12px; border: 1px dashed currentColor; border-radius: 50%; opacity: .35; }
.flight-orbit { position: absolute; inset: 0; }
.flight-orbit svg { position: absolute; top: 2px; left: calc(50% - 10px); transform: rotate(90deg); }
.compact { display: flex; align-items: center; justify-content: flex-start; gap: .5rem; min-height: 0; text-align: start; }
.compact .flight-loader { width: 32px; height: 32px; }
.compact .flight-track { inset: 6px; }
.compact .flight-orbit svg { width: 14px; height: 14px; top: -1px; left: calc(50% - 7px); }
.compact .loader-label { font-size: .85rem; }
@media (prefers-reduced-motion: no-preference) { .flight-orbit { animation: flight-circle 2s linear infinite; } }
@keyframes flight-circle { to { transform: rotate(360deg); } }
</style>
