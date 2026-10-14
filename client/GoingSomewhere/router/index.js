import { createRouter, createWebHistory } from 'vue-router'
import Home from '/Users/AZVRE/Downloads/WAD2_TravelPlaces-main/client/GoingSomewhere/src/views/Home.vue'
import Play from '/Users/AZVRE/Downloads/WAD2_TravelPlaces-main/client/GoingSomewhere/src/views/Play.vue'
import Explore from '/Users/AZVRE/Downloads/WAD2_TravelPlaces-main/client/GoingSomewhere/src/views/Explore.vue'
import Budget from '/Users/AZVRE/Downloads/WAD2_TravelPlaces-main/client/GoingSomewhere/src/views/Budget.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/play', component: Play },
    { path: '/explore/:country', component: Explore },
    { path: '/budget', component: Budget },
  ],
})