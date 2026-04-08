<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
let canvasCtx
let canvasSize = [0, 0]
let state
let animFrameId
let mainLoopId

onMounted(() => {
  const canvas = canvasRef.value
  canvasCtx = canvas.getContext('2d')
  document.body.style.margin = '0'
  canvas.style.display = 'block'

  checkResize()
  reset()

  canvas.addEventListener('mousemove', (e) => {
    state.pointer.pos[0] = e.offsetX
    state.pointer.pos[1] = e.offsetY
  })
  canvas.addEventListener('click', reset)
  window.addEventListener('resize', reset)

  mainLoopId = requestAnimationFrame(mainLoop)

  return () => {
    cancelAnimationFrame(mainLoopId)
    cancelAnimationFrame(animFrameId)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(mainLoopId)
  cancelAnimationFrame(animFrameId)
})

function mainLoop() {
  tick()
  mainLoopId = requestAnimationFrame(mainLoop)
}

function checkResize() {
  if (window.innerWidth !== canvasSize[0] || window.innerHeight !== canvasSize[1]) {
    canvasSize[0] = canvasRef.value.width = window.innerWidth
    canvasSize[1] = canvasRef.value.height = window.innerHeight
  }
}

function reset() {
  checkResize()
  state = {
    time: 0,
    timeDelta: 1 / 60,
    pointer: { pos: [0, 0] },
    hearts: [],
  }
  const min = Math.min(canvasSize[0], canvasSize[1])
  const step = min / 13
  const center = [canvasSize[0] / 2, canvasSize[1] / 2]
  drawHeart(center, min, Math.PI * state.time * 0, null, null)
  state.hearts.length = 0
  for (let y = 0; y < canvasSize[1]; y += step) {
    for (let x = 0; x < canvasSize[0]; x += step) {
      const isInside = canvasCtx.isPointInPath(x, y)
      if (!isInside) continue
      const dist = Math.hypot(x - center[0], y - center[1])
      state.hearts.push({
        pos: [x + step * Math.random() * 0.25, y + step * Math.random() * 0.25],
        w: step * (0.25 + 0.75 * (1 - (dist / min))),
        a: (Math.random() - 0.5) * Math.PI * 0.5,
        timeOffset: (1 - (dist / min)) * 2,
        timeScale: 1,
        color1: 'rgba(255, 105, 180, 0.36)',
        color2: 'rgba(255, 105, 180, 0.46)',
      })
    }
  }
}

function tick() {
  checkResize()
  const gradient = canvasCtx.createLinearGradient(0, 0, canvasSize[0], canvasSize[1])
  gradient.addColorStop(0, '#c1c3f3')
  gradient.addColorStop(1, '#ffeae5')
  canvasCtx.fillStyle = gradient
  canvasCtx.fillRect(0, 0, canvasSize[0], canvasSize[1])
  doIt()
  state.time += state.timeDelta
}

function doIt() {
  const { timeDelta } = state
  for (const heart of state.hearts) {
    const time = state.time * heart.timeScale + heart.timeOffset
    const s = ((Math.sin(time * Math.PI) + 1) / 2) ** 0.5 * 0.5 + 0.5
    drawHeart(heart.pos, heart.w * s, heart.a, heart.color1, heart.color2)
  }
}

function drawHeart(pos, w, a, color, color2) {
  const s = w / 92
  canvasCtx.save()
  canvasCtx.translate(pos[0], pos[1])
  canvasCtx.rotate(a)
  canvasCtx.translate(0, 12 * s)
  canvasCtx.shadowColor = 'rgba(255, 20, 147, 0.9)'
  canvasCtx.shadowBlur = 20
  canvasCtx.shadowOffsetX = 5
  canvasCtx.shadowOffsetY = 5
  canvasCtx.beginPath()
  canvasCtx.ellipse(-14 * s, -16 * s, 25 * s, 32 * s, Math.PI * -0.25, Math.PI * 1, Math.PI * 0)
  canvasCtx.ellipse(+14 * s, -16 * s, 25 * s, 32 * s, Math.PI * +0.25, Math.PI * 1, Math.PI * 0)
  canvasCtx.quadraticCurveTo(+14 * s, 20 * s, 0 * s, 32 * s)
  canvasCtx.closePath()
  const t = (Math.sin(state.time * 0.5) + 1) / 2
  const gradient = canvasCtx.createLinearGradient(-w / 2, -w / 2, w / 2, w / 2)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${1 - t * 0.5})`)
  gradient.addColorStop(1, `rgba(255, 105, 180, ${t * 0.8})`)
  canvasCtx.fillStyle = gradient
  canvasCtx.fill()
  canvasCtx.shadowColor = 'rgba(255, 255, 255, 0.8)'
  canvasCtx.shadowBlur = 10
  canvasCtx.shadowOffsetX = -3
  canvasCtx.shadowOffsetY = -3
  if (color) {
    canvasCtx.strokeStyle = color
    canvasCtx.stroke()
  }
  if (color2) {
    canvasCtx.fillStyle = color2
    canvasCtx.fill()
  }
  canvasCtx.restore()
}
</script>

<template>
  <div class="demo-wrapper">
    <canvas ref="canvasRef" id="space"></canvas>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
}

* {
  padding: 0;
  margin: 0;
}

canvas {
  display: block;
}
</style>
