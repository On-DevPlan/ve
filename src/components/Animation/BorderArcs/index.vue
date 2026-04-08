<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 每个半圆有独立的旋转角度和渐变色配置
const arcs = ref([
  {
    id: 'top',
    rotation: 0,
    gradient: 'conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #ff6b6b)',
    clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' // 下半圆，弧朝上
  },
  {
    id: 'bottom',
    rotation: 0,
    gradient: 'conic-gradient(from 180deg, #1dd1a1, #54a0ff, #5f27cd, #ff6b6b, #1dd1a1)',
    clipPath: 'polygon(0 0%, 100% 0%, 100% 50%, 0 50%)' // 上半圆，弧朝下
  },
  {
    id: 'left',
    rotation: 0,
    gradient: 'conic-gradient(from 90deg, #f368e0, #ff9f43, #10ac84, #0abde3, #f368e0)',
    clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)' // 右半圆，弧朝左
  },
  {
    id: 'right',
    rotation: 0,
    gradient: 'conic-gradient(from 270deg, #00d2d3, #ff9ff3, #feca57, #48dbfb, #00d2d3)',
    clipPath: 'polygon(0 0%, 50% 0%, 50% 100%, 0 100%)' // 左半圆，弧朝右
  }
])

const arcRefs = ref([])

function setArcRef(el, index) {
  if (el) arcRefs.value[index] = el
}

function handleWheel(e, index) {
  e.preventDefault()
  // 根据滚动方向调整旋转速度
  const delta = e.deltaY || e.detail
  arcs.value[index].rotation += delta * 0.3
}

function handleMouseEnter(index) {
  // 鼠标进入时增加灵敏度
  arcRefs.value[index].dataset.active = 'true'
}

function handleMouseLeave(index) {
  arcRefs.value[index].dataset.active = 'false'
}

onMounted(() => {
  // 每个半圆绑定 wheel 事件
  arcRefs.value.forEach((el, i) => {
    if (el) {
      el.addEventListener('wheel', (e) => handleWheel(e, i), { passive: false })
    }
  })
})

onUnmounted(() => {
  arcRefs.value.forEach((el) => {
    if (el) {
      el.removeEventListener('wheel', handleWheel)
    }
  })
})
</script>

<template>
  <div class="border-arcs">
    <!-- 中心内容 -->
    <div class="center-content">
      <div class="badge">Scroll the arcs</div>
      <h1>Border Arcs</h1>
      <p>Hover &amp; scroll on any semicircle to spin it</p>

      <div class="hint-grid">
        <div class="hint-item" v-for="arc in arcs" :key="arc.id">
          <span class="hint-dot" :style="{ background: arc.gradient }"></span>
          <span class="hint-label">{{ arc.id }}</span>
        </div>
      </div>
    </div>

    <!-- 上半圆 -->
    <div
      class="arc arc-top"
      :ref="(el) => setArcRef(el, 0)"
      @mouseenter="handleMouseEnter(0)"
      @mouseleave="handleMouseLeave(0)"
    >
      <div
        class="arc-inner"
        :style="{
          background: arcs[0].gradient,
          transform: `rotate(${arcs[0].rotation}deg)`
        }"
      ></div>
    </div>

    <!-- 下半圆 -->
    <div
      class="arc arc-bottom"
      :ref="(el) => setArcRef(el, 1)"
      @mouseenter="handleMouseEnter(1)"
      @mouseleave="handleMouseLeave(1)"
    >
      <div
        class="arc-inner"
        :style="{
          background: arcs[1].gradient,
          transform: `rotate(${arcs[1].rotation}deg)`
        }"
      ></div>
    </div>

    <!-- 左半圆 -->
    <div
      class="arc arc-left"
      :ref="(el) => setArcRef(el, 2)"
      @mouseenter="handleMouseEnter(2)"
      @mouseleave="handleMouseLeave(2)"
    >
      <div
        class="arc-inner"
        :style="{
          background: arcs[2].gradient,
          transform: `rotate(${arcs[2].rotation}deg)`
        }"
      ></div>
    </div>

    <!-- 右半圆 -->
    <div
      class="arc arc-right"
      :ref="(el) => setArcRef(el, 3)"
      @mouseenter="handleMouseEnter(3)"
      @mouseleave="handleMouseLeave(3)"
    >
      <div
        class="arc-inner"
        :style="{
          background: arcs[3].gradient,
          transform: `rotate(${arcs[3].rotation}deg)`
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.border-arcs {
  position: fixed;
  inset: 0;
  background: #0f0f1a;
  overflow: hidden;
}

/* 公共半圆样式 */
.arc {
  position: absolute;
  cursor: grab;
  z-index: 10;
}

.arc:active {
  cursor: grabbing;
}

.arc-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  will-change: transform;
  transition: transform 0.05s linear;
}

/* 顶部半圆 - 弧朝上，平边在顶部 */
.arc-top {
  width: 280px;
  height: 140px;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  overflow: hidden;
}

/* 底部半圆 - 弧朝下，平边在底部 */
.arc-bottom {
  width: 280px;
  height: 140px;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  overflow: hidden;
}

/* 左侧半圆 - 弧朝左，平边在左侧 */
.arc-left {
  width: 140px;
  height: 280px;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  overflow: hidden;
}

/* 右侧半圆 - 弧朝右，平边在右侧 */
.arc-right {
  width: 140px;
  height: 280px;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  overflow: hidden;
}

/* 中心内容 */
.center-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 1;
  pointer-events: none;
}

.badge {
  padding: 4px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
}

.center-content h1 {
  font-size: 2.4em;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
  letter-spacing: -0.5px;
}

.center-content p {
  font-size: 0.95em;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.hint-grid {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hint-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #ff6b6b);
}

.hint-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
