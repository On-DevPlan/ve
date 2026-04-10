<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// 静态导入（绕过 componentDiscovery，启用原生 HMR）
import WorkflowCanvas from '../components/canvas/WorkflowCanvas/index.vue'

const route = useRoute()

// 组件名 → 组件映射（显式声明，HMR 友好）
const SANDBOX_COMPONENTS = {
  WorkflowCanvas: WorkflowCanvas
}

const component = computed(() => SANDBOX_COMPONENTS[route.params.name])
</script>

<template>
  <div class="sandbox-view">
    <div v-if="!component" class="sandbox-not-found">
      <h2>Sandbox Component Not Found</h2>
      <p>Unknown component: <code>{{ route.params.name }}</code></p>
      <p>Available: <code>{{ Object.keys(SANDBOX_COMPONENTS).join(', ') }}</code></p>
      <a href="/">← Back to Home</a>
    </div>
    <component v-else :is="component" />
  </div>
</template>

<style scoped>
.sandbox-view {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #000;
}

.sandbox-not-found {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.sandbox-not-found h2 {
  margin-bottom: 16px;
  font-size: 24px;
}

.sandbox-not-found p {
  margin-bottom: 12px;
  font-size: 16px;
  color: #ccc;
}

.sandbox-not-found code {
  background: #333;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.sandbox-not-found a {
  display: inline-block;
  margin-top: 20px;
  color: #3b82f6;
  font-size: 16px;
}
</style>
