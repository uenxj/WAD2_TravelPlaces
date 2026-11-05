<script setup>
import { nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { previewMode, setPreviewMode } from './services/preview.js'
import AppHeader from './components/AppHeader.vue'
import './styles/app.css'
const router = useRouter()
async function focusPage() {
  await nextTick()
  const target = document.querySelector('#page-content h1') || document.getElementById('page-content')
  target?.setAttribute('tabindex', '-1')
  target?.focus({ preventScroll: true })
}
function exitPreview() {
  setPreviewMode(false)
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'home-shell': $route.path === '/', 'discover-shell': $route.path === '/discover' }">
    <div v-if="previewMode" class="preview-banner" role="status">
      <span><strong>Preview mode</strong> · Sample trips · Budget edits are saved for each preview trip.</span>
      <button type="button" @click="exitPreview">Exit preview</button>
    </div>
    <a href="#page-content" class="skip-link">Skip to content</a>
    <AppHeader />
    <div id="page-content" class="app-content" tabindex="-1">
      <RouterView v-slot="{ Component }"><component :is="Component" @vue:mounted="focusPage" /></RouterView>
    </div>
  </div>
</template>

<style scoped>
.preview-banner {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: .5rem 1.5rem;
  padding: .65rem 5%;
  background: #274840;
  color: #fff;
  font-size: .85rem;
}

.preview-banner button {
  border: 1px solid #b9ddd2;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  padding: .3rem .8rem;
}

.home-shell > .app-content, .discover-shell > .app-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.home-shell {
  display: flex;
  flex-direction: column;
}

.discover-shell {
  height: 100svh;
  display: flex;
  flex-direction: column;
}
</style>
