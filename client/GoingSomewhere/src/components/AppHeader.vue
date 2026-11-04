<script setup>
import { useRouter } from 'vue-router'
import { previewMode } from '../services/preview.js'
import { user, logout } from '../services/auth.js'
const router = useRouter()
async function signOut() {
  await logout()
  router.push('/discover')
}
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
        <button v-if="user" type="button" class="app-logout" @click="signOut">Log out</button>
      </template>
      <RouterLink v-else class="primary-action" :to="{ path: '/login', query: { from: $route.fullPath } }">Log in</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-logout { background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; }
.app-logout:hover { text-decoration: underline; }
</style>
