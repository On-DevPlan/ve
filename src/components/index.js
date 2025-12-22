// 组件预构建映射
// 这个文件确保所有组件在构建时被正确识别

// 预导入所有组件
export { default as Barrage3D } from './Barrage3D/index.vue'
export { default as HelloWorld } from './HelloWorld/index.vue'

// 组件映射对象
export const componentMap = {
  Barrage3D: () => import('./Barrage3D/index.vue'),
  HelloWorld: () => import('./HelloWorld/index.vue')
}

// 获取组件的函数
export function getComponent(name) {
  return componentMap[name] || null
}

// 获取所有组件列表
export function getAllComponents() {
  return Object.keys(componentMap)
}