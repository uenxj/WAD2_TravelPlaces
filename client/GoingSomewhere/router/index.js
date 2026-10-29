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
    { path: '/login', component: () => import('../src/views/Login.vue') },
    { path: '/budget', component: () => import('../src/views/Budget.vue'), meta: { requiresAuth: true, liveSessionOnly: true } },
    { path: '/trips/preview/:id', component: () => import('../src/views/AccountPage.vue'), meta: { requiresAuth: true } },
    ...['/trips', '/trips/new', '/profile', '/saved'].map(path => ({
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
