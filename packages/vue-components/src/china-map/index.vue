<template>
  <div class="china-map-container">
    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="loading-overlay"
    >
      <div class="loading-spinner" />
      <p>正在加载地图数据...</p>
    </div>

    <!-- 地图容器 -->
    <div
      ref="mapContainer"
      class="map-container"
    />

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
      <div
        v-if="selectedProvince"
        class="province-info"
      >
        <div class="province-header">
          <h4>{{ selectedProvince.name }}</h4>
          <button
            class="back-btn"
            @click="backToChina"
          >
            返回全国
          </button>
        </div>
        <div class="province-cities">
          <div
            v-for="city in selectedProvince.cities"
            :key="city.name"
            class="city-item"
            @click="highlightCity(city)"
          >
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
      <p v-if="!selectedProvince">
        🖱️ 点击省份查看详情 | 滚轮缩放 | 拖拽平移
      </p>
      <p v-else>
        🖱️ 点击城市高亮显示 | 点击返回按钮回到全国地图
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import {
  cities,
  linesData,
  heatmapData,
  provinceIdMap,
  planePath,
  displayModes,
  type DisplayModeValue,
} from './data';

interface ProvinceCity {
  name: string;
  cp: [number, number];
}

interface SelectedProvince {
  name: string;
  cities: ProvinceCity[];
}

const mapContainer = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const currentMode = ref<DisplayModeValue>('scatter');
const selectedProvince = ref<SelectedProvince | null>(null);
const currentMapName = ref<string>('china');
let chartInstance: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

// 静态资源路径 —— 与 apps/showcase/public/map/json/ 对齐
const CHINA_JSON_URL = '/map/json/china.json';
const provinceJsonUrl = (id: string): string => `/map/json/province/${id}.json`;

// 获取中国地图数据
const fetchChinaMapData = async (): Promise<unknown | null> => {
  try {
    const response = await fetch(CHINA_JSON_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch map data: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('获取地图数据失败:', err);
    return null;
  }
};

// 获取省份地图数据
const fetchProvinceMapData = async (provinceId: string): Promise<unknown | null> => {
  try {
    const response = await fetch(provinceJsonUrl(provinceId));
    if (!response.ok) {
      throw new Error(`Failed to fetch province data: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('获取省份地图数据失败:', err);
    return null;
  }
};

// 判断元素是否已具备非零尺寸(ShadowRoot 挂载后布局可能尚未传播)
const hasNonZeroSize = (el: HTMLElement): boolean =>
  el.clientWidth > 0 && el.clientHeight > 0;

// 纯数据加载:拉取中国地图数据(不触碰 DOM)
const loadMapData = async (): Promise<unknown | null> => {
  const mapData = await fetchChinaMapData();
  if (!mapData) {
    loading.value = false;
    console.error('地图数据加载失败,请刷新页面重试');
    return null;
  }
  return mapData;
};

// 纯 DOM/ECharts 初始化:仅在容器已具备尺寸时调用
const createChart = (mapData: unknown) => {
  if (!mapContainer.value) return;

  chartInstance = echarts.init(mapContainer.value);
  echarts.registerMap('china', mapData as Parameters<typeof echarts.registerMap>[1]);
  currentMapName.value = 'china';

  updateChartOption();
  loading.value = false;

  chartInstance.on('click', handleMapClick as Parameters<typeof chartInstance.on>[1]);

  // 挂载后容器尺寸可能刚刚生效,显式 resize 以吸收最新尺寸
  chartInstance.resize();
};

// 处理地图点击事件
// 注意:不能声明 async。echarts 的 click handler 类型签名不接受 Promise<void>。
// 内部用 void 包装 async 逻辑。
const handleMapClick = (params: echarts.ECElementEvent): void => {
  void handleProvinceClick(params);
};

const handleProvinceClick = async (params: echarts.ECElementEvent): Promise<void> => {
  // 如果在省份详情模式,忽略
  if (currentMapName.value !== 'china') return;

  const provinceName = params.name;
  if (!provinceName || !provinceIdMap[provinceName]) return;

  const provinceId = provinceIdMap[provinceName];
  loading.value = true;

  const provinceData = await fetchProvinceMapData(provinceId);
  if (!provinceData) {
    loading.value = false;
    console.error(`无法加载${provinceName}的地图数据`);
    return;
  }

  const mapName = `province-${provinceId}`;
  echarts.registerMap(mapName, provinceData as Parameters<typeof echarts.registerMap>[1]);
  currentMapName.value = mapName;

  // 提取城市信息
  const typedProvinceData = provinceData as {
    features?: Array<{ properties?: { name?: string; cp?: [number, number]; center?: [number, number] } }>;
  };
  const citiesFromData: ProvinceCity[] = (typedProvinceData.features ?? [])
    .filter((feature) => feature.properties && feature.properties.name)
    .map((feature) => ({
      name: feature.properties!.name as string,
      cp: feature.properties!.cp || feature.properties!.center || [0, 0],
    }));

  selectedProvince.value = {
    name: provinceName,
    cities: citiesFromData,
  };

  updateProvinceChartOption(provinceData, provinceName);
  loading.value = false;
};

// 返回中国地图
const backToChina = async () => {
  loading.value = true;

  const mapData = await fetchChinaMapData();
  if (!mapData) {
    loading.value = false;
    return;
  }

  echarts.registerMap('china', mapData as Parameters<typeof echarts.registerMap>[1]);
  currentMapName.value = 'china';
  selectedProvince.value = null;

  updateChartOption();
  loading.value = false;
};

// 高亮城市
const highlightCity = (city: ProvinceCity) => {
  // 当前实现:在城市列表里点击时,触发 ECharts 内置 showTip 演示响应。
  // 后续可扩展为 dispatchAction({ type: 'highlight', ... }) 等真正的高亮逻辑。
  void city;
  if (!chartInstance) return;
  chartInstance.dispatchAction({
    type: 'showTip',
    seriesIndex: 0,
    dataIndex: 0,
  });
};

// 获取图表配置选项
const getChartOption = (): echarts.EChartsCoreOption => {
  const baseOption: echarts.EChartsCoreOption = {
    backgroundColor: '#0E2152',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderColor: '#4ECDC4',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 14 },
      formatter: (params: unknown) => {
        const p = params as {
          seriesType?: string;
          name?: string;
          value?: number[];
          data?: { name?: string };
        };
        if (p.seriesType === 'effectScatter') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
            <div style="font-size: 12px; color: #aaa;">经度: ${(p.value?.[0] ?? 0).toFixed(2)}</div>
            <div style="font-size: 12px; color: #aaa;">纬度: ${(p.value?.[1] ?? 0).toFixed(2)}</div>
          </div>`;
        } else if (p.seriesType === 'lines') {
          return `<div style="padding: 8px;">
            <div>🛫 航线</div>
            <div style="font-size: 12px; color: #aaa;">${p.data?.name || ''}</div>
          </div>`;
        } else if (p.seriesType === 'map') {
          const value = heatmapData.find((d) => d.name === p.name)?.value ?? 0;
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
            <div style="font-size: 12px; color: #aaa;">人口: ${value.toLocaleString()}万</div>
            <div style="font-size: 12px; color: #4ECDC4; margin-top: 4px;">点击查看详情</div>
          </div>`;
        }
        return p.name ?? '';
      },
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.2,
      center: [105, 36],
      label: { show: false, color: '#fff' },
      itemStyle: {
        areaColor: {
          type: 'radial',
          x: 0.5,
          y: 0.5,
          r: 0.8,
          colorStops: [
            { offset: 0, color: 'rgba(0, 102, 154, 0)' },
            { offset: 1, color: 'rgba(0, 102, 154, 0.4)' },
          ],
        },
        borderColor: '#5089EC',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { areaColor: '#2386AD' },
        label: { show: true, color: '#fff' },
      },
    },
    series: [],
  };

  if (currentMode.value === 'scatter') {
    (baseOption.series as echarts.SeriesOption[]).push({
      type: 'effectScatter',
      coordinateSystem: 'geo',
      effectType: 'ripple',
      showEffectOn: 'render',
      rippleEffect: { period: 4, scale: 5, brushType: 'fill' },
      zlevel: 1,
      data: cities.map((city) => ({
        name: city.name,
        value: [...city.value, city.level * 30],
        itemStyle: { color: city.color },
      })),
      label: { show: true, position: 'right', formatter: '{b}', color: '#fff', fontSize: 12 },
      symbolSize: (val: number[]) => val[2] || 10,
    });
  } else if (currentMode.value === 'lines') {
    (baseOption.series as echarts.SeriesOption[]).push(
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        effectType: 'ripple',
        showEffectOn: 'render',
        rippleEffect: { period: 4, scale: 4, brushType: 'fill' },
        zlevel: 1,
        data: cities.map((city) => ({
          name: city.name,
          value: [...city.value, 20],
          itemStyle: { color: city.color },
        })),
        symbolSize: 12,
        label: { show: true, position: 'right', formatter: '{b}', color: '#fff', fontSize: 11 },
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
          symbolSize: 15,
        },
        lineStyle: { color: '#93EBF8', width: 2, opacity: 0.6, curveness: 0.2 },
        data: linesData.map((d) => ({ coords: d.coords, name: d.name })),
      },
    );
  } else if (currentMode.value === 'heatmap') {
    (baseOption.series as echarts.SeriesOption[]).push({
      type: 'map',
      map: 'china',
      geoIndex: 0,
      data: heatmapData.map((d) => ({ name: d.name, value: d.value })),
    });
    (baseOption as Record<string, unknown>).visualMap = {
      min: 0,
      max: 15000,
      left: 'left',
      top: 'bottom',
      text: ['高', '低'],
      calculable: true,
      inRange: { color: ['#50a3ba', '#eac736', '#d94e5d'] },
      textStyle: { color: '#fff' },
    };
  }

  return baseOption;
};

// 获取省份图表配置
const getProvinceChartOption = (
  provinceData: unknown,
  provinceName: string,
): echarts.EChartsCoreOption => {
  const typedProvinceData = provinceData as {
    features?: Array<{ properties?: { name?: string; cp?: [number, number] } }>;
  };
  const cityPoints = (typedProvinceData.features ?? [])
    .filter((feature) => feature.properties && feature.properties.cp)
    .map((feature) => ({
      name: feature.properties!.name as string,
      value: feature.properties!.cp,
      itemStyle: { color: '#4ECDC4' },
    }));

  return {
    backgroundColor: '#0E2152',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderColor: '#4ECDC4',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 14 },
      formatter: (params: unknown) => {
        const p = params as { seriesType?: string; name?: string; value?: number[] };
        if (p.seriesType === 'effectScatter') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
            <div style="font-size: 12px; color: #aaa;">经度: ${(p.value?.[0] ?? 0).toFixed(4)}</div>
            <div style="font-size: 12px; color: #aaa;">纬度: ${(p.value?.[1] ?? 0).toFixed(4)}</div>
          </div>`;
        } else if (p.seriesType === 'map') {
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
            <div style="font-size: 12px; color: #aaa;">${provinceName}的行政区</div>
          </div>`;
        }
        return p.name ?? '';
      },
    },
    geo: {
      map: currentMapName.value,
      roam: true,
      zoom: 1.2,
      label: { show: true, color: '#fff', fontSize: 10 },
      itemStyle: {
        areaColor: {
          type: 'radial',
          x: 0.5,
          y: 0.5,
          r: 0.8,
          colorStops: [
            { offset: 0, color: 'rgba(78, 205, 196, 0)' },
            { offset: 1, color: 'rgba(78, 205, 196, 0.3)' },
          ],
        },
        borderColor: '#4ECDC4',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { areaColor: '#2386AD' },
        label: { show: true, color: '#fff', fontSize: 12 },
      },
    },
    series: [
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        effectType: 'ripple',
        showEffectOn: 'render',
        rippleEffect: { period: 4, scale: 4, brushType: 'fill' },
        zlevel: 1,
        data: cityPoints,
        symbolSize: 8,
        label: { show: false, position: 'right', formatter: '{b}', color: '#fff', fontSize: 10 },
        itemStyle: { color: '#4ECDC4' },
      },
    ],
  };
};

// 更新图表配置
const updateChartOption = () => {
  if (!chartInstance) return;
  chartInstance.setOption(getChartOption(), true);
};

// 更新省份图表配置
const updateProvinceChartOption = (provinceData: unknown, provinceName: string) => {
  if (!chartInstance) return;
  chartInstance.setOption(getProvinceChartOption(provinceData, provinceName), true);
};

// 切换显示模式
const switchMode = (mode: DisplayModeValue) => {
  currentMode.value = mode;
  if (currentMapName.value === 'china') {
    updateChartOption();
  }
};

// 处理窗口大小变化
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize();
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);

  // ShadowRoot 场景下,onMounted 时容器 clientWidth/Height 可能仍为 0,
  // 直接 echarts.init 会创建 0 尺寸 canvas 并在下一帧 drawImage 抛错。
  // 用 ResizeObserver 保持尺寸同步:初始 + 后续缩放。
  resizeObserver = new ResizeObserver(() => {
    const el = mapContainer.value;
    if (!el) return;
    if (chartInstance) {
      // 已初始化:后续尺寸变化只需同步图表大小
      chartInstance.resize();
    }
  });

  // 启动流程:
  // 1) 若模板 ref 此时已挂上,直接观察 + 主动 init
  // 2) 否则用 nextTick 等 DOM 挂载后再观察 + init
  // 3) 再用 rAF 兜底:即便 ResizeObserver 在 ShadowRoot 下不触发初始尺寸回调,
  //    也在下一帧强制 init
  const start = () => {
    const el = mapContainer.value;
    if (!el) return;
    if (resizeObserver) resizeObserver.observe(el);
    void tryInit();
  };

  start();
  nextTick(start);
  requestAnimationFrame(() => {
    // 兜底:若上面两步 ResizeObserver / nextTick 都没把 chartInstance 拉起,
    // 这里再试一次(常见于 ShadowRoot 内首次布局延后一帧才稳定)
    if (!chartInstance) void tryInit();
  });
});

// 主动尝试 init:仅在容器已具备非零尺寸时才执行。
// 幂等:chartInstance 已有则直接返回。
const tryInit = async (): Promise<void> => {
  const el = mapContainer.value;
  if (!el) return;
  if (chartInstance) return;
  if (!hasNonZeroSize(el)) return;
  const mapData = await loadMapData();
  if (mapData) createChart(mapData);
};

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped>
/*
 * 大屏全屏布局:与 ve/src/components/huang/map/index.vue 原版一致。
 *   - 外层 .china-map-container 是 position: fixed + 100vw/100vh,撑满视口
 *   - 内部数据面板/控制面板/提示用 position: absolute,相对外层定位
 *   - 注意:即使在 ShadowRoot 内,fixed 定位的元素也按 viewport 计算尺寸;
 *     这正是大屏数据可视化组件需要的——它要占据整个屏幕
 */
.china-map-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background: #0E2152;
  overflow: hidden;
  z-index: 0;
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