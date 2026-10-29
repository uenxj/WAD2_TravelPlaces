<script setup>
import { previewMode } from '../services/preview.js'
import { user } from '../services/auth.js'
</script>

<template>
  <header class="app-header">
    <RouterLink class="app-brand" to="/" aria-label="GoingSomewhere home"><span aria-hidden="true">✈</span> GoingSomewhere</RouterLink>
    <nav class="app-links" aria-label="Main navigation">
      <RouterLink to="/discover">Discover</RouterLink>
      <template v-if="user || previewMode">
        <RouterLink to="/trips">My Trips</RouterLink>
        <RouterLink class="primary-action" to="/trips/new">+ New trip</RouterLink>
        <RouterLink to="/profile">Profile</RouterLink>
      </template>
      <RouterLink v-else class="primary-action" :to="{ path: '/login', query: { from: $route.fullPath } }">Log in</RouterLink>
    </nav>
  </header>
</template>
