import { createRouter, createWebHistory } from 'vue-router'
import { previewMode } from '../src/services/preview.js'
import { user, loginLink, safeReturnPath } from '../src/services/auth.js'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) { return savedPosition ?? { top: 0 } },
  routes: [
    { path: '/', component: () => import('../src/views/Home.vue') },
    { path: '/play', component: () => import('../src/views/Play.vue') },
    { path: '/explore/:country', component: () => import('../src/views/Explore.vue') },
    { path: '/discover', component: () => import('../src/views/Discover.vue') },
    { path: '/quiz', component: () => import('../src/views/Quiz.vue') },
    { path: '/weather', component: () => import('../src/views/Weather.vue') },
    { path: '/login', component: () => import('../src/views/Login.vue') },
    // ?currency=EUR (from the trip page) suggests the destination's currency; otherwise Budget.vue's default.
    { path: '/budget', component: () => import('../src/views/Budget.vue'), meta: { requiresAuth: true, liveSessionOnly: true },
      props: route => (/^[A-Z]{3}$/.test(route.query.currency) ? { destinationCurrency: route.query.currency } : {}) },
    { path: '/checklist', component: () => import('../src/views/Checklist.vue') },
    { path: '/trips/preview/:id', component: () => import('../src/views/AccountPage.vue'), meta: { requiresAuth: true } },
    // Real trips and itineraries (signed in). Without a login, /trips and /trips/new keep showing the preview pages.
    { path: '/trips', component: () => import('../src/views/Trips.vue'), meta: { requiresAuth: true } },
    { path: '/trips/new', component: () => import('../src/views/NewTrip.vue'), meta: { requiresAuth: true } },
    { path: '/trips/:tripId', component: () => import('../src/views/Itinerary.vue'), props: true, meta: { requiresAuth: true, liveSessionOnly: true } },
    ...['/profile', '/saved'].map(path => ({
      path, component: () => import('../src/views/AccountPage.vue'), meta: { requiresAuth: true },
    })),
    { path: '/:pathMatch(.*)*', redirect: '/discover' },
  ],
})

router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !user.value && !(previewMode.value && !to.meta.liveSessionOnly)) {
    const source = safeReturnPath(to.query.from, from.path && from.path !== '/login' ? from.fullPath : '/discover')
    return loginLink(to.fullPath, source, to.path === '/saved' ? 'save' : undefined)
  }
})

export default router
