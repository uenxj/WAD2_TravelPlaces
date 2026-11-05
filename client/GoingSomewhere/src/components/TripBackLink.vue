<script setup>
import { computed } from 'vue'
import BackLink from './BackLink.vue'
const props = defineProps({ tripId: { type: String, default: '' } })
const target = computed(() => {
  if (!props.tripId || props.tripId === 'demo-trip') return '/trips'
  if (props.tripId.startsWith('preview-')) return `/trips/preview/${encodeURIComponent(props.tripId.slice(8))}`
  return `/trips/${encodeURIComponent(props.tripId)}`
})
</script>

<template>
  <BackLink :to="target" data-testid="back-to-trip">
    {{ target === '/trips' ? 'Back to My Trips' : 'Back to Itinerary' }}
  </BackLink>
</template>
