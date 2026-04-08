<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 每个圆独立维护旋转角度
const circles = ref([
  { id: 'top', angle: 0 },
  { id: 'bottom', angle: 0 },
  { id: 'left', angle: 0 },
  { id: 'right', angle: 0 }
])

const circleEls = ref([])

function setCircleRef(el, index) {
  if (el) circleEls.value[index] = el
}

// 单圆独立滚动
function onWheel(e, index) {
  e.preventDefault()
  e.stopPropagation()
  circles.value[index].angle += e.deltaY * 0.3
  circleEls.value[index].style.transform = `rotate(${circles.value[index].angle}deg)`
}

// 全局滚动：不在圆上时四圆联动
function onGlobalWheel(e) {
  if (e.target.classList.contains('circle')) return
  e.preventDefault()
  circles.value.forEach((c, i) => {
    c.angle += e.deltaY * 0.15
    if (circleEls.value[i]) {
      circleEls.value[i].style.transform = `rotate(${c.angle}deg)`
    }
  })
}

onMounted(() => {
  document.addEventListener('wheel', onGlobalWheel, { passive: false })
})

onUnmounted(() => {
  document.removeEventListener('wheel', onGlobalWheel)
})
</script>

<template>
  <div class="page">
    <!-- 四个圆 -->
    <div
      class="circle top"
      :ref="(el) => setCircleRef(el, 0)"
      data-index="0"
      @wheel="onWheel($event, 0)"
    ></div>
    <div
      class="circle bottom"
      :ref="(el) => setCircleRef(el, 1)"
      data-index="1"
      @wheel="onWheel($event, 1)"
    ></div>
    <div
      class="circle left"
      :ref="(el) => setCircleRef(el, 2)"
      data-index="2"
      @wheel="onWheel($event, 2)"
    ></div>
    <div
      class="circle right"
      :ref="(el) => setCircleRef(el, 3)"
      data-index="3"
      @wheel="onWheel($event, 3)"
    ></div>

    <!-- 中间 ASCII -->
    <pre class="ascii-face">
         ┌─────────────────────┐
         │   ╭───────────────╮ │
         │   │               │ │
         │   │   ✖       ✖   │ │
         │   │       ▽       │ │
         │   │   ╰───────╯   │ │
         │   │  "Scroll me!" │ │
         │   ╰───────────────╯ │
         └─────────────────────┘
      ╱╲   你滚啊，滚啊，使劲滚   ╱╲
     ╱  ╲  ───────────────────  ╱  ╲
    ╱    ╲   (╯°□°)╯︵ ┻━┻    ╱    ╲
   ╱______╲                   ╱______╲
    </pre>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0a;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.circle {
  position: fixed;
  width: 40vmin;
  height: 40vmin;
  border-radius: 50%;
  will-change: transform;
  cursor: pointer;
}

/* 上：圆心在视口顶边，上半溢出 */
.circle.top {
  top: -20vmin;
  left: 50%;
  translate: -50% 0;
  background: conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #ff6b6b);
}

/* 下 */
.circle.bottom {
  bottom: -20vmin;
  left: 50%;
  translate: -50% 0;
  background: conic-gradient(from 0deg, #0abde3, #10ac84, #ee5a24, #5f27cd, #0abde3);
}

/* 左 */
.circle.left {
  left: -20vmin;
  top: 50%;
  translate: 0 -50%;
  background: conic-gradient(from 0deg, #f368e0, #ff9f43, #00d2d3, #54a0ff, #f368e0);
}

/* 右 */
.circle.right {
  right: -20vmin;
  top: 50%;
  translate: 0 -50%;
  background: conic-gradient(from 0deg, #1dd1a1, #feca57, #ff6348, #c44569, #1dd1a1);
}

/* 中间 ASCII */
.ascii-face {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: clamp(10px, 2.2vmin, 22px);
  white-space: pre;
  text-align: center;
  line-height: 1.35;
  pointer-events: none;
  user-select: none;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.25);
}
</style>
