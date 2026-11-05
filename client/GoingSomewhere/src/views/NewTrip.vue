<script setup>
// /trips/new. Signed in: create a real trip. Not signed in (the sign-in-free preview): the page AccountPage shows.
import { defineAsyncComponent } from 'vue'
import { user } from '../services/auth.js'
import NewTripForm from '../components/itinerary/NewTripForm.vue'

const SamplePage = defineAsyncComponent(() => import('./AccountPage.vue'))
</script>

<template>
  <NewTripForm v-if="user" />
  <SamplePage v-else />
</template>
