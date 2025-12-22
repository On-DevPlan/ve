// 预定义所有可能的组件导入
// 这样Vite在构建时就知道所有需要打包的组件

export const dynamicComponents = {
  // 预导入所有组件，确保它们被Vite识别
  Barrage3D: () => import('../components/Barrage3D/index.vue'),
  HelloWorld: () => import('../components/HelloWorld/index.vue')
}

// 获取组件加载器
export function getDynamicComponentLoader(name) {
  return dynamicComponents[name] || null
}

// 检查组件是否存在
export function hasComponent(name) {
  return name in dynamicComponents
}