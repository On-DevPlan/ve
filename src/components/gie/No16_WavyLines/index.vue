<template>
  <div class="demo-wrapper">
    <svg ref="svgRef"></svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const svgRef = ref(null)

const X_GAP = 10
const Y_GAP = 32
const MOUSE_RADIUS = 175
const VELOCITY_DAMPING = 0.925
const RETURN_FORCE = 0.005
const SMOOTHING = 0.1

let lines = []
let paths = []
let bounding = { width: 0, height: 0 }
let mouse = { x: 0, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0 }
let rafId = null

const setSize = () => {
  if (!svgRef.value) return
  const el = svgRef.value.parentElement
  bounding = el.getBoundingClientRect()
  svgRef.value.style.width = `${bounding.width}px`
  svgRef.value.style.height = `${bounding.height}px`
}

const setLines = () => {
  if (!svgRef.value) return
  const { width, height } = bounding

  lines = []
  paths.forEach(path => path.remove())
  paths = []

  const oWidth = width + 200
  const oHeight = height + 30

  const totalLines = Math.ceil(oWidth / X_GAP)
  const totalPoints = Math.ceil(oHeight / Y_GAP)

  const xStart = (width - X_GAP * totalLines) / 2
  const yStart = (height - Y_GAP * totalPoints) / 2

  for (let i = 0; i <= totalLines; i++) {
    const points = []
    for (let j = 0; j <= totalPoints; j++) {
      const point = {
        x: xStart + X_GAP * i,
        y: yStart + Y_GAP * j,
        cursor: { x: 0, y: 0, vx: 0, vy: 0 }
      }
      points.push(point)
    }
    lines.push(points)

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svgRef.value.appendChild(path)
    paths.push(path)
  }
}

const movePoints = () => {
  lines.forEach(points => {
    points.forEach(p => {
      const dx = p.x - mouse.sx
      const dy = p.y - mouse.sy
      const d = Math.hypot(dx, dy)
      const l = Math.max(MOUSE_RADIUS, mouse.vs)

      if (d < l) {
        const f = 1 - d / l
        p.cursor.vx += Math.cos(mouse.a) * f * mouse.vs * 0.08
        p.cursor.vy += Math.sin(mouse.a) * f * mouse.vs * 0.08
      }

      p.cursor.vx += (0 - p.cursor.x) * RETURN_FORCE
      p.cursor.vy += (0 - p.cursor.y) * RETURN_FORCE

      p.cursor.vx *= VELOCITY_DAMPING
      p.cursor.vy *= VELOCITY_DAMPING

      p.cursor.x += p.cursor.vx * 2
      p.cursor.y += p.cursor.vy * 2

      p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x))
      p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y))
    })
  })
}

const moved = (point, withCursorForce = true) => {
  return {
    x: Math.round((point.x + (withCursorForce ? point.cursor.x : 0)) * 10) / 10,
    y: Math.round((point.y + (withCursorForce ? point.cursor.y : 0)) * 10) / 10
  }
}

const drawLines = () => {
  lines.forEach((points, lIndex) => {
    let p1 = moved(points[0], false)
    let d = `M ${p1.x} ${p1.y}`

    points.forEach((p, pIndex) => {
      const isLast = pIndex === points.length - 1
      const c = moved(p, !isLast)
      d += `L ${c.x} ${c.y}`
    })

    paths[lIndex].setAttribute('d', d)
  })
}

const tick = () => {
  mouse.sx += (mouse.x - mouse.sx) * SMOOTHING
  mouse.sy += (mouse.y - mouse.sy) * SMOOTHING

  const dx = mouse.x - mouse.lx
  const dy = mouse.y - mouse.ly
  const d = Math.hypot(dx, dy)

  mouse.v = d
  mouse.vs += (d - mouse.vs) * 0.1
  mouse.vs = Math.min(100, mouse.vs)

  mouse.lx = mouse.x
  mouse.ly = mouse.y
  mouse.a = Math.atan2(dy, dx)

  movePoints()
  drawLines()

  rafId = requestAnimationFrame(tick)
}

const handleMouseMove = (e) => {
  mouse.x = e.clientX - bounding.left
  mouse.y = e.clientY - bounding.top + window.scrollY
}

const handleTouchMove = (e) => {
  e.preventDefault()
  mouse.x = e.touches[0].clientX - bounding.left
  mouse.y = e.touches[0].clientY - bounding.top + window.scrollY
}

const handleResize = () => {
  setSize()
  setLines()
}

onMounted(() => {
  setSize()
  setLines()
  rafId = requestAnimationFrame(tick)
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)
  svgRef.value?.addEventListener('touchmove', handleTouchMove)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
  svgRef.value?.removeEventListener('touchmove', handleTouchMove)
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.demo-wrapper {
  width: 100vw;
  height: 100vh;
  background: #f7f7f7;
  overflow: hidden;
}

.demo-wrapper svg {
  width: 100%;
  height: 100%;
}

.demo-wrapper svg path {
  fill: none;
  stroke: #171717;
  stroke-width: 1px;
}
</style>
