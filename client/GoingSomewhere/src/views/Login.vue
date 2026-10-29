<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setPreviewMode } from '../services/preview.js'
import { safeReturnPath } from '../services/auth.js'
const route = useRoute()
const router = useRouter()
function preview() {
  password.value = ''
  setPreviewMode(true)
  const target = safeReturnPath(route.query.redirect)
  router.push(target.startsWith('/budget') ? '/trips' : target)
}
const mode = ref('login')
const email = ref('')
const password = ref('')
const name = ref('')
const submitted = ref(false)
const showPassword = ref(false)
const pendingDestination = computed(() => new URLSearchParams(safeReturnPath(route.query.redirect).split('?')[1] ?? '').get('destination'))
const backPath = computed(() => safeReturnPath(route.query.from, '/discover'))
const purpose = computed(() => route.query.intent === 'save' ? 'Log in to save this place to your account.' : route.query.redirect ? 'Log in or create an account to save and plan your trip.' : 'Bring your travel plans together.')
function submit() {
  // Replace with your authentication provider. No passwords are stored or sent by this UI.
  submitted.value = true
  password.value = ''
}
</script>

<template>
  <main class="content-page auth-layout">
    <section class="auth-intro">
      <p class="eyebrow">Your next adventure starts here</p>
      <h1 class="page-heading">A little less planning.<br>A lot more exploring.</h1>
      <p class="muted-copy">Keep your itinerary, budget and travel group together in one place.</p>
      <RouterLink :to="backPath" class="back-link">← Continue exploring</RouterLink>
    </section>
    <section class="surface auth-card" aria-labelledby="auth-title">
      <div class="auth-switch" aria-label="Account options">
        <button type="button" :aria-pressed="mode === 'login'" @click="mode = 'login'; submitted = false">Log in</button>
        <button type="button" :aria-pressed="mode === 'signup'" @click="mode = 'signup'; submitted = false">Create account</button>
      </div>
      <h2 id="auth-title">{{ mode === 'login' ? 'Welcome back' : 'Start your next adventure' }}</h2>
      <p class="muted-copy">{{ purpose }}</p>
      <p v-if="pendingDestination" class="destination-context">Selected destination: <strong>{{ pendingDestination }}</strong></p>
      <p class="ui-notice">Account access is coming soon. This is a preview of the {{ mode === 'login' ? 'login' : 'sign-up' }} form; it does not create an account or sign you in.</p>
      <form class="form-stack" @submit.prevent="submit">
        <label v-if="mode === 'signup'" for="account-name">Name<input id="account-name" v-model="name" autocomplete="name" required maxlength="100" /></label>
        <label for="account-email">Email<input id="account-email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
        <div class="password-group">
          <label for="account-password">Password</label>
          <span class="password-field">
            <input id="account-password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" :minlength="mode === 'signup' ? 8 : 1" required />
            <button type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
          </span>
        </div>
        <button class="primary-action" type="submit">{{ mode === 'login' ? 'Log in' : 'Create account' }}</button>
        <p v-if="submitted" role="status" class="ui-notice">Authentication is not connected yet. Your password has been cleared. You can continue exploring without an account.</p>
      </form>
      <div class="preview-entry">
        <button type="button" class="secondary-action" @click="preview">Preview signed-in experience</button>
        <p class="muted-copy small mt-2 mb-0">Explore with sample data. No account or password needed.</p>
      </div>
      <p v-if="route.query.redirect" class="muted-copy small mt-3 mb-0">Your destination will be kept in this link so you can continue after login is connected.</p>
    </section>
  </main>
</template>

<style scoped>
.auth-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; min-height: calc(100svh - 110px); }
.auth-intro .muted-copy { max-width: 27rem; margin: 1.5rem 0; }
.back-link { color: var(--travel-accent); text-underline-offset: 4px; }
.auth-card { max-width: 480px; width: 100%; justify-self: end; }
.auth-card h2 { font-size: 1.8rem; font-weight: 700; margin: 1.5rem 0 .75rem; }
.auth-switch { display: flex; gap: .25rem; padding: .3rem; border-radius: 999px; background: var(--travel-bg); }
.auth-switch button { flex: 1; border: 0; padding: .7rem; border-radius: 999px; color: var(--travel-muted); background: transparent; }
.auth-switch button[aria-pressed="true"] { background: #354d51; color: #fff; }
.password-field { display: flex; align-items: center; gap: .6rem; }
.preview-entry { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--travel-border); }
.preview-entry button { width: 100%; }
.password-group { display: grid; gap: .5rem; }
.password-field button { background: none; border: 0; color: var(--travel-accent); padding: .5rem; }
@media (max-width: 800px) { .auth-layout { grid-template-columns: 1fr; gap: 2rem; min-height: auto; } .auth-card { max-width: none; } }
</style>
