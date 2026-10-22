import { createRouter, createWebHistory } from 'vue-router'
import Home from '/src/views/Home.vue'
import Play from '/src/views/Play.vue'
import Explore from '/src/views/Explore.vue'
import Budget from '/src/views/Budget.vue'
import Discover from '/src/views/Discover.vue'


export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/play', component: Play },
    { path: '/explore/:country', component: Explore },
    { path: '/budget', component: Budget },
    { path: '/Discover', component: Discover, meta: { fullscreen: true } }
  ],
})
