// data.ts —— 静态数据(城市坐标、飞线、热力、省份 ID 映射、SVG 路径、模式列表)。
// 把数据从 <script setup> 抽出,让 SFC 只关注渲染与生命周期,文件保持 < 300 行。
//
// 所有数据用 `as const` 标注,既给类型推导又保留字面量类型。

// 显示模式:卡片右下角"散点 / 飞线 / 热力"三个按钮
export const displayModes = [
  { label: '散点模式', value: 'scatter' },
  { label: '飞线模式', value: 'lines' },
  { label: '热力模式', value: 'heatmap' },
] as const;

export type DisplayModeValue = (typeof displayModes)[number]['value'];

// 主要城市数据(经纬度 + 自定义颜色 + 等级)
// level 用于散点图的涟漪强度 —— level 越大圈越大。
export const cities = [
  { name: '北京', value: [116.407387, 39.904179], color: '#FF6B6B', level: 1 },
  { name: '上海', value: [121.473704, 31.230393], color: '#4ECDC4', level: 1 },
  { name: '广州', value: [113.264385, 23.129112], color: '#45B7D1', level: 1 },
  { name: '深圳', value: [114.057871, 22.543099], color: '#96CEB4', level: 1 },
  { name: '杭州', value: [120.155069, 30.274085], color: '#FFEAA7', level: 2 },
  { name: '成都', value: [104.066541, 30.572269], color: '#DDA0DD', level: 2 },
  { name: '重庆', value: [106.551556, 29.563009], color: '#98D8C8', level: 2 },
  { name: '西安', value: [108.93977, 34.341574], color: '#F7DC6F', level: 2 },
  { name: '武汉', value: [114.305393, 30.593099], color: '#BB8FCE', level: 2 },
  { name: '南京', value: [118.796877, 32.060255], color: '#85C1E9', level: 2 },
  { name: '天津', value: [117.190182, 39.125596], color: '#F8C471', level: 2 },
  { name: '苏州', value: [120.585315, 31.298886], color: '#82E0AA', level: 3 },
  { name: '长沙', value: [112.938814, 28.228209], color: '#F1948A', level: 3 },
  { name: '郑州', value: [113.625368, 34.7466], color: '#85C1E9', level: 3 },
  { name: '沈阳', value: [123.431474, 41.805698], color: '#F5B041', level: 3 },
  { name: '青岛', value: [120.382627, 36.067108], color: '#5DADE2', level: 3 },
  { name: '大连', value: [121.614682, 38.914003], color: '#48C9B0', level: 3 },
  { name: '厦门', value: [118.089425, 24.479833], color: '#F4D03F', level: 3 },
  { name: '昆明', value: [102.832891, 24.880095], color: '#AF7AC5', level: 3 },
  { name: '贵阳', value: [106.630153, 26.647661], color: '#5499C7', level: 3 },
] as const;

// 飞线数据:每条 [起点, 终点] + 显示名
// 不能用 as const:ECharts 的 LinesDataItemOption 要求 coords 为可变 number[][],
// 而 as const 会让元组变成 readonly 元组,触发类型不兼容。
// 所以这里用显式 LinesDataItem[] 类型标注。
export interface LinesDataItem {
  coords: [number, number][];
  name: string;
}

export const linesData: LinesDataItem[] = [
  { coords: [[116.407387, 39.904179], [121.473704, 31.230393]], name: '北京-上海' },
  { coords: [[116.407387, 39.904179], [113.264385, 23.129112]], name: '北京-广州' },
  { coords: [[116.407387, 39.904179], [114.057871, 22.543099]], name: '北京-深圳' },
  { coords: [[121.473704, 31.230393], [120.155069, 30.274085]], name: '上海-杭州' },
  { coords: [[121.473704, 31.230393], [118.796877, 32.060255]], name: '上海-南京' },
  { coords: [[113.264385, 23.129112], [114.057871, 22.543099]], name: '广州-深圳' },
  { coords: [[113.264385, 23.129112], [104.066541, 30.572269]], name: '广州-成都' },
  { coords: [[104.066541, 30.572269], [106.551556, 29.563009]], name: '成都-重庆' },
  { coords: [[108.93977, 34.341574], [114.305393, 30.593099]], name: '西安-武汉' },
  { coords: [[114.305393, 30.593099], [112.938814, 28.228209]], name: '武汉-长沙' },
  { coords: [[116.407387, 39.904179], [108.93977, 34.341574]], name: '北京-西安' },
  { coords: [[121.473704, 31.230393], [114.305393, 30.593099]], name: '上海-武汉' },
  { coords: [[120.382627, 36.067108], [121.614682, 38.914003]], name: '青岛-大连' },
  { coords: [[118.089425, 24.479833], [102.832891, 24.880095]], name: '厦门-昆明' },
  { coords: [[112.938814, 28.228209], [106.630153, 26.647661]], name: '长沙-贵阳' },
];

// 省份热力数据(人口,单位:万)—— heatmap 模式下给各省上色
export const heatmapData = [
  { name: '广东', value: 12601 },
  { name: '山东', value: 10152 },
  { name: '河南', value: 9936 },
  { name: '四川', value: 8367 },
  { name: '江苏', value: 8474 },
  { name: '河北', value: 7461 },
  { name: '湖南', value: 6644 },
  { name: '浙江', value: 6456 },
  { name: '安徽', value: 6102 },
  { name: '湖北', value: 5775 },
  { name: '广西', value: 5012 },
  { name: '云南', value: 4720 },
  { name: '江西', value: 4518 },
  { name: '辽宁', value: 4229 },
  { name: '黑龙江', value: 3185 },
  { name: '陕西', value: 3952 },
  { name: '山西', value: 3490 },
  { name: '福建', value: 4154 },
  { name: '贵州', value: 3856 },
  { name: '重庆', value: 3205 },
  { name: '吉林', value: 2407 },
  { name: '甘肃', value: 2501 },
  { name: '内蒙古', value: 2404 },
  { name: '新疆', value: 2585 },
  { name: '上海', value: 2487 },
  { name: '台湾', value: 2357 },
  { name: '北京', value: 2189 },
  { name: '天津', value: 1386 },
  { name: '海南', value: 1008 },
  { name: '香港', value: 741 },
  { name: '澳门', value: 68 },
  { name: '宁夏', value: 720 },
  { name: '青海', value: 592 },
  { name: '西藏', value: 366 },
] as const;

// 省份中文名 → 英文文件名(对应 apps/showcase/public/map/json/province/<id>.json)
export const provinceIdMap: Record<string, string> = {
  '安徽': 'anhui',
  '北京': 'beijing',
  '重庆': 'chongqing',
  '福建': 'fujian',
  '甘肃': 'gansu',
  '广东': 'guangdong',
  '广西': 'guangxi',
  '贵州': 'guizhou',
  '海南': 'hainan',
  '河北': 'hebei',
  '黑龙江': 'heilongjiang',
  '河南': 'henan',
  '湖北': 'hubei',
  '湖南': 'hunan',
  '江苏': 'jiangsu',
  '江西': 'jiangxi',
  '吉林': 'jilin',
  '辽宁': 'liaoning',
  '内蒙古': 'neimenggu',
  '宁夏': 'ningxia',
  '青海': 'qinghai',
  '陕西': 'shanxi1',
  '山西': 'shanxi',
  '上海': 'shanghai',
  '四川': 'sichuan',
  '台湾': 'taiwan',
  '天津': 'tianjin',
  '香港': 'xianggang',
  '澳门': 'aomen',
  '新疆': 'xinjiang',
  '西藏': 'xizang',
  '云南': 'yunnan',
  '浙江': 'zhejiang',
  '山东': 'shandong',
};

// 飞机 SVG 路径(飞线动画的箭头图标)
export const planePath =
  'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z';