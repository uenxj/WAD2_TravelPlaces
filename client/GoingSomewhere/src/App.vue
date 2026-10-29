<script setup>
import { useRouter } from 'vue-router'
import { previewMode, setPreviewMode } from './services/preview.js'
import AppHeader from './components/AppHeader.vue'
import './styles/app.css'
const router = useRouter()
function exitPreview() {
  setPreviewMode(false)
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'home-shell': $route.path === '/' }">
    <div v-if="previewMode" class="preview-banner" role="status">
      <span><strong>Preview mode</strong> · Sample trips · Budget edits are saved for each preview trip.</span>
      <button type="button" @click="exitPreview">Exit preview</button>
    </div>
    <AppHeader />
    <RouterView />
  </div>
</template>

<style scoped>
.preview-banner { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: .5rem 1.5rem; padding: .65rem 5%; background: #274840; color: #fff; font-size: .85rem; }
.preview-banner button { border: 1px solid #b9ddd2; border-radius: 999px; background: transparent; color: #fff; padding: .3rem .8rem; }
.home-shell { display: flex; flex-direction: column; }
</style>
