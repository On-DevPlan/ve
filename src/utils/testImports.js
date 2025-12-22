// 测试动态导入功能
import { getDynamicComponentLoader } from './dynamicImports.js'

export async function testComponentImports() {
  const testNames = ['Barrage3D', 'HelloWorld']

  console.log('Testing dynamic component imports...')

  for (const name of testNames) {
    try {
      const loader = getDynamicComponentLoader(name)
      if (loader) {
        console.log(`✓ Loader found for ${name}`)
        // 不实际加载，只验证loader存在
      } else {
        console.log(`✗ No loader found for ${name}`)
      }
    } catch (error) {
      console.error(`✗ Error testing ${name}:`, error)
    }
  }
}