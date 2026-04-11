import { createRouter, createWebHistory } from 'vue-router'
import { componentDiscovery } from '../utils/componentDiscovery'

// 首页组件
const Home = () => import('../views/Home.vue')
const ComponentView = () => import('../views/ComponentView.vue')
const SandboxView = () => import('../views/SandboxView.vue')

// 创建路由
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      meta: {
        title: '组件演示中心'
      }
    },
    {
      path: '/component/:id',
      name: 'Component',
      component: ComponentView,
      props: true,
      meta: {
        title: '组件详情'
      }
    },
    {
      path: '/components/:id',
      name: 'ComponentPage',
      component: ComponentView,
      props: true,
      meta: {
        title: '组件详情'
      }
    },
    // Sandbox 路由：直接静态 import 组件，绕过 componentDiscovery，启用原生 HMR
    {
      path: '/sandbox/:name',
      name: 'Sandbox',
      component: SandboxView,
      props: true,
      meta: {
        title: 'Sandbox'
      }
    },
    // 404页面
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('../views/NotFound.vue'),
      meta: {
        title: '页面未找到'
      }
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 动态添加组件路由
export async function setupComponentRoutes() {
  await componentDiscovery.scanComponents()

  // 清理旧的组件路由
  const existingRoutes = router.getRoutes().filter(route =>
    route.name?.startsWith('Component-')
  )
  existingRoutes.forEach(route => {
    if (route.name !== 'Component') {
      router.removeRoute(route.name)
    }
  })

  // 添加新的组件路由
  componentDiscovery.components.value.forEach(component => {
    if (component.route) {
      const routeConfig = component.route

      // 动态路由配置
      const route = {
        path: routeConfig.path || `/components/${component.id}`,
        name: `Component-${component.id}`,
        component: ComponentView,
        props: { componentId: component.id },
        meta: {
          title: routeConfig.meta?.title || component.title,
          icon: routeConfig.meta?.icon || '📦',
          group: component.group,
          category: component.category,
          tags: component.tags,
          description: component.description,
          version: component.version,
          keepAlive: routeConfig.meta?.keepAlive || false,
          ...routeConfig.meta
        }
      }

      router.addRoute(route)
    }
  })
}

// 路由守卫 - 更新页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 组件演示中心`
  }
  next()
})

export default router