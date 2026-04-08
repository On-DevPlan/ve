import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router, { setupComponentRoutes } from './router'

const app = createApp(App)

// 注册全局属性
app.config.globalProperties.$DEV_MODE = import.meta.env.DEV

// 使用路由
app.use(router)

// 在挂载前完成组件路由初始化，确保直接访问分享链接时路由已就绪
setupComponentRoutes().then(() => {
  app.mount('#app')
}).catch(err => {
  console.error('Failed to setup component routes:', err)
  app.mount('#app')
})
