import { ref } from 'vue'

/**
 * 组件自动发现系统
 * 扫描components目录下的所有component.js文件
 * 完全自动发现，无需手动配置
 */
export class ComponentDiscovery {
  constructor() {
    this.components = ref([])
    this.groups = ref({})
    this.loading = ref(false)

    // 使用 Vite 的 glob 功能预先扫描所有 index.vue 文件
    // 这样 Vite 在构建时就知道所有需要打包的组件
    this.componentModules = import.meta.glob('../components/**/index.vue')
  }

  /**
   * 扫描组件目录
   */
  async scanComponents() {
    this.loading.value = true

    try {
      // 扫描所有 component.js 配置文件
      const componentConfigs = import.meta.glob('../components/**/component.js')
      const components = []

      for (const [configPath, configLoader] of Object.entries(componentConfigs)) {
        try {
          const module = await configLoader()
          const componentConfig = module.default

          // 解析组件名称
          const pathParts = configPath.split('/')
          const componentName = pathParts[pathParts.length - 2]

          // 验证配置
          if (this.validateConfig(componentConfig)) {
            // 构建组件的 index.vue 路径
            const componentModulePath = configPath.replace('/component.js', '/index.vue')

            // 创建组件对象
            const component = {
              ...componentConfig,
              id: componentName,
              path: configPath.replace('/component.js', ''),
              componentModulePath,

              // 动态加载器 - 完全自动，无需手动配置
              loader: async () => {
                if (this.componentModules[componentModulePath]) {
                  return await this.componentModules[componentModulePath]()
                }
                throw new Error(`Component module not found: ${componentModulePath}`)
              }
            }

            components.push(component)
            this.addToGroup(component)

            console.log(`✓ Auto-discovered component: ${componentName}`)
          }
        } catch (error) {
          console.warn(`Failed to load component config from ${configPath}:`, error)
        }
      }

      // 按分组排序
      components.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group)
        }
        return a.title.localeCompare(b.title)
      })

      this.components.value = components
      console.log(`Auto-discovered ${components.length} components`)
    } catch (error) {
      console.error('Error scanning components:', error)
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 验证组件配置
   */
  validateConfig(config) {
    return config &&
           config.name &&
           config.title &&
           config.component
  }

  /**
   * 添加到分组
   */
  addToGroup(component) {
    const group = component.group || 'Default'

    if (!this.groups.value[group]) {
      this.groups.value[group] = {
        name: group,
        components: [],
        categories: {}
      }
    }

    this.groups.value[group].components.push(component)

    // 按类别组织
    const category = component.category || 'General'
    if (!this.groups.value[group].categories[category]) {
      this.groups.value[group].categories[category] = []
    }
    this.groups.value[group].categories[category].push(component)
  }

  /**
   * 根据ID获取组件
   */
  getComponent(id) {
    return this.components.value.find(comp => comp.id === id)
  }

  /**
   * 搜索组件
   */
  searchComponents(query) {
    const searchTerm = query.toLowerCase()
    return this.components.value.filter(comp =>
      comp.title.toLowerCase().includes(searchTerm) ||
      comp.description.toLowerCase().includes(searchTerm) ||
      comp.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }

  /**
   * 获取推荐组件
   */
  getFeaturedComponents() {
    return this.components.value.filter(comp =>
      comp.tags.includes('featured') ||
      comp.tags.includes('popular')
    )
  }
}

// 创建单例
export const componentDiscovery = new ComponentDiscovery()

/**
 * 提供给组合式API使用的hook
 */
export function useComponentDiscovery() {
  return {
    components: componentDiscovery.components,
    groups: componentDiscovery.groups,
    loading: componentDiscovery.loading,
    scanComponents: () => componentDiscovery.scanComponents(),
    getComponent: (id) => componentDiscovery.getComponent(id),
    searchComponents: (query) => componentDiscovery.searchComponents(query),
    getFeaturedComponents: () => componentDiscovery.getFeaturedComponents()
  }
}