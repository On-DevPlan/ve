// gis-user 组件主入口 —— 用户侧演唱会巡演地图。
// 复刻自 ve 仓库 huang/gis_usr/index.vue,事件命名改为 camelCase,类型全部显式声明。
// 蓝色主题 (#4da4ff),只读视图,运行在 css-module 隔离下,ol 控件样式通过 :deep() 注入。

<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import { ScaleLine, FullScreen } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import { Style, Fill, Stroke, Circle, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Overlay from 'ol/Overlay';
import UserControlPanel from './UserControlPanel.vue';
import PointDetail from './PointDetail.vue';
import { importFromJson, type Route } from './StorageManager';

interface RecordPoint {
  id: string | number;
  lon: number;
  lat: number;
  title?: string;
  description?: string;
  images?: string[];
}

interface RouteProcessed {
  id: string | number;
  name?: string;
  title?: string;
  description?: string;
  images?: string[];
  length?: string;
  points?: RecordPoint[];
  feature: Feature;
}

interface LayerOption {
  name: string;
  type: string;
  visible: boolean;
  url: string;
}

const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<Map | null>(null);

const vectorSource = new VectorSource();
const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: new Style({
    image: new Circle({
      radius: 10,
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
    }),
  }),
});

const routeSource = new VectorSource();
const routeLayer = new VectorLayer({
  source: routeSource,
  style: new Style({
    stroke: new Stroke({
      color: '#77a4ff',
      width: 4,
      lineDash: [10, 5],
    }),
  }),
  zIndex: 100,
});

const recordPoints = ref<RecordPoint[]>([]);
const routes = ref<RouteProcessed[]>([]);

const showPointDetail = ref(false);
const viewingPoint = ref<RecordPoint | null>(null);

const hoveredPointId = ref<string | number | null>(null);

const carOverlay = ref<Overlay | null>(null);
const animationProgress = ref(0);
const animationId = ref<number | null>(null);

const previewImage = ref<string | null>(null);
const previewPosition = ref({ x: 0, y: 0 });

const pointImageOverlay = ref<Overlay | null>(null);
const carImageUrl = '/map/333.gif';

const animationRouteSource = new VectorSource();
const animationRouteLayer = new VectorLayer({
  source: animationRouteSource,
  style: new Style({
    stroke: new Stroke({ color: '#4da4ff', width: 6 }),
  }),
  zIndex: 101,
});

const layers = ref<LayerOption[]>([
  { name: 'OpenStreetMap', type: 'osm', visible: true, url: '' },
  {
    name: '高德地图',
    type: 'xyz',
    visible: false,
    url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  },
]);

const getPointStyle = (feature: Feature, isHovered: boolean): Style => {
  const point = feature.getProperties() as RecordPoint;
  const radius = isHovered ? 16 : 12;
  const strokeWidth = isHovered ? 4 : 3;
  return new Style({
    image: new Circle({
      radius,
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: strokeWidth }),
    }),
    text: new Text({
      text: point.title || '',
      offsetY: -(radius + 8),
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 13px sans-serif',
    }),
  });
};

const getRoutePointStyle = (): Style =>
  new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  });

const getRoutePointHoverStyle = (feature: Feature): Style => {
  const props = feature.getProperties() as RecordPoint;
  return new Style({
    image: new Circle({
      radius: 12,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
    }),
    text: new Text({
      text: props.title || '',
      offsetY: -18,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 12px sans-serif',
    }),
  });
};

const handleClick = (event: { coordinate: number[]; pixel: number[] }) => {
  const feature = map.value?.forEachFeatureAtPixel(
    event.pixel,
    (f) => f,
    { hitTolerance: 10 },
  );
  if (feature) {
    const props = feature.getProperties() as RecordPoint & { isRoutePoint?: boolean; routePointIndex?: number };
    if (props.isRoutePoint) {
      const pointIndex = props.routePointIndex || 0;
      for (const route of routes.value) {
        if (route.points && route.points[pointIndex]) {
          handleViewPoint(route.points[pointIndex]);
          break;
        }
      }
      return;
    }
    if (feature.getId() !== undefined) {
      const point = recordPoints.value.find((p) => p.id === feature.getId());
      if (point) {
        handleViewPoint(point);
      }
    }
  }
};

const handlePointerMove = (event: { coordinate: number[]; pixel: number[] }) => {
  const feature = map.value?.forEachFeatureAtPixel(
    event.pixel,
    (f) => f,
    { hitTolerance: 10 },
  );
  if (hoveredPointId.value && (feature === undefined || feature.getId() !== hoveredPointId.value)) {
    const prevFeature = vectorSource.getFeatureById(hoveredPointId.value);
    if (prevFeature) {
      const props = prevFeature.getProperties() as { isRoutePoint?: boolean };
      if (props.isRoutePoint) {
        prevFeature.setStyle(getRoutePointStyle());
      } else {
        prevFeature.setStyle(getPointStyle(prevFeature, false));
      }
    }
    hoveredPointId.value = null;
    if (mapContainer.value) mapContainer.value.style.cursor = 'default';
    if (pointImageOverlay.value) pointImageOverlay.value.setPosition(undefined);
  }
  if (feature && feature.getId() !== undefined) {
    if (hoveredPointId.value !== feature.getId()) {
      const props = feature.getProperties() as RecordPoint & { isRoutePoint?: boolean };
      if (props.isRoutePoint) {
        feature.setStyle(getRoutePointHoverStyle(feature));
        if (props.images && props.images.length > 0) {
          showPointImagePreview(event.coordinate, props.images[0]);
        } else {
          for (const route of routes.value) {
            if (route.points) {
              const routePoint = route.points.find((p) => p.id === feature.getId());
              if (routePoint && routePoint.images && routePoint.images.length > 0) {
                showPointImagePreview(event.coordinate, routePoint.images[0]);
                break;
              }
            }
          }
        }
      } else {
        feature.setStyle(getPointStyle(feature, true));
        const point = recordPoints.value.find((p) => p.id === feature.getId());
        if (point && point.images && point.images.length > 0) {
          showPointImagePreview(event.coordinate, point.images[0]);
        }
      }
      hoveredPointId.value = feature.getId() as string | number;
      if (mapContainer.value) mapContainer.value.style.cursor = 'pointer';
    }
  }
};

const showPointImagePreview = (coordinate: number[], imageUrl: string) => {
  if (!map.value) return;
  if (!pointImageOverlay.value) {
    const imageElement = document.createElement('div');
    imageElement.className = 'gisusr-point-image-preview';
    imageElement.innerHTML = `<img src="${imageUrl}" alt="预览" />`;
    pointImageOverlay.value = new Overlay({
      element: imageElement,
      positioning: 'bottom-left',
      offset: [15, -15],
      stopEvent: false,
    });
    map.value.addOverlay(pointImageOverlay.value);
  } else {
    const element = pointImageOverlay.value.getElement();
    if (element) element.innerHTML = `<img src="${imageUrl}" alt="预览" />`;
  }
  pointImageOverlay.value.setPosition(coordinate);
};

const handleImagePreview = (imageUrl: string | null, event?: MouseEvent) => {
  if (!imageUrl || !event) {
    previewImage.value = null;
    return;
  }
  previewImage.value = imageUrl;
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  previewPosition.value = { x: rect.right + 10, y: rect.top };
};

const closeImagePreview = () => {
  previewImage.value = null;
};

const zoomToRoute = (routeId: string | number) => {
  const route = routes.value.find((r) => r.id === routeId);
  if (route && route.feature && map.value) {
    const geometry = route.feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      map.value.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
    }
  }
};

const playRouteAnimation = (routeId: string | number) => {
  const route = routes.value.find((r) => r.id === routeId);
  if (!route || !map.value) return;
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
    animationId.value = null;
  }
  animationRouteSource.clear();
  route.feature.setStyle(undefined);

  if (!carOverlay.value) {
    const carElement = document.createElement('div');
    carElement.className = 'gisusr-car-marker';
    carElement.innerHTML = `<img src="${carImageUrl}" alt="car" />`;
    carOverlay.value = new Overlay({
      element: carElement,
      positioning: 'center-center',
      stopEvent: false,
      offset: [0, 0],
    });
    map.value.addOverlay(carOverlay.value);
  }

  const coordinates = route.points ? route.points.map((p) => fromLonLat([p.lon, p.lat])) : [];
  if (coordinates.length < 2) return;
  const duration = 10000;
  const startTime = Date.now();
  animationProgress.value = 0;
  let animatedRouteFeature: Feature | null = null;

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    animationProgress.value = progress;
    const totalSegments = coordinates.length - 1;
    const currentSegment = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
    const segmentProgress = progress * totalSegments - currentSegment;
    const startCoord = coordinates[currentSegment];
    const endCoord = coordinates[currentSegment + 1];
    const x = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress;
    const y = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress;
    const dx = endCoord[0] - startCoord[0];
    const dy = endCoord[1] - startCoord[1];
    const angleRad = Math.atan2(dy, dx);
    let angle = -angleRad;
    let needsFlip = false;
    if (dx < 0) {
      angle = angle - Math.PI;
      needsFlip = true;
    }
    carOverlay.value?.setPosition([x, y]);
    const carElement = carOverlay.value?.getElement();
    if (carElement) {
      const angleDeg = (angle * 180) / Math.PI;
      carElement.style.transform = `rotate(${angleDeg}deg) scaleX(${needsFlip ? -1 : 1})`;
    }
    const walkedCoords: number[][] = [];
    for (let i = 0; i < currentSegment; i++) {
      walkedCoords.push(coordinates[i]);
    }
    walkedCoords.push(startCoord);
    walkedCoords.push([x, y]);
    if (animatedRouteFeature) {
      animationRouteSource.removeFeature(animatedRouteFeature);
    }
    if (walkedCoords.length >= 2) {
      animatedRouteFeature = new Feature({ geometry: new LineString(walkedCoords) });
      animatedRouteFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: '#4da4ff', width: 6 }),
        }),
      );
      animationRouteSource.addFeature(animatedRouteFeature);
    }
    if (progress < 1) {
      animationId.value = requestAnimationFrame(animate);
    } else {
      setTimeout(() => {
        if (carOverlay.value) carOverlay.value.setPosition(undefined);
        setTimeout(() => {
          animationRouteSource.clear();
          route.feature.setStyle(
            new Style({
              stroke: new Stroke({ color: '#4da4ff', width: 5 }),
            }),
          );
        }, 2000);
      }, 500);
    }
  };
  animate();
};

const handleImportData = (data: { points?: RecordPoint[]; routes?: Route[] }) => {
  vectorSource.clear();
  routeSource.clear();
  recordPoints.value = data.points || [];
  routes.value = (data.routes || []).map((route) => {
    const coordinates = route.points ? route.points.map((p) => fromLonLat([p.lon, p.lat])) : [];
    const lineString = new LineString(coordinates);
    const feature = new Feature({ geometry: lineString });
    feature.setStyle(
      new Style({
        stroke: new Stroke({ color: '#4da4ff', width: 5 }),
        text: new Text({
          text: route.name || route.title || '',
          offsetY: -15,
          fill: new Fill({ color: '#4da4ff' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
          font: 'bold 14px sans-serif',
        }),
      }),
    );
    routeSource.addFeature(feature);
    return { ...route, feature } as RouteProcessed;
  });
  routes.value.forEach((route) => {
    if (route.points) {
      route.points.forEach((point, index) => {
        const pointFeature = new Feature({
          geometry: new Point(fromLonLat([point.lon, point.lat])),
          ...point,
          isRoutePoint: true,
          routePointIndex: index,
        });
        pointFeature.setId(point.id);
        pointFeature.setStyle(getRoutePointStyle());
        vectorSource.addFeature(pointFeature);
      });
    }
  });
};

const handleLoadPresetData = async (presetData: unknown) => {
  const imported = importFromJson(presetData);
  handleImportData(imported);
};

const handleToggleRouteVisibility = (visible: boolean) => {
  if (!map.value) return;
  map.value.getLayers().getArray().forEach((layer) => {
    if (layer === routeLayer) layer.setVisible(visible);
  });
};

const handleViewPoint = (point: RecordPoint) => {
  viewingPoint.value = { ...point };
  showPointDetail.value = true;
};

onMounted(() => {
  if (!mapContainer.value) return;
  const tileLayers = layers.value.map((layer) => {
    let source;
    if (layer.type === 'osm') {
      source = new OSM();
    } else {
      source = new XYZ({ url: layer.url });
    }
    return new TileLayer({ source, visible: layer.visible });
  });

  map.value = new Map({
    target: mapContainer.value,
    layers: [...tileLayers, vectorLayer, routeLayer, animationRouteLayer],
    view: new View({
      center: fromLonLat([116.4074, 39.9042]),
      zoom: 4,
      minZoom: 2,
      maxZoom: 18,
    }),
    controls: defaultControls().extend([new ScaleLine({ units: 'metric' }), new FullScreen()]),
    interactions: defaultInteractions(),
  });
  map.value.on('click', handleClick);
  map.value.on('pointermove', handlePointerMove);
});

onUnmounted(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
    animationId.value = null;
  }
  if (pointImageOverlay.value && map.value) {
    map.value.removeOverlay(pointImageOverlay.value);
    pointImageOverlay.value = null;
  }
  if (map.value) {
    map.value.setTarget(null);
    map.value = null;
  }
});
</script>

<template>
  <div class="gisusr-container">
    <UserControlPanel
      :routes="routes"
      @view-point="handleViewPoint"
      @play-route-animation="playRouteAnimation"
      @zoom-to-route="zoomToRoute"
      @toggle-route-visibility="handleToggleRouteVisibility"
      @load-preset-data="handleLoadPresetData"
    />

    <div class="gisusr-map-wrapper">
      <div
        ref="mapContainer"
        class="gisusr-map-container"
      />
    </div>

    <PointDetail
      :show="showPointDetail"
      :point="viewingPoint"
      @close="showPointDetail = false"
      @view-image="handleImagePreview"
    />

    <Transition name="gisusr-preview-fade">
      <div
        v-if="previewImage"
        class="gisusr-image-preview"
        :style="{ left: previewPosition.x + 'px', top: previewPosition.y + 'px' }"
        @mouseenter="closeImagePreview"
      >
        <img
          :src="previewImage"
          alt="预览图片"
        >
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.gisusr-container {
  display: flex;
  height: 100vh;
  background: #f0f4ff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.gisusr-map-wrapper {
  flex: 1;
  position: relative;
  background: #f0f4ff;
  border-left: 2px solid #4da4ff;
}
.gisusr-map-container {
  width: 100%;
  height: 100%;
}
.gisusr-map-container :deep(.ol-control) {
  background: rgba(255, 255, 255, 0.9);
}
.gisusr-map-container :deep(.ol-control button) {
  color: #4da4ff;
}
.gisusr-map-container :deep(.ol-scale-line) {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dbeafe;
}
.gisusr-map-container :deep(.ol-scale-line-text) {
  color: #6b7280;
  font-size: 10px;
}
.gisusr-car-marker {
  width: 40px;
  height: 40px;
  transition: transform 0.1s linear;
}
.gisusr-car-marker img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.gisusr-map-container :deep(.gisusr-point-image-preview) {
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.gisusr-map-container :deep(.gisusr-point-image-preview img) {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.gisusr-image-preview {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  max-height: 400px;
  overflow: hidden;
}
.gisusr-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
  display: block;
}
.gisusr-preview-fade-enter-active,
.gisusr-preview-fade-leave-active {
  transition: opacity 0.2s ease;
}
.gisusr-preview-fade-enter-from,
.gisusr-preview-fade-leave-to {
  opacity: 0;
}
</style>
