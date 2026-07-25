import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores/index.ts'
import vuetify from '../Vuetify.config.ts'
import './style.css'
import '@mdi/font/css/materialdesignicons.css'
import { iraqiPhoneDirective } from './directives/iraqiPhone'
//import '../vuetify-fixes.css' 


createApp(App)
  .directive('iraqi-phone', iraqiPhoneDirective)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .mount('#app')
