// 用户侧面板 —— 巡演路线列表、统计、播放动画、定位、站点查看。
// 复刻自 ve 仓库 huang/gis_usr/UserControlPanel.vue,事件命名改为 camelCase。

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getPresetData, type Route } from './StorageManager';

interface RecordPoint {
  id: string | number;
  lon: number;
  lat: number;
  title?: string;
  description?: string;
  images?: string[];
}

interface UserRoute extends Route {
  name?: string;
  title?: string;
  description?: string;
  length?: string;
  points?: RecordPoint[];
}

interface Props {
  routes?: UserRoute[];
}
const props = withDefaults(defineProps<Props>(), {
  routes: () => [],
});

const emit = defineEmits<{
  (e: 'viewPoint', point: RecordPoint): void;
  (e: 'playRouteAnimation', routeId: string | number): void;
  (e: 'zoomToRoute', routeId: string | number): void;
  (e: 'toggleRouteVisibility', visible: boolean): void;
  (e: 'loadPresetData', data: unknown): void;
}>();

const showRouteLines = ref(true);

const toggleRouteLines = () => {
  showRouteLines.value = !showRouteLines.value;
  emit('toggleRouteVisibility', showRouteLines.value);
};

const expandedRoutes = ref<Set<string | number>>(new Set());

const toggleRoute = (routeId: string | number) => {
  if (expandedRoutes.value.has(routeId)) {
    expandedRoutes.value.delete(routeId);
  } else {
    expandedRoutes.value.add(routeId);
  }
};

const handleViewPoint = (point: RecordPoint) => emit('viewPoint', point);
const handlePlayAnimation = (routeId: string | number) => emit('playRouteAnimation', routeId);
const handleZoomToRoute = (routeId: string | number) => emit('zoomToRoute', routeId);

const routesCount = computed(() => props.routes.length);
const totalStations = computed(() =>
  props.routes.reduce((sum, route) => sum + (route.points?.length || 0), 0),
);

onMounted(async () => {
  try {
    const presetData = await getPresetData();
    if ((presetData as { data?: unknown }).data) {
      emit('loadPresetData', presetData);
      if (props.routes.length > 0) {
        expandedRoutes.value.add(props.routes[0].id);
      }
    }
  } catch (error) {
    console.error('加载预设数据失败:', error);
  }
});
</script>

<template>
  <div class="gisusr-panel">
    <div class="gisusr-section">
      <div class="gisusr-section-header">
        <h3>2025年宇宙无敌号演唱会</h3>
        <button
          class="gisusr-toggle-lines"
          :class="{ active: showRouteLines }"
          :title="showRouteLines ? '隐藏路线' : '显示路线'"
          @click="toggleRouteLines"
        >
          {{ showRouteLines ? '隐藏路线' : '显示路线' }}
        </button>
      </div>

      <div
        v-if="routes.length > 0"
        class="gisusr-route-detail"
      >
        <div class="gisusr-route-stats">
          <div class="gisusr-stat-item">
            <span class="gisusr-stat-label">巡演路线</span>
            <span class="gisusr-stat-value">{{ routesCount }} 条</span>
          </div>
          <div class="gisusr-stat-item">
            <span class="gisusr-stat-label">演出站点</span>
            <span class="gisusr-stat-value">{{ totalStations }} 个</span>
          </div>
        </div>

        <div
          v-for="route in routes"
          :key="route.id"
          class="gisusr-concert-route"
          :class="{ expanded: expandedRoutes.has(route.id) }"
        >
          <div
            class="gisusr-route-header"
            @click="toggleRoute(route.id)"
          >
            <div class="gisusr-route-title-row">
              <span class="gisusr-expand-icon">
                {{ expandedRoutes.has(route.id) ? '▼' : '▶' }}
              </span>
              <span class="gisusr-route-title">{{ route.name || route.title }}</span>
            </div>
            <span class="gisusr-route-length">{{ route.length }}</span>
          </div>

          <p
            v-if="route.description && expandedRoutes.has(route.id)"
            class="gisusr-route-description"
          >
            {{ route.description }}
          </p>

          <div
            v-if="expandedRoutes.has(route.id)"
            class="gisusr-route-actions"
          >
            <button
              class="gisusr-action-btn gisusr-play-btn"
              @click.stop="handlePlayAnimation(route.id)"
            >
              ▶ 播放巡演
            </button>
            <button
              class="gisusr-action-btn gisusr-zoom-btn"
              @click.stop="handleZoomToRoute(route.id)"
            >
              定位
            </button>
          </div>

          <div
            v-if="route.points && route.points.length > 0 && expandedRoutes.has(route.id)"
            class="gisusr-city-stations"
          >
            <h4>演出站点 ({{ route.points.length }})</h4>
            <div class="gisusr-stations-list">
              <div
                v-for="(point, index) in route.points"
                :key="point.id"
                class="gisusr-station-item"
                @click="handleViewPoint(point)"
              >
                <div class="gisusr-station-number">
                  {{ index + 1 }}
                </div>
                <div class="gisusr-station-info">
                  <div class="gisusr-station-name">
                    {{ point.title || '未命名站点' }}
                  </div>
                  <div class="gisusr-station-coord">
                    {{ point.lat.toFixed(2) }}°N, {{ point.lon.toFixed(2) }}°E
                  </div>
                  <div
                    v-if="point.images && point.images.length > 0"
                    class="gisusr-station-images"
                  >
                    {{ point.images.length }} 张照片
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="gisusr-empty-text"
      >
        暂无巡演路线数据
      </div>
    </div>
  </div>
</template>

<style scoped>
.gisusr-panel {
  width: 320px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
  overflow-y: auto;
  border-right: 2px solid #e94560;
  height: 100%;
  color: #fff;
}
.gisusr-panel::-webkit-scrollbar {
  width: 6px;
}
.gisusr-panel::-webkit-scrollbar-thumb {
  background: #e94560;
  border-radius: 3px;
}
.gisusr-section {
  margin-bottom: 24px;
}
.gisusr-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
}
.gisusr-section h3 {
  margin: 0;
  font-size: 18px;
  color: #e94560;
  font-weight: 600;
}
.gisusr-route-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.gisusr-stat-item {
  flex: 1;
  background: rgba(233, 69, 96, 0.1);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.gisusr-stat-label {
  display: block;
  font-size: 11px;
  color: #b8c1ec;
  margin-bottom: 4px;
}
.gisusr-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #e94560;
}
.gisusr-route-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.gisusr-concert-route {
  background: rgba(15, 15, 30, 0.6);
  border: 2px solid rgba(233, 69, 96, 0.3);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}
.gisusr-concert-route:hover {
  border-color: rgba(233, 69, 96, 0.5);
  box-shadow: 0 4px 20px rgba(233, 69, 96, 0.2);
}
.gisusr-route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  background: rgba(233, 69, 96, 0.05);
}
.gisusr-route-header:hover {
  background: rgba(233, 69, 96, 0.1);
}
.gisusr-route-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gisusr-expand-icon {
  font-size: 10px;
  color: #e94560;
}
.gisusr-route-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}
.gisusr-route-length {
  font-size: 12px;
  color: #b8c1ec;
  white-space: nowrap;
}
.gisusr-route-description {
  margin: 0;
  padding: 0 16px 12px;
  font-size: 13px;
  color: #b8c1ec;
  line-height: 1.5;
}
.gisusr-route-actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}
.gisusr-action-btn {
  flex: 1;
  padding: 10px;
  background: rgba(233, 69, 96, 0.1);
  border: 2px solid #e94560;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}
.gisusr-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.4);
}
.gisusr-play-btn:hover {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  border-color: #ff6b6b;
}
.gisusr-zoom-btn:hover {
  background: linear-gradient(135deg, #0f3460, #16213e);
  border-color: #0f3460;
}
.gisusr-city-stations {
  padding: 0 16px 16px;
}
.gisusr-city-stations h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #b8c1ec;
  font-weight: 600;
}
.gisusr-stations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gisusr-station-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(233, 69, 96, 0.05);
  border: 1px solid rgba(233, 69, 96, 0.2);
  border-radius: 8px;
  cursor: pointer;
}
.gisusr-station-item:hover {
  background: rgba(233, 69, 96, 0.15);
  border-color: #e94560;
  transform: translateX(4px);
}
.gisusr-station-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.gisusr-station-info {
  flex: 1;
  min-width: 0;
}
.gisusr-station-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}
.gisusr-station-coord {
  font-size: 11px;
  color: #b8c1ec;
  margin-bottom: 4px;
}
.gisusr-station-images {
  font-size: 11px;
  color: #e94560;
}
.gisusr-toggle-lines {
  flex-shrink: 0;
  padding: 8px 14px;
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}
.gisusr-toggle-lines:hover {
  background: rgba(233, 69, 96, 0.4);
  transform: scale(1.05);
}
.gisusr-toggle-lines.active {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  border-color: #ff6b6b;
}
.gisusr-empty-text {
  text-align: center;
  color: #b8c1ec;
  font-size: 13px;
  padding: 40px 20px;
  font-style: italic;
}
</style>
