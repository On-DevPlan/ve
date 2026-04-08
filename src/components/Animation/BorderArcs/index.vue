<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 每个圆维护 angle（角度）和 velocity（速度），用于惯性动量
const circles = ref([
  { id: 'top',    angle: 0, velocity: 0 },
  { id: 'bottom', angle: 0, velocity: 0 },
  { id: 'left',   angle: 0, velocity: 0 },
  { id: 'right',  angle: 0, velocity: 0 }
])

const circleEls = ref([])
let rafId = null
const FRICTION = 0.94   // 每帧速度衰减系数，越小衰减越快
const MIN_VELOCITY = 0.1 // 低于此值时停止动画

function setCircleRef(el, index) {
  if (el) circleEls.value[index] = el
}

// 单圆滚动：积累速度，不是直接改角度
function onWheel(e, index) {
  e.preventDefault()
  e.stopPropagation()
  circles.value[index].velocity += e.deltaY * 0.12
  circles.value[index].velocity = Math.max(-60, Math.min(60, circles.value[index].velocity))
  startMomentum()
}

// 全局滚动：四圆联动
function onGlobalWheel(e) {
  if (e.target.classList.contains('circle')) return
  e.preventDefault()
  circles.value.forEach((c) => {
    c.velocity += e.deltaY * 0.06
    c.velocity = Math.max(-60, Math.min(60, c.velocity))
  })
  startMomentum()
}

// 启动惯性动画循环
function startMomentum() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(momentumTick)
}

// 每帧更新：角度 += 速度，速度 *= 衰减，接近零时停止
function momentumTick() {
  let anyAlive = false

  circles.value.forEach((c, i) => {
    if (Math.abs(c.velocity) < MIN_VELOCITY) {
      c.velocity = 0
    } else {
      c.angle += c.velocity
      c.velocity *= FRICTION
      anyAlive = true
    }

    if (circleEls.value[i]) {
      circleEls.value[i].style.transform = `rotate(${c.angle}deg)`
    }
  })

  if (anyAlive) {
    rafId = requestAnimationFrame(momentumTick)
  } else {
    rafId = null
  }
}

onMounted(() => {
  document.addEventListener('wheel', onGlobalWheel, { passive: false })
})

onUnmounted(() => {
  document.removeEventListener('wheel', onGlobalWheel)
  if (rafId !== null) cancelAnimationFrame(rafId)
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
