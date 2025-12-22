import { ref } from 'vue'

/**
 * 组件自动发现系统
 * 扫描components目录下的所有component.js文件
 */
export class ComponentDiscovery {
  constructor() {
    this.components = ref([])
    this.groups = ref({})
    this.loading = ref(false)
  }

  /**
   * 扫描组件目录
   * 注意：在Vite环境下，我们可以使用glob导入
   */
  async scanComponents() {
    this.loading.value = true

    try {
      // 使用Vite的glob功能扫描所有component.js文件
      const componentModules = import.meta.glob('../components/**/component.js')
      const components = []

      for (const [path, moduleLoader] of Object.entries(componentModules)) {
        try {
          const module = await moduleLoader()
          const componentConfig = module.default

          // 解析路径信息
          const pathParts = path.split('/')
          const componentName = pathParts[pathParts.length - 2] // 获取组件目录名

          // 验证配置
          if (this.validateConfig(componentConfig)) {
            // 创建组件对象
            const component = {
              ...componentConfig,
              id: componentName,
              path: path.replace('/component.js', ''),
              loader: async () => {
                // 动态导入实际的Vue组件
                const componentPath = path.replace('/component.js', '/' + componentConfig.component)
                return import(/* @vite-ignore */ componentPath)
              }
            }

            components.push(component)
            this.addToGroup(component)
          }
        } catch (error) {
          console.warn(`Failed to load component config from ${path}:`, error)
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
           config.component &&
           typeof config.loader !== 'function'
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
    // 可以根据标签、访问量等推荐
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