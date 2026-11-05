<script setup>
defineProps({ to: { type: [String, Object], required: true } })
</script>

<template>
  <RouterLink :to="to" class="secondary-action app-back-link">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" /></svg>
    <slot />
  </RouterLink>
</template>

<style scoped>
.app-back-link { width: fit-content; margin-bottom: 1.5rem; padding: .55rem 1rem .55rem .85rem; font-size: .85rem; color: var(--travel-accent); }
</style>
