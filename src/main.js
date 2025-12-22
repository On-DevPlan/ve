import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// 注册全局属性
app.config.globalProperties.$DEV_MODE = import.meta.env.DEV

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')
