<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <button type="button" class="trash-button" :aria-label="label" :title="label">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
  </button>
</template>

<style scoped>
.trash-button { display: inline-grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; padding: 0; border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--travel-muted); cursor: pointer; }
.trash-button:disabled { opacity: .6; cursor: not-allowed; }
@media (hover: hover) { .trash-button:not(:disabled):hover { background: var(--travel-selected); color: var(--travel-accent); } }
@media (prefers-reduced-motion: no-preference) { .trash-button:not(:disabled) { transition: transform 150ms ease-out; } .trash-button:not(:disabled):active { transform: scale(.96); } }
</style>
