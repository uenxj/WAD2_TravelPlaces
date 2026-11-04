import { createApp } from 'vue'
import App from './App.vue'
import router from '../router/index.js'
import { initAuth } from './services/auth.js'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'

// Restore the session first, so the router's login guard already knows who is signed in.
initAuth().finally(() => {
  createApp(App).use(router).mount('#app')
})
