/**
 * GIS 旅行日记存储管理器
 * 负责 JSON 数据的导出、导入和验证
 */

const STORAGE_VERSION = '2.0.0'

/**
 * 导出当前数据为 JSON 格式
 * @param {Array} recordPoints - 记录点数组
 * @param {Array} routes - 路线数组
 * @param {Object} options - 导出选项
 * @returns {Object} JSON 数据对象
 */
export function exportToJson(recordPoints, routes, options = {}) {
  const {
    title = '旅行日记数据',
    description = '',
    includeImages = true
  } = options

  // 处理记录点（移除 Feature 等非序列化数据）
  const processedPoints = recordPoints.map(point => ({
    id: point.id,
    lon: point.lon,
    lat: point.lat,
    title: point.title || '',
    description: point.description || '',
    images: includeImages ? (point.images || []) : [],
    time: point.time || new Date().toLocaleString('zh-CN')
  }))

  // 处理路线数据
  const processedRoutes = routes.map(route => {
    // 处理转折点
    const processedRoutePoints = route.points ? route.points.map(p => ({
      id: p.id,
      lon: p.lon,
      lat: p.lat,
      title: p.title || '',
      description: p.description || '',
      images: includeImages ? (p.images || []) : []
    })) : []

    return {
      id: route.id,
      name: route.name || route.title || '',
      title: route.title || route.name || '',
      description: route.description || '',
      images: includeImages ? (route.images || []) : [],
      length: route.length || '',
      points: processedRoutePoints,
      time: route.time || new Date().toLocaleString('zh-CN')
    }
  })

  return {
    version: STORAGE_VERSION,
    format: 'gis-travel-diary',
    title,
    description,
    exportedAt: new Date().toISOString(),
    statistics: {
      totalPoints: processedPoints.length,
      totalRoutes: processedRoutes.length,
      totalImages: processedPoints.reduce((sum, p) => sum + p.images.length, 0) +
                   processedRoutes.reduce((sum, r) => sum + r.images.length, 0)
    },
    data: {
      points: processedPoints,
      routes: processedRoutes
    }
  }
}

/**
 * 从 JSON 导入数据
 * @param {Object|string} jsonData - JSON 对象或 JSON 字符串
 * @returns {Object} 导入的数据 { points: [], routes: [] }
 * @throws {Error} 数据格式错误时抛出异常
 */
export function importFromJson(jsonData) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData

  // 验证数据格式
  validateJsonData(data)

  const result = {
    points: [],
    routes: []
  }

  // 导入记录点
  if (data.data && data.data.points) {
    result.points = data.data.points.map(point => ({
      id: point.id,
      lon: point.lon,
      lat: point.lat,
      title: point.title || '',
      description: point.description || '',
      images: point.images || [],
      time: point.time || new Date().toLocaleString('zh-CN')
    }))
  }

  // 导入路线
  if (data.data && data.data.routes) {
    result.routes = data.data.routes.map(route => {
      const routeObj = {
        id: route.id || Date.now(),
        name: route.name || route.title || '',
        title: route.title || route.name || '',
        description: route.description || '',
        images: route.images || [],
        length: route.length || '',
        points: [],
        time: route.time || new Date().toLocaleString('zh-CN'),
        feature: null  // 将由 gis.vue 创建
      }

      // 处理转折点
      if (route.points) {
        routeObj.points = route.points.map(p => ({
          id: p.id,
          lon: p.lon,
          lat: p.lat,
          title: p.title || '',
          description: p.description || '',
          images: p.images || []
        }))
      }

      return routeObj
    })
  }

  return result
}

/**
 * 验证 JSON 数据格式
 * @param {Object} data - JSON 数据对象
 * @throws {Error} 验证失败时抛出异常
 */
function validateJsonData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的 JSON 数据')
  }

  // 检查格式标识
  if (data.format !== 'gis-travel-diary') {
    console.warn('警告: 数据格式可能不匹配，期望格式: gis-travel-diary')
  }

  // 检查版本
  if (data.version) {
    const [major] = data.version.split('.')
    const [currentMajor] = STORAGE_VERSION.split('.')
    if (major !== currentMajor) {
      console.warn(`警告: 数据版本 ${data.version} 与当前版本 ${STORAGE_VERSION} 可能不兼容`)
    }
  }

  // 验证数据结构
  if (!data.data || typeof data.data !== 'object') {
    throw new Error('缺少 data 字段或格式错误')
  }

  if (data.data.points && !Array.isArray(data.data.points)) {
    throw new Error('points 必须是数组')
  }

  if (data.data.routes && !Array.isArray(data.data.routes)) {
    throw new Error('routes 必须是数组')
  }

  // 验证点数据结构
  if (data.data.points) {
    data.data.points.forEach((point, index) => {
      if (!point.id) throw new Error(`点 ${index + 1} 缺少 id`)
      if (typeof point.lon !== 'number') throw new Error(`点 ${index + 1} 缺少有效的经度`)
      if (typeof point.lat !== 'number') throw new Error(`点 ${index + 1} 缺少有效的纬度`)
    })
  }

  // 验证路线数据结构
  if (data.data.routes) {
    data.data.routes.forEach((route, index) => {
      if (!route.id) throw new Error(`路线 ${index + 1} 缺少 id`)
      if (!route.points || !Array.isArray(route.points)) {
        throw new Error(`路线 ${index + 1} 的 points 必须是数组`)
      }
      if (route.points.length < 2) {
        throw new Error(`路线 ${index + 1} 至少需要2个点`)
      }
    })
  }
}

/**
 * 下载 JSON 文件
 * @param {Object} jsonData - JSON 数据对象
 * @param {string} filename - 文件名
 */
export function downloadJsonFile(jsonData, filename = 'travel-diary.json') {
  const jsonString = JSON.stringify(jsonData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 读取 JSON 文件
 * @param {File} file - 文件对象
 * @returns {Promise<Object>} JSON 数据对象
 */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result)
        resolve(jsonData)
      } catch (error) {
        reject(new Error('JSON 文件解析失败: ' + error.message))
      }
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsText(file)
  })
}


/**
 * 获取示例预设数据（异步版本）
 * 从 public/map/huang.json 文件中读取
 * @returns {Promise<Object>} 预设 JSON 数据
 */
export async function getPresetData() {
  try {
    const response = await fetch('/map/huang.json')
    if (!response.ok) {
      throw new Error('加载预设数据失败')
    }
    return await response.json()
  } catch (error) {
    console.error('加载预设数据失败:', error)
    // 返回空数据结构作为后备
    return {
      version: "2.0.0",
      format: "gis-travel-diary",
      title: "空预设",
      description: "无法加载预设文件",
      exportedAt: new Date().toISOString(),
      statistics: {
        totalPoints: 0,
        totalRoutes: 0,
        totalImages: 0
      },
      data: {
        points: [],
        routes: []
      }
    }
  }
}

/**
 * 合并导入数据到现有数据
 * @param {Array} existingPoints - 现有记录点
 * @param {Array} existingRoutes - 现有路线
 * @param {Object} importedData - 导入的数据
 * @param {Object} options - 合并选项
 * @returns {Object} 合并后的数据
 */
export function mergeData(existingPoints, existingRoutes, importedData, options = {}) {
  const {
    overwrite = false,
    generateNewIds = true
  } = options

  const result = {
    points: [...existingPoints],
    routes: [...existingRoutes]
  }

  // 合并记录点
  if (importedData.points) {
    importedData.points.forEach(point => {
      const existingIndex = result.points.findIndex(p => p.id === point.id)

      if (existingIndex >= 0) {
        if (overwrite) {
          result.points[existingIndex] = generateNewIds
            ? { ...point, id: Date.now() + Math.random() }
            : point
        }
      } else {
        result.points.push(generateNewIds
          ? { ...point, id: Date.now() + Math.random() }
          : point
        )
      }
    })
  }

  // 合并路线
  if (importedData.routes) {
    importedData.routes.forEach(route => {
      const existingIndex = result.routes.findIndex(r => r.id === route.id)

      if (existingIndex >= 0) {
        if (overwrite) {
          const newRoute = generateNewIds
            ? { ...route, id: Date.now() + Math.random(), feature: null }
            : { ...route, feature: null }
          result.routes[existingIndex] = newRoute
        }
      } else {
        result.routes.push(generateNewIds
          ? { ...route, id: Date.now() + Math.random(), feature: null }
          : { ...route, feature: null }
        )
      }
    })
  }

  return result
}
