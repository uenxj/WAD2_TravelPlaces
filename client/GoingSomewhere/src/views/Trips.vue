<script setup>
// /trips. Signed in: the real trips from the itinerary service. Not signed in (the sign-in-free preview):
// the sample trips that AccountPage shows.
import { defineAsyncComponent } from 'vue'
import { user } from '../services/auth.js'
import TripList from '../components/itinerary/TripList.vue'

const SampleTrips = defineAsyncComponent(() => import('./AccountPage.vue'))
</script>

<template>
  <TripList v-if="user" />
  <SampleTrips v-else />
</template>
