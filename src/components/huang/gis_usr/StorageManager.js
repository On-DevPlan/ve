/**
 * GIS 旅行日记 - 存储管理器
 */

// 预设数据 URL
const PRESET_DATA_URL = '/map/huang.json'

/**
 * 获取预设数据
 */
export async function getPresetData() {
  try {
    const response = await fetch(PRESET_DATA_URL)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('加载预设数据失败:', error)
    throw error
  }
}

/**
 * 从 JSON 数据导入
 */
export function importFromJson(data) {
  const imported = {
    points: [],
    routes: []
  }

  // 检查数据格式
  if (data.format === 'gis-travel-diary' && data.data) {
    // 新格式
    imported.points = data.data.points || []
    imported.routes = data.data.routes || []
  } else if (data.points && data.routes) {
    // 兼容旧格式
    imported.points = data.points
    imported.routes = data.routes
  }

  return imported
}

/**
 * 导出到 JSON 数据
 */
export function exportToJson(points, routes) {
  return {
    version: '2.0.0',
    format: 'gis-travel-diary',
    title: '我的旅行日记',
    data: {
      points: points,
      routes: routes
    }
  }
}

/**
 * 保存到本地存储
 */
export function saveToLocal(points, routes) {
  try {
    const data = exportToJson(points, routes)
    localStorage.setItem('gis-travel-diary', JSON.stringify(data))
    return true
  } catch (error) {
    console.error('保存到本地存储失败:', error)
    return false
  }
}

/**
 * 从本地存储加载
 */
export function loadFromLocal() {
  try {
    const data = localStorage.getItem('gis-travel-diary')
    if (data) {
      const parsed = JSON.parse(data)
      return importFromJson(parsed)
    }
    return null
  } catch (error) {
    console.error('从本地存储加载失败:', error)
    return null
  }
}

/**
 * 清除本地存储
 */
export function clearLocal() {
  localStorage.removeItem('gis-travel-diary')
}
