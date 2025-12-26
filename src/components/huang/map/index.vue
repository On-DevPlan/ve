<template>
  <div class="china-map-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在加载地图数据...</p>
    </div>

    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- 数据面板 -->
    <div class="data-panel">
      <h3>数据概览</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">覆盖城市</span>
          <span class="stat-value">{{ cities.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">连接线路</span>
          <span class="stat-value">{{ linesData.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总里程</span>
          <span class="stat-value">12,580 km</span>
        </div>
      </div>

      <!-- 当前选中的省份信息 -->
      <div v-if="selectedProvince" class="province-info">
        <div class="province-header">
          <h4>{{ selectedProvince.name }}</h4>
          <button class="back-btn" @click="backToChina">返回全国</button>
        </div>
        <div class="province-cities">
          <div v-for="city in selectedProvince.cities" :key="city.name"
               class="city-item"
               @click="highlightCity(city)">
            <span class="city-name">{{ city.name }}</span>
            <span class="city-coords">{{ city.cp[0].toFixed(2) }}, {{ city.cp[1].toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <button
        v-for="mode in displayModes"
        :key="mode.value"
        :class="['mode-btn', { active: currentMode === mode.value }]"
        @click="switchMode(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>

    <!-- 交互提示 -->
    <div class="interaction-hint">
      <p v-if="!selectedProvince">🖱️ 点击省份查看详情 | 滚轮缩放 | 拖拽平移</p>
      <p v-else>🖱️ 点击城市高亮显示 | 点击返回按钮回到全国地图</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const mapContainer = ref(null)
const loading = ref(true)
const currentMode = ref('scatter')
const selectedProvince = ref(null)
const currentMapData = ref(null)
const currentMapName = ref('china')
let chartInstance = null

// 显示模式
const displayModes = [
  { label: '散点模式', value: 'scatter' },
  { label: '飞线模式', value: 'lines' },
  { label: '热力模式', value: 'heatmap' }
]

// 主要城市数据（经纬度）
const cities = ref([
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
  { name: '贵阳', value: [106.630153, 26.647661], color: '#5499C7', level: 3 }
])

// 飞线数据
const linesData = ref([
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
  { coords: [[112.938814, 28.228209], [106.630153, 26.647661]], name: '长沙-贵阳' }
])

// 省份热力数据
const heatmapData = ref([
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
  { name: '西藏', value: 366 }
])

// 省份名称映射到英文文件名
const provinceIdMap = {
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
  '山东':'shandong'
}

// 飞机SVG路径
const planePath = 'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z'

// 获取中国地图数据
const fetchChinaMapData = async () => {
  try {
    const response = await fetch('/map/map/map/json/china.json')
    if (!response.ok) {
      throw new Error('Failed to fetch map data')
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('获取地图数据失败:', error)
    return null
  }
}

// 获取省份地图数据
const fetchProvinceMapData = async (provinceId) => {
  try {
    const response = await fetch(`/map/map/map/json/province/${provinceId}.json`)
    if (!response.ok) {
      throw new Error('Failed to fetch province data')
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('获取省份地图数据失败:', error)
    return null
  }
}

// 初始化地图
const initMap = async () => {
  try {
    const mapData = await fetchChinaMapData()

    if (!mapData) {
      loading.value = false
      alert('地图数据加载失败，请刷新页面重试')
      return
    }

    if (!mapContainer.value) return

    // 初始化ECharts实例
    chartInstance = echarts.init(mapContainer.value)

    // 注册地图
    echarts.registerMap('china', mapData)
    currentMapData.value = mapData
    currentMapName.value = 'china'

    // 设置图表配置
    updateChartOption()

    loading.value = false

    // 绑定点击事件
    chartInstance.on('click', handleMapClick)
  } catch (error) {
    console.error('初始化地图失败:', error)
    loading.value = false
  }
}

// 处理地图点击事件
const handleMapClick = async (params) => {
  // 如果在省份详情模式，忽略
  if (currentMapName.value !== 'china') return

  const provinceName = params.name
  if (!provinceName || !provinceIdMap[provinceName]) return

  const provinceId = provinceIdMap[provinceName]

  // 加载省份地图数据
  loading.value = true

  try {
    const provinceData = await fetchProvinceMapData(provinceId)

    if (!provinceData) {
      loading.value = false
      alert(`无法加载${provinceName}的地图数据`)
      return
    }

    // 注册省份地图
    const mapName = `province-${provinceId}`
    echarts.registerMap(mapName, provinceData)
    currentMapData.value = provinceData
    currentMapName.value = mapName

    // 提取城市信息
    const cities = provinceData.features
      .filter(feature => feature.properties && feature.properties.name)
      .map(feature => ({
        name: feature.properties.name,
        cp: feature.properties.cp || feature.properties.center || [0, 0]
      }))

    selectedProvince.value = {
      name: provinceName,
      cities: cities
    }

    // 更新图表配置显示省份地图
    updateProvinceChartOption(provinceData, provinceName)

    loading.value = false
  } catch (error) {
    console.error('加载省份地图失败:', error)
    loading.value = false
  }
}

// 返回中国地图
const backToChina = async () => {
  loading.value = true

  try {
    const mapData = await fetchChinaMapData()

    if (!mapData) {
      loading.value = false
      return
    }

    echarts.registerMap('china', mapData)
    currentMapData.value = mapData
    currentMapName.value = 'china'
    selectedProvince.value = null

    updateChartOption()
    loading.value = false
  } catch (error) {
    console.error('返回中国地图失败:', error)
    loading.value = false
  }
}

// 高亮城市
const highlightCity = (_city) => {
  if (!chartInstance) return

  // 显示城市信息提示
  chartInstance.dispatchAction({
    type: 'showTip',
    seriesIndex: 0,
    dataIndex: 0
  })
}

// 获取图表配置选项
const getChartOption = () => {
  const baseOption = {
    backgroundColor: '#0E2152',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderColor: '#4ECDC4',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
        fontSize: 14
      },
      formatter: function (params) {
        if (params.seriesType === 'effectScatter') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div style="font-size: 12px; color: #aaa;">经度: ${params.value[0].toFixed(2)}</div>
            <div style="font-size: 12px; color: #aaa;">纬度: ${params.value[1].toFixed(2)}</div>
          </div>`
        } else if (params.seriesType === 'lines') {
          return `<div style="padding: 8px;">
            <div>🛫 航线</div>
            <div style="font-size: 12px; color: #aaa;">${params.data.name || ''}</div>
          </div>`
        } else if (params.seriesType === 'map') {
          const value = heatmapData.value.find(d => d.name === params.name)?.value || 0
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div style="font-size: 12px; color: #aaa;">人口: ${value.toLocaleString()}万</div>
            <div style="font-size: 12px; color: #4ECDC4; margin-top: 4px;">点击查看详情</div>
          </div>`
        }
        return params.name
      }
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.2,
      center: [105, 36],
      label: {
        show: false,
        color: '#fff'
      },
      itemStyle: {
        areaColor: {
          type: 'radial',
          x: 0.5,
          y: 0.5,
          r: 0.8,
          colorStops: [
            { offset: 0, color: 'rgba(0, 102, 154, 0)' },
            { offset: 1, color: 'rgba(0, 102, 154, 0.4)' }
          ]
        },
        borderColor: '#5089EC',
        borderWidth: 1
      },
      emphasis: {
        itemStyle: {
          areaColor: '#2386AD'
        },
        label: {
          show: true,
          color: '#fff'
        }
      }
    },
    series: []
  }

  // 根据当前模式添加系列
  if (currentMode.value === 'scatter') {
    baseOption.series.push(
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        effectType: 'ripple',
        showEffectOn: 'render',
        rippleEffect: {
          period: 4,
          scale: 5,
          brushType: 'fill'
        },
        zlevel: 1,
        data: cities.value.map(city => ({
          name: city.name,
          value: [...city.value, city.level * 30],
          itemStyle: { color: city.color }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          color: '#fff',
          fontSize: 12
        },
        symbolSize: function (val) {
          return val[2] || 10
        }
      }
    )
  } else if (currentMode.value === 'lines') {
    baseOption.series.push(
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        effectType: 'ripple',
        showEffectOn: 'render',
        rippleEffect: { period: 4, scale: 4, brushType: 'fill' },
        zlevel: 1,
        data: cities.value.map(city => ({
          name: city.name,
          value: [...city.value, 20],
          itemStyle: { color: city.color }
        })),
        symbolSize: 12,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          color: '#fff',
          fontSize: 11
        }
      },
      {
        type: 'lines',
        zlevel: 2,
        symbol: ['none', 'arrow'],
        symbolSize: 10,
        effect: {
          show: true,
          period: 6,
          trailLength: 0.1,
          symbol: planePath,
          symbolSize: 15
        },
        lineStyle: {
          color: '#93EBF8',
          width: 2,
          opacity: 0.6,
          curveness: 0.2
        },
        data: linesData.value
      }
    )
  } else if (currentMode.value === 'heatmap') {
    baseOption.series.push({
      type: 'map',
      map: 'china',
      geoIndex: 0,
      data: heatmapData.value,
      visualMap: {
        min: 0,
        max: 15000,
        left: 'left',
        top: 'bottom',
        text: ['高', '低'],
        calculable: true,
        inRange: {
          color: ['#50a3ba', '#eac736', '#d94e5d']
        },
        textStyle: {
          color: '#fff'
        }
      }
    })
  }

  return baseOption
}

// 获取省份图表配置
const getProvinceChartOption = (provinceData, provinceName) => {
  const cityPoints = provinceData.features
    .filter(feature => feature.properties && feature.properties.cp)
    .map(feature => ({
      name: feature.properties.name,
      value: feature.properties.cp,
      itemStyle: { color: '#4ECDC4' }
    }))

  return {
    backgroundColor: '#0E2152',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderColor: '#4ECDC4',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
        fontSize: 14
      },
      formatter: function (params) {
        if (params.seriesType === 'effectScatter') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div style="font-size: 12px; color: #aaa;">经度: ${params.value[0].toFixed(4)}</div>
            <div style="font-size: 12px; color: #aaa;">纬度: ${params.value[1].toFixed(4)}</div>
          </div>`
        } else if (params.seriesType === 'map') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div style="font-size: 12px; color: #aaa;">${provinceName}的行政区</div>
          </div>`
        }
        return params.name
      }
    },
    geo: {
      map: currentMapName.value,
      roam: true,
      zoom: 1.2,
      label: {
        show: true,
        color: '#fff',
        fontSize: 10
      },
      itemStyle: {
        areaColor: {
          type: 'radial',
          x: 0.5,
          y: 0.5,
          r: 0.8,
          colorStops: [
            { offset: 0, color: 'rgba(78, 205, 196, 0)' },
            { offset: 1, color: 'rgba(78, 205, 196, 0.3)' }
          ]
        },
        borderColor: '#4ECDC4',
        borderWidth: 1
      },
      emphasis: {
        itemStyle: {
          areaColor: '#2386AD'
        },
        label: {
          show: true,
          color: '#fff',
          fontSize: 12
        }
      }
    },
    series: [
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        effectType: 'ripple',
        showEffectOn: 'render',
        rippleEffect: {
          period: 4,
          scale: 4,
          brushType: 'fill'
        },
        zlevel: 1,
        data: cityPoints,
        symbolSize: 8,
        label: {
          show: false,
          position: 'right',
          formatter: '{b}',
          color: '#fff',
          fontSize: 10
        },
        itemStyle: {
          color: '#4ECDC4'
        }
      }
    ]
  }
}

// 更新图表配置
const updateChartOption = () => {
  if (!chartInstance) return
  const option = getChartOption()
  chartInstance.setOption(option, true)
}

// 更新省份图表配置
const updateProvinceChartOption = (provinceData, provinceName) => {
  if (!chartInstance) return
  const option = getProvinceChartOption(provinceData, provinceName)
  chartInstance.setOption(option, true)
}

// 切换显示模式
const switchMode = (mode) => {
  currentMode.value = mode
  if (currentMapName.value === 'china') {
    updateChartOption()
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

onMounted(() => {
  initMap()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.china-map-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #0E2152;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 100%;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(14, 33, 82, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #4ECDC4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  color: #fff;
  margin-top: 20px;
  font-size: 16px;
}

/* 数据面板 */
.data-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 20px;
  color: #fff;
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.2);
  max-height: 70vh;
  overflow-y: auto;
}

.data-panel h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #4ECDC4;
}

/* 省份信息 */
.province-info {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.province-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.province-header h4 {
  margin: 0;
  font-size: 16px;
  color: #4ECDC4;
}

.back-btn {
  padding: 6px 12px;
  background: #4ECDC4;
  color: #0E2152;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: #3db8b8;
}

.province-cities {
  display: grid;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.city-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.city-item:hover {
  background: rgba(78, 205, 196, 0.2);
}

.city-name {
  font-size: 14px;
  color: #fff;
}

.city-coords {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* 控制面板 */
.control-panel {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 10px 15px;
  border-radius: 30px;
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.mode-btn {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.mode-btn.active {
  background: #4ECDC4;
  color: #0E2152;
  font-weight: 600;
}

/* 交互提示 */
.interaction-hint {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  z-index: 10;
  text-align: center;
}

.interaction-hint p {
  margin: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .data-panel {
    top: 10px;
    left: 10px;
    right: 10px;
    padding: 15px;
    max-height: 50vh;
  }

  .control-panel {
    bottom: 20px;
    flex-wrap: wrap;
    justify-content: center;
    border-radius: 20px;
  }

  .mode-btn {
    padding: 8px 16px;
    font-size: 12px;
  }

  .interaction-hint {
    bottom: 70px;
    font-size: 10px;
  }
}
</style>
