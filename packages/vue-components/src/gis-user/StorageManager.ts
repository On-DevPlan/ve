// gis-user 组件的存储管理器 —— 简化版,只负责读取预设数据与 JSON 解析。
// 复刻自 ve 仓库 huang/gis_usr/StorageManager.js。

const PRESET_DATA_URL = '/map/huang.json';

export async function getPresetData(): Promise<unknown> {
  try {
    const response = await fetch(PRESET_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('加载预设数据失败:', error);
    throw error;
  }
}

export function importFromJson(data: unknown): {
  points: unknown[];
  routes: unknown[];
} {
  const imported = { points: [], routes: [] };
  if (!data || typeof data !== 'object') return imported;
  const obj = data as {
    format?: string;
    data?: { points?: unknown[]; routes?: unknown[] };
    points?: unknown[];
    routes?: unknown[];
  };
  if (obj.format === 'gis-travel-diary' && obj.data) {
    imported.points = obj.data.points || [];
    imported.routes = obj.data.routes || [];
  } else if (obj.points && obj.routes) {
    imported.points = obj.points;
    imported.routes = obj.routes;
  }
  return imported;
}

export function exportToJson(points: unknown[], routes: unknown[]): unknown {
  return {
    version: '2.0.0',
    format: 'gis-travel-diary',
    title: '我的旅行日记',
    data: { points, routes },
  };
}

export function saveToLocal(points: unknown[], routes: unknown[]): boolean {
  try {
    const data = exportToJson(points, routes);
    localStorage.setItem('gis-travel-diary', JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('保存到本地存储失败:', error);
    return false;
  }
}

export function loadFromLocal(): { points: unknown[]; routes: unknown[] } | null {
  try {
    const data = localStorage.getItem('gis-travel-diary');
    if (data) {
      return importFromJson(JSON.parse(data));
    }
    return null;
  } catch (error) {
    console.error('从本地存储加载失败:', error);
    return null;
  }
}

export function clearLocal(): void {
  localStorage.removeItem('gis-travel-diary');
}
